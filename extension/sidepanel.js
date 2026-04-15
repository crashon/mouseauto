let isRecording = false;
let isPlaying = false;
let autoMode = false;
let recordedActions = [];
let registeredTabs = []; // Array of { id, title }
let executionCount = 0;
let remainingSeconds = 0;
let timerInterval = null;

const recordBtn = document.getElementById('record-btn');
const registerBtn = document.getElementById('register-btn');
const recordStatus = document.getElementById('record-status');
const recordDot = document.getElementById('record-dot');
const targetTabsArea = document.getElementById('target-tabs-area');
const actionsList = document.getElementById('actions-list');

const playBtn = document.getElementById('play-btn');
const autoBtn = document.getElementById('auto-btn');
const playStatus = document.getElementById('play-status');
const playDot = document.getElementById('play-dot');

const statsArea = document.getElementById('stats-area');
const execCountLabel = document.getElementById('exec-count');
const remainingTimeLabel = document.getElementById('remaining-time');
const intervalInput = document.getElementById('interval');

// UI Listeners
recordBtn.addEventListener('click', toggleRecording);
registerBtn.addEventListener('click', registerCurrentTab);
playBtn.addEventListener('click', togglePlayback);
autoBtn.addEventListener('click', toggleAutoMode);

function toggleRecording() {
  if (!isRecording) {
    if (isPlaying) return alert('재생 중에는 녹화할 수 없습니다.');
    startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  isRecording = true;
  recordedActions = [];
  updateActionsUI();
  
  recordBtn.innerText = '녹화 중지';
  recordStatus.innerText = '녹화 중...';
  recordStatus.style.color = '#ef4444';
  recordDot.classList.add('active');
  document.getElementById('record-section').classList.add('recording');

  chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
}

async function stopRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  isRecording = false;
  recordBtn.innerText = '녹화 시작';
  recordStatus.innerText = '대기 중';
  recordStatus.style.color = '#94a3b8';
  recordDot.classList.remove('active');
  document.getElementById('record-section').classList.remove('recording');

  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
  }
}

async function registerCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  if (registeredTabs.find(t => t.id === tab.id)) {
    return alert('이미 등록된 탭입니다.');
  }

  registeredTabs.push({ id: tab.id, title: tab.title || 'Tab' });
  updateTabsUI();
}

function unregisterTab(id) {
  registeredTabs = registeredTabs.filter(t => t.id !== id);
  updateTabsUI();
}

function updateTabsUI() {
  targetTabsArea.innerHTML = registeredTabs.map(tab => `
    <div class="chip">
      <span>${tab.title.substring(0, 10)}...</span>
      <span class="close" data-id="${tab.id}">×</span>
    </div>
  `).join('');

  targetTabsArea.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', () => unregisterTab(parseInt(btn.dataset.id)));
  });
}

function togglePlayback() {
  if (!isPlaying) {
    startPlayback();
  } else {
    stopPlayback();
  }
}

async function startPlayback() {
  if (recordedActions.length === 0) return alert('녹화된 동작이 없습니다.');
  if (isRecording) return alert('녹화 중에는 재생할 수 없습니다.');
  
  const targets = registeredTabs.length > 0 ? registeredTabs.map(t => t.id) : null;
  if (!targets) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return alert('등록된 탭이 없으며 활성화된 탭을 찾을 수 없습니다.');
    targets = [activeTab.id];
  }

  isPlaying = true;
  playBtn.innerText = '재생 중지';
  playStatus.innerText = '재생 중...';
  playStatus.style.color = '#22c55e';
  playDot.classList.add('active');

  await runGlobalPlayback(targets);
}

function stopPlayback() {
  isPlaying = false;
  playBtn.innerText = '재생 시작';
  playStatus.innerText = '대기 중';
  playStatus.style.color = '#94a3b8';
  playDot.classList.remove('active');
}

// Master Playback Engine (Side Panel controlled timing)
async function runGlobalPlayback(tabIds) {
  let previousTime = 0;

  for (const action of recordedActions) {
    if (!isPlaying) break;

    const delay = action.delay - previousTime;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 5000)));
    }

    // Send click to all target tabs simultaneously
    for (const tabId of tabIds) {
      try {
        chrome.tabs.sendMessage(tabId, { 
          type: 'SINGLE_CLICK', 
          x: action.x, 
          y: action.y 
        });
      } catch (e) {
        console.warn(`Tab ${tabId} might be closed or not loaded.`);
      }
    }
    previousTime = action.delay;
  }

  if (isPlaying && !autoMode) stopPlayback();
}

function toggleAutoMode() {
  if (!autoMode) {
    startAutoMode();
  } else {
    stopAutoMode();
  }
}

function startAutoMode() {
  if (recordedActions.length === 0) return alert('녹화된 동작이 없습니다.');
  
  autoMode = true;
  executionCount = 0;
  autoBtn.innerText = '자동 중지';
  statsArea.style.display = 'block';
  playStatus.innerText = '자동 실행 중';
  playStatus.style.color = '#06b6d4';
  
  runAutoCycle();
}

function stopAutoMode() {
  autoMode = false;
  autoBtn.innerText = '자동 실행';
  statsArea.style.display = 'none';
  playStatus.innerText = '대기 중';
  playStatus.style.color = '#94a3b8';
  if (timerInterval) clearInterval(timerInterval);
}

async function runAutoCycle() {
  if (!autoMode) return;

  const targets = registeredTabs.length > 0 ? registeredTabs.map(t => t.id) : null;
  if (!targets) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return stopAutoMode();
    targets = [activeTab.id];
  }

  isPlaying = true;
  await runGlobalPlayback(targets);
  
  isPlaying = false;
  executionCount++;
  execCountLabel.innerText = `${executionCount}회`;
  
  if (autoMode) {
    startTimer();
  }
}

function startTimer() {
  const intervalMins = parseInt(intervalInput.value) || 1;
  remainingSeconds = intervalMins * 60;
  updateTimerDisplay();
  
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();
    
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      runAutoCycle();
    }
    
    if (!autoMode) clearInterval(timerInterval);
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  remainingTimeLabel.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Listen for recording messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTION_RECORDED') {
    recordedActions.push(message.action);
    updateActionsUI();
  }
});

function updateActionsUI() {
  if (recordedActions.length === 0) {
    actionsList.innerHTML = '<li class="empty-msg">녹화된 동작이 없습니다.</li>';
    return;
  }

  actionsList.innerHTML = recordedActions.map((action, i) => `
    <li class="action-item">
      <span>${i + 1}. 클릭 (${action.x}, ${action.y})</span>
      <span class="value">${action.delay.toFixed(2)}s</span>
    </li>
  `).join('');
  actionsList.scrollTop = actionsList.scrollHeight;
}

// Hotkeys & Cleanup
window.addEventListener('keydown', (e) => {
  if (e.key === 'F1') toggleRecording();
  if (e.key === 'Escape') {
    stopRecording();
    stopPlayback();
    stopAutoMode();
  }
});

document.getElementById('save-btn').addEventListener('click', () => {
  if (recordedActions.length === 0) return alert('저장할 데이터가 없습니다.');
  chrome.storage.local.set({ recordedActions }, () => alert('데이터가 저장되었습니다.'));
});

document.getElementById('load-btn').addEventListener('click', () => {
  chrome.storage.local.get(['recordedActions'], (result) => {
    if (result.recordedActions) {
      recordedActions = result.recordedActions;
      updateActionsUI();
      alert('데이터를 불러왔습니다.');
    }
  });
});
