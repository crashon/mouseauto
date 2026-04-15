(function() {
  let isRecording = false;
  let startTime = 0;
  let playbackActive = false;

  console.log('MouseAuto Content Script Loaded');

  // Handle messages from side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'START_RECORDING':
        isRecording = true;
        startTime = Date.now();
        console.log('Recording started...');
        break;
      case 'STOP_RECORDING':
        isRecording = false;
        console.log('Recording stopped.');
        break;
      case 'PLAY_ACTIONS':
        if (!playbackActive) {
          playActions(message.actions);
        }
        sendResponse({ status: 'playing' });
        break;
      case 'SINGLE_CLICK':
        simulateClick(message.x, message.y);
        break;
    }
  });

  // Passive event listener for clicks
  window.addEventListener('click', (e) => {
    if (isRecording) {
      const action = {
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        delay: (Date.now() - startTime) / 1000,
        button: e.button === 0 ? 'left' : 'right'
      };
      // Reset startTime for next click relative delay if we want, 
      // but here we use cumulative time from start to match Python logic.
      // (Wait, Python logic used time since start. Let's keep it that way).
      
      chrome.runtime.sendMessage({ 
        type: 'ACTION_RECORDED', 
        action: action 
      });
    }
  }, true);

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
      }

      previousTime = action.delay;
    }

    playbackActive = false;
    chrome.runtime.sendMessage({ type: 'PLAYBACK_FINISHED' });
  }

  function simulateClick(x, y) {
    // Show visual indicator
    showVisualPulse(x, y);

    const el = document.elementFromPoint(x, y);
    if (!el) return;

    // Dispatch events
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    };

    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    
    // Focused if it's an input
    if (el.focus) el.focus();
  }

  function showVisualPulse(x, y) {
    const pulse = document.createElement('div');
    pulse.style.position = 'fixed';
    pulse.style.left = (x - 10) + 'px';
    pulse.style.top = (y - 10) + 'px';
    pulse.style.width = '20px';
    pulse.style.height = '20px';
    pulse.style.borderRadius = '50%';
    pulse.style.backgroundColor = 'rgba(99, 102, 241, 0.6)';
    pulse.style.border = '2px solid white';
    pulse.style.pointerEvents = 'none';
    pulse.style.zIndex = '999999';
    pulse.style.transition = 'all 0.5s ease-out';
    pulse.style.transform = 'scale(0.5)';
    pulse.style.opacity = '1';

    document.body.appendChild(pulse);

    requestAnimationFrame(() => {
      pulse.style.transform = 'scale(2)';
      pulse.style.opacity = '0';
    });

    setTimeout(() => {
      pulse.remove();
    }, 500);
  }

  // Handle hotkeys in content script too (optional, but good for UX)
  window.addEventListener('keydown', (e) => {
    // We don't necessarily want to duplicate all logic here, 
    // but ESC to stop playback is critical.
    if (e.key === 'Escape') {
      playbackActive = false;
    }
  });

})();
