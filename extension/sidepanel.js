let isRecording = false;
let autoMode = false;
let recordedActions = [];
let registeredTabs = []; 
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

// Initialize from storage
init();

async function init() {
  const data = await chrome.storage.local.get(['recordedActions', 'registeredTabs', 'executionCount', 'autoMode', 'intervalMinutes']);
  recordedActions = data.recordedActions || [];
  registeredTabs = data.registeredTabs || [];
  executionCount = data.executionCount || 0;
  autoMode = data.autoMode || false;
  
  if (data.intervalMinutes) {
    intervalInput.value = data.intervalMinutes;
  }
  
  updateActionsUI();
  updateTabsUI();
  updateStatsUI();
  
  if (autoMode) {
    playStatus.innerText = '자동 실행 중 (백그라운드)';
    autoBtn.innerText = '자동 중지';
    statsArea.style.display = 'block';
  }
}

// Watch for storage changes (sync across windows)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.registeredTabs) {
    registeredTabs = changes.registeredTabs.newValue || [];
    updateTabsUI();
  }
  if (changes.recordedActions) {
    recordedActions = changes.recordedActions.newValue || [];
    updateActionsUI();
  }
  if (changes.executionCount) {
    executionCount = changes.executionCount.newValue || 0;
    updateStatsUI();
  }
});

// UI Listeners
recordBtn.addEventListener('click', toggleRecording);
registerBtn.addEventListener('click', registerCurrentTab);
playBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'MANUAL_PLAY' });
});
autoBtn.addEventListener('click', toggleAutoMode);

// Persist interval change and validate range (1-60 mins)
intervalInput.addEventListener('change', () => {
  let val = parseInt(intervalInput.value);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 60) val = 60;
  intervalInput.value = val;
  chrome.storage.local.set({ intervalMinutes: val });
});

function toggleRecording() {
  if (!isRecording) startRecording(); else stopRecording();
}

async function startRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    if (response?.status !== 'ALIVE') throw new Error();
  } catch (e) {
    return alert('새로고침(F5)이 필요합니다.');
  }

  isRecording = true;
  recordedActions = [];
  chrome.storage.local.set({ recordedActions: [] });
  
  recordBtn.innerText = '녹화 중지';
  recordStatus.innerText = '녹화 중...';
  recordDot.classList.add('active');
  document.getElementById('record-section').classList.add('recording');
  chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
}

function stopRecording() {
  isRecording = false;
  recordBtn.innerText = '녹화 시작';
  recordStatus.innerText = '대기 중';
  recordDot.classList.remove('active');
  document.getElementById('record-section').classList.remove('recording');
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
  });
}

async function registerCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (registeredTabs.find(t => t.id === tab.id)) return;
  
  registeredTabs.push({ id: tab.id, title: tab.title || 'Tab' });
  chrome.storage.local.set({ registeredTabs });
}

function unregisterTab(id) {
  registeredTabs = registeredTabs.filter(t => t.id !== id);
  chrome.storage.local.set({ registeredTabs });
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

function toggleAutoMode() {
  if (!autoMode) {
    if (recordedActions.length === 0) return alert('녹화 데이터가 없습니다.');
    autoMode = true;
    chrome.storage.local.set({ autoMode: true });
    chrome.runtime.sendMessage({ 
      type: 'START_AUTO_MODE', 
      intervalMinutes: parseInt(intervalInput.value) || 1 
    });
    autoBtn.innerText = '자동 중지';
    statsArea.style.display = 'block';
  } else {
    autoMode = false;
    chrome.storage.local.set({ autoMode: false });
    chrome.runtime.sendMessage({ type: 'STOP_AUTO_MODE' });
    autoBtn.innerText = '자동 실행';
    statsArea.style.display = 'none';
  }
}

function updateStatsUI() {
  execCountLabel.innerText = `${executionCount}회`;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ACTION_RECORDED') {
    recordedActions.push(message.action);
    chrome.storage.local.set({ recordedActions });
  }
});

function updateActionsUI() {
  if (recordedActions.length === 0) {
    actionsList.innerHTML = '<li class="empty-msg">녹화된 동작이 없습니다.</li>';
    return;
  }
  actionsList.innerHTML = recordedActions.map((action, i) => `
    <li class="action-item">
      <span>${i + 1}. ${action.type === 'click' ? action.button : '스크롤'} (${action.x}, ${action.y})</span>
      <span class="value">${action.delay.toFixed(1)}s</span>
    </li>
  `).join('');
  actionsList.scrollTop = actionsList.scrollHeight;
}

// File Export/Import
const fileInput = document.getElementById('file-input');
document.getElementById('export-btn').addEventListener('click', () => {
  const data = { actions: recordedActions };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mouseauto_${new Date().getTime()}.json`;
  a.click();
});
document.getElementById('import-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = JSON.parse(ev.target.result);
    if (data.actions) {
      recordedActions = data.actions;
      chrome.storage.local.set({ recordedActions });
    }
  };
  reader.readAsText(e.target.files[0]);
});
