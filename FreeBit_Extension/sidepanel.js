let totalWins = 0;
let totalLosses = 0;
let totalProfit = 0.0;
let isRunning = false;

const winLossLabel = document.getElementById('win-loss');
const profitLabel = document.getElementById('total-profit');
const historyList = document.getElementById('history-list');
const navBtn = document.getElementById('nav-btn');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const statusTag = document.getElementById('status-tag');

// Check connection on load
checkConnection();

// Button Listeners
navBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.url.includes('freebitco.in')) {
      chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_MULTIPLY' });
    } else {
      window.open('https://freebitco.in/?op=home#', '_blank');
    }
  });
});

startBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: 'START_AUTO_BET' }, (response) => {
      if (response?.status === 'SUCCESS' || response?.status === 'ALREADY_RUNNING') {
        setRunningState(true);
      } else {
        alert('Failed: ' + (response?.message || 'Check if you are on the site'));
      }
    });
  });
});

stopBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTO_BET' }, (response) => {
      setRunningState(false);
    });
  });
});

clearBtn.addEventListener('click', () => {
  historyList.innerHTML = '<li class="empty-msg">Waiting for results...</li>';
  totalWins = 0;
  totalLosses = 0;
  totalProfit = 0.0;
  updateStats();
});

// Message Listener from Content Script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'BET_RESULT') {
    addHistoryItem(message);
    updateTotals(message);
  }
});

function addHistoryItem(bet) {
  // Remove empty message if present
  const emptyMsg = historyList.querySelector('.empty-msg');
  if (emptyMsg) emptyMsg.remove();

  const li = document.createElement('li');
  li.className = `history-item ${bet.isWin ? 'win' : 'loss'}`;
  
  li.innerHTML = `
    <span class="item-time">${bet.time}</span>
    <span class="item-profit">${bet.profit}</span>
  `;

  historyList.prepend(li);

  // Keep list manageable
  if (historyList.children.length > 50) {
    historyList.lastElementChild.remove();
  }
}

function updateTotals(bet) {
  if (bet.isWin) totalWins++; else totalLosses++;
  
  // Extract number from profit string (e.g. "+0.00000001" or "-0.00000001")
  const val = parseFloat(bet.profit.replace(/[^-0-9.]/g, ''));
  if (!isNaN(val)) {
    totalProfit += val;
  }
  
  updateStats();
}

function updateStats() {
  winLossLabel.innerText = `${totalWins} / ${totalLosses}`;
  const sign = totalProfit >= 0 ? '+' : '';
  profitLabel.innerText = `${sign}${totalProfit.toFixed(8)} ₿`;
  profitLabel.style.color = totalProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
}

function setRunningState(running) {
  isRunning = running;
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  startBtn.innerText = running ? 'Running...' : 'Start Auto-Bet';
}

async function checkConnection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url.includes('freebitco.in')) {
    chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
      if (response?.status === 'ALIVE') {
        statusTag.innerText = 'Connected';
        statusTag.className = 'status-tag connected';
      }
    });
  }
}

// Auto-check connection when tab switches
chrome.tabs.onActivated.addListener(checkConnection);
chrome.tabs.onUpdated.addListener(checkConnection);
