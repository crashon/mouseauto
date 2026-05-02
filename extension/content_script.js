(function() {
  let isRecording = false;
  let startTime = 0;
  let playbackActive = false;

  console.log('[MouseAuto] Content Script Loaded and Active');

  // Handle messages from side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
        sendResponse({ status: 'ALIVE' });
        break;
      case 'START_RECORDING':
        isRecording = true;
        startTime = Date.now();
        console.log('%c[MouseAuto] Recording started...', 'color: #ef4444; font-weight: bold;');
        sendResponse({ status: 'recording_started' });
        break;
      case 'STOP_RECORDING':
        isRecording = false;
        console.log('[MouseAuto] Recording stopped.');
        sendResponse({ status: 'recording_stopped' });
        break;
      case 'PLAY_ACTIONS':
        if (!playbackActive) {
          playActions(message.actions);
        }
        sendResponse({ status: 'playing' });
        break;
      case 'SINGLE_CLICK':
        simulateClick(message.x, message.y);
        sendResponse({ status: 'clicked' });
        break;
      case 'SINGLE_SCROLL':
        simulateScroll(message.x, message.y, message.dx, message.dy);
        sendResponse({ status: 'scrolled' });
        break;
      default:
        sendResponse({ status: 'unknown_command' });
    }
    // No 'return true' here because all responses above are synchronous as far as the listener is concerned.
    // If they were async inside the switch, we would need it.
  });

  // Mouse Down Recording
  window.addEventListener('mousedown', (e) => {
    if (isRecording) {
      const action = {
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        delay: (Date.now() - startTime) / 1000,
        button: e.button === 0 ? 'left' : (e.button === 2 ? 'right' : 'middle')
      };
      chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action: action });
    }
  }, true);

  // Wheel (Scroll) Recording
  window.addEventListener('wheel', (e) => {
    if (isRecording) {
      const action = {
        type: 'scroll',
        x: e.clientX,
        y: e.clientY,
        dx: e.deltaX,
        dy: e.deltaY,
        delay: (Date.now() - startTime) / 1000
      };
      chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action: action });
    }
  }, { passive: true, capture: true });

  async function playActions(actions) {
    playbackActive = true;
    let previousTime = 0;

    for (const action of actions) {
      if (!playbackActive) break;

      const delay = action.delay - previousTime;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(delay * 1000, 5000)));
      }

      if (action.type === 'click') {
        simulateClick(action.x, action.y);
      } else if (action.type === 'scroll') {
        simulateScroll(action.x, action.y, action.dx, action.dy);
      }

      previousTime = action.delay;
    }

    playbackActive = false;
    chrome.runtime.sendMessage({ type: 'PLAYBACK_FINISHED' });
  }

  function simulateClick(x, y) {
    showVisualPulse(x, y);
    const el = document.elementFromPoint(x, y);
    if (!el) return;

    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    if (el.focus) el.focus();
  }

  function simulateScroll(x, y, dx, dy) {
    const el = document.elementFromPoint(x, y);
    const scrollableTarget = getScrollableParent(el);
    
    if (scrollableTarget) {
      scrollableTarget.scrollBy({ left: dx, top: dy, behavior: 'instant' });
    } else {
      // Fallback to the main document/window
      window.scrollBy({ left: dx, top: dy, behavior: 'instant' });
    }
  }

  // Helper to find the nearest scrollable ancestor
  function getScrollableParent(node) {
    if (!node) return null;
    
    // Check itself and ancestors
    let curr = node;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const style = window.getComputedStyle(curr);
      const isScrollableX = (curr.scrollWidth > curr.clientWidth) && (style.overflowX === 'auto' || style.overflowX === 'scroll');
      const isScrollableY = (curr.scrollHeight > curr.clientHeight) && (style.overflowY === 'auto' || style.overflowY === 'scroll');
      
      if (isScrollableX || isScrollableY) {
        return curr;
      }
      curr = curr.parentElement;
    }
    
    return null; // Fallback to window/document handled by caller
  }

  function showVisualPulse(x, y) {
    const pulse = document.createElement('div');
    pulse.style.cssText = `
      position: fixed; left: ${x - 10}px; top: ${y - 10}px;
      width: 20px; height: 20px; border-radius: 50%;
      background: rgba(99, 102, 241, 0.6); border: 2px solid white;
      pointer-events: none; z-index: 2147483647;
      transition: all 0.5s ease-out; transform: scale(0.5); opacity: 1;
    `;
    document.body.appendChild(pulse);
    requestAnimationFrame(() => {
      pulse.style.transform = 'scale(2)';
      pulse.style.opacity = '0';
    });
    setTimeout(() => pulse.remove(), 500);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') playbackActive = false;
  });

})();
