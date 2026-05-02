console.log('FreeBit Content Script Initialized');

let betObserver = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'ALIVE' });
  } else if (request.type === 'NAVIGATE_MULTIPLY') {
    const link = document.getElementById('double_your_btc_link');
    if (link) {
      link.click();
      sendResponse({ status: 'SUCCESS' });
    } else {
      sendResponse({ status: 'FAILED', message: 'Multiply BTC link not found' });
    }
  } else if (request.type === 'START_AUTO_BET') {
    startAutoBet(sendResponse);
    return true; // Keep channel open for async response
  } else if (request.type === 'STOP_AUTO_BET') {
    stopAutoBet(sendResponse);
  }
});

function startAutoBet(sendResponse) {
  // Ensure we are on Auto-Bet tab
  const autoBetTab = document.querySelector('a[href="#multiply_btc_auto_bet"]');
  if (autoBetTab) autoBetTab.click();

  setTimeout(() => {
    const startBtn = document.getElementById('auto_bet_button');
    if (startBtn) {
      if (startBtn.innerText.includes('START')) {
        startBtn.click();
        startMonitoring();
        sendResponse({ status: 'SUCCESS' });
      } else {
        sendResponse({ status: 'ALREADY_RUNNING' });
      }
    } else {
      sendResponse({ status: 'FAILED', message: 'Start button not found' });
    }
  }, 500);
}

function stopAutoBet(sendResponse) {
  const startBtn = document.getElementById('auto_bet_button');
  if (startBtn && startBtn.innerText.includes('STOP')) {
    startBtn.click();
  }
  stopMonitoring();
  sendResponse({ status: 'SUCCESS' });
}

function startMonitoring() {
  if (betObserver) return;

  const target = document.getElementById('recent_bets_list_content') || document.querySelector('.multiply_bets_recent_list');
  if (!target) {
    console.error('Monitoring target not found');
    return;
  }

  betObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && (node.tagName === 'DIV' || node.tagName === 'TR')) {
            extractBetData(node);
          }
        });
      }
    });
  });

  betObserver.observe(target, { childList: true, subtree: true });
  console.log('Started monitoring roll history');
}

function stopMonitoring() {
  if (betObserver) {
    betObserver.disconnect();
    betObserver = null;
    console.log('Stopped monitoring');
  }
}

function extractBetData(node) {
  // FreeBit history row structure usually: [Time/ID, Game, High/Low, Scored, Target, Bet, Profit]
  // We look for cells or divs
  const cells = node.querySelectorAll('div') || node.querySelectorAll('td');
  if (cells.length < 5) return;

  try {
    const profitText = cells[cells.length - 1].innerText.trim();
    const isWin = !profitText.startsWith('-');
    const profitValue = profitText.replace(/[^\d.]/g, '');
    
    const betData = {
      type: 'BET_RESULT',
      isWin: isWin,
      profit: profitText,
      value: parseFloat(profitValue),
      time: new Date().toLocaleTimeString()
    };

    chrome.runtime.sendMessage(betData);
  } catch (e) {
    console.error('Error extracting bet data:', e);
  }
}
