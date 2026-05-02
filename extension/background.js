let isPlaying = false;
let executionCount = 0;

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Listen for alarms (Auto Cycle Timer)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoCycleAlarm') {
    startGlobalAutomation();
  }
});

// Primary automation trigger
async function startGlobalAutomation() {
  if (isPlaying) return;
  isPlaying = true;

  const data = await chrome.storage.local.get(['registeredTabs', 'recordedActions', 'executionCount']);
  const tabs = data.registeredTabs || [];
  const actions = data.recordedActions || [];
  executionCount = (data.executionCount || 0) + 1;

  if (tabs.length === 0 || actions.length === 0) {
    stopGlobalAutomation();
    return;
  }

  // Update global execution count
  await chrome.storage.local.set({ executionCount });

  // Play Actions sequentially across all tabs
  await playStaggered(tabs, actions);

  isPlaying = false;
}

function stopGlobalAutomation() {
  isPlaying = false;
  chrome.alarms.clear('autoCycleAlarm');
}

async function playStaggered(tabs, actions) {
  // Stagger start of each tab by 500ms to prevent browser lag
  for (const tab of tabs) {
    // Send full playback command to each target tab
    // We can either drive it from here (more robust for background) 
    // or let the tab handle the internal timing.
    // For background stability, driving individual clicks from here is best.
    await executeSequenceOnTab(tab.id, actions);
    await new Promise(r => setTimeout(r, 500)); 
  }
}

async function executeSequenceOnTab(tabId, actions) {
  let previousTime = 0;
  for (const action of actions) {
    const delay = action.delay - previousTime;
    if (delay > 0) {
      await new Promise(r => setTimeout(r, Math.min(delay * 1000, 5000)));
    }

    try {
      if (action.type === 'click') {
        chrome.tabs.sendMessage(tabId, { type: 'SINGLE_CLICK', x: action.x, y: action.y }).catch(() => {});
      } else if (action.type === 'scroll') {
        chrome.tabs.sendMessage(tabId, { type: 'SINGLE_SCROLL', x: action.x, y: action.y, dx: action.dx, dy: action.dy }).catch(() => {});
      }
    } catch (e) {
      console.warn(`Tab ${tabId} unavailable`);
    }
    previousTime = action.delay;
  }
}

// Handle messages from Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_AUTO_MODE') {
    chrome.alarms.create('autoCycleAlarm', { 
      periodInMinutes: message.intervalMinutes,
      when: Date.now() + 100 // Start almost immediately
    });
    sendResponse({ status: 'started' });
  } else if (message.type === 'STOP_AUTO_MODE') {
    stopGlobalAutomation();
    chrome.storage.local.set({ executionCount: 0 });
    sendResponse({ status: 'stopped' });
  } else if (message.type === 'MANUAL_PLAY') {
    startGlobalAutomation();
    sendResponse({ status: 'playing' });
  }
  return true;
});

// Cleanup on tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get(['registeredTabs']);
  if (data.registeredTabs) {
    const newList = data.registeredTabs.filter(t => t.id !== tabId);
    if (newList.length !== data.registeredTabs.length) {
      chrome.storage.local.set({ registeredTabs: newList });
    }
  }
});
