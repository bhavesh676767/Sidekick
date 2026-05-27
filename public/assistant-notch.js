// Sidekick Floating Assistant Notch
// Persistent assistant UI injected into webpages

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    Z_INDEX: 2147483647,
    NOTCH_SIZE: 48,
    NOTCH_POSITION: { bottom: 20, right: 20 },
    PANEL_WIDTH: 320,
    PANEL_HEIGHT: 420,
    ANIMATION_DURATION: 200,
    OLLAMA_URL: 'http://127.0.0.1:11434/api/chat',
    DEFAULT_MODEL: 'llama3.2:1b'
  };

  // State
  let isPanelOpen = false;
  let isTyping = false;
  let chatHistory = [];
  let notchEl = null;
  let panelEl = null;
  let inputEl = null;
  let messagesContainerEl = null;
  let typingIndicatorEl = null;

  // Check if notch already exists
  if (document.getElementById('sidekick-assistant-notch')) {
    return;
  }

  // Create styles
  const styles = document.createElement('style');
  styles.textContent = `
    #sidekick-assistant-notch {
      position: fixed;
      bottom: ${CONFIG.NOTCH_POSITION.bottom}px;
      right: ${CONFIG.NOTCH_POSITION.right}px;
      z-index: ${CONFIG.Z_INDEX};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .sk-notch-button {
      width: ${CONFIG.NOTCH_SIZE}px;
      height: ${CONFIG.NOTCH_SIZE}px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }

    .sk-notch-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(16, 185, 129, 0.5);
    }

    .sk-notch-button:active {
      transform: scale(0.95);
    }

    .sk-notch-button svg {
      width: 22px;
      height: 22px;
      color: white;
    }

    .sk-notch-button .sk-close-icon {
      display: none;
    }

    .sk-notch-button.sk-open .sk-open-icon {
      display: none;
    }

    .sk-notch-button.sk-open .sk-close-icon {
      display: block;
    }

    .sk-panel {
      position: fixed;
      bottom: ${CONFIG.NOTCH_POSITION.bottom + CONFIG.NOTCH_SIZE + 12}px;
      right: ${CONFIG.NOTCH_POSITION.right}px;
      width: ${CONFIG.PANEL_WIDTH}px;
      height: ${CONFIG.PANEL_HEIGHT}px;
      background: #171717;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.9) translateY(10px);
      opacity: 0;
      pointer-events: none;
      transition: transform ${CONFIG.ANIMATION_DURATION}ms ease, opacity ${CONFIG.ANIMATION_DURATION}ms ease;
      z-index: ${CONFIG.Z_INDEX};
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .sk-panel.sk-open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    .sk-panel-header {
      padding: 14px 16px;
      background: rgba(23, 23, 23, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .sk-panel-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .sk-panel-header .sk-status {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }

    .sk-panel-header .sk-status.sk-offline {
      background: #ef4444;
    }

    .sk-panel-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sk-panel-messages::-webkit-scrollbar {
      width: 4px;
    }

    .sk-panel-messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }

    .sk-message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      animation: sk-message-in 0.3s ease;
    }

    @keyframes sk-message-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .sk-message.sk-user {
      align-self: flex-end;
      background: #10b981;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .sk-message.sk-assistant {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
      border-bottom-left-radius: 4px;
    }

    .sk-message.sk-error {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .sk-message.sk-system {
      align-self: center;
      background: transparent;
      color: #6b7280;
      font-size: 11px;
      padding: 4px 12px;
    }

    .sk-typing-indicator {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
      align-self: flex-start;
    }

    .sk-typing-indicator span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #6b7280;
      animation: sk-typing 1.4s infinite;
    }

    .sk-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .sk-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes sk-typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .sk-panel-input {
      padding: 12px 16px;
      background: rgba(23, 23, 23, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .sk-panel-input input {
      flex: 1;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      color: white;
      outline: none;
      transition: border-color 0.2s;
    }

    .sk-panel-input input:focus {
      border-color: #10b981;
    }

    .sk-panel-input input::placeholder {
      color: #6b7280;
    }

    .sk-panel-input button {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #10b981;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.1s;
      flex-shrink: 0;
    }

    .sk-panel-input button:hover {
      background: #059669;
    }

    .sk-panel-input button:active {
      transform: scale(0.95);
    }

    .sk-panel-input button:disabled {
      background: #4b5563;
      cursor: not-allowed;
    }

    .sk-panel-input button svg {
      width: 18px;
      height: 18px;
      color: white;
    }

    .sk-remove-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ef4444;
      border: 2px solid #171717;
      color: white;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: ${CONFIG.Z_INDEX + 1};
    }

    #sidekick-assistant-notch:hover .sk-remove-btn {
      opacity: 1;
    }
  `;
  document.head.appendChild(styles);

  // Create notch element
  function createNotch() {
    const container = document.createElement('div');
    container.id = 'sidekick-assistant-notch';

    container.innerHTML = `
      <button class="sk-remove-btn" title="Remove assistant" aria-label="Remove assistant">×</button>
      <button class="sk-notch-button" aria-label="Open Sidekick assistant">
        <svg class="sk-open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <svg class="sk-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="sk-panel">
        <div class="sk-panel-header">
          <h3>
            <span class="sk-status"></span>
            Sidekick Local AI
          </h3>
        </div>
        <div class="sk-panel-messages">
          <div class="sk-message sk-system">Ask me anything! I run locally on your device.</div>
        </div>
        <div class="sk-typing-indicator" style="display: none;">
          <span></span><span></span><span></span>
        </div>
        <div class="sk-panel-input">
          <input type="text" placeholder="Type a message..." aria-label="Message input">
          <button type="button" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    notchEl = container;
    panelEl = container.querySelector('.sk-panel');
    inputEl = container.querySelector('.sk-panel-input input');
    messagesContainerEl = container.querySelector('.sk-panel-messages');
    typingIndicatorEl = container.querySelector('.sk-typing-indicator');

    // Event listeners
    const notchButton = container.querySelector('.sk-notch-button');
    notchButton.addEventListener('click', togglePanel);

    const removeBtn = container.querySelector('.sk-remove-btn');
    removeBtn.addEventListener('click', removeNotch);

    const sendBtn = container.querySelector('.sk-panel-input button');
    sendBtn.addEventListener('click', sendMessage);

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Toggle panel open/closed
  function togglePanel() {
    isPanelOpen = !isPanelOpen;
    const button = notchEl.querySelector('.sk-notch-button');
    
    if (isPanelOpen) {
      panelEl.classList.add('sk-open');
      button.classList.add('sk-open');
      inputEl.focus();
      
      // Check Ollama connection
      checkConnection();
    } else {
      panelEl.classList.remove('sk-open');
      button.classList.remove('sk-open');
    }
  }

  // Check Ollama connection
  async function checkConnection() {
    try {
      const response = await fetch(`${CONFIG.OLLAMA_URL.split('/api')[0]}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      const statusEl = panelEl.querySelector('.sk-status');
      if (response.ok) {
        statusEl.classList.remove('sk-offline');
      } else {
        statusEl.classList.add('sk-offline');
      }
    } catch {
      const statusEl = panelEl.querySelector('.sk-status');
      statusEl.classList.add('sk-offline');
    }
  }

  // Send message to Ollama
  async function sendMessage() {
    const message = inputEl.value.trim();
    if (!message || isTyping) return;

    // Add user message
    addMessage(message, 'user');
    inputEl.value = '';
    isTyping = true;

    // Show typing indicator
    typingIndicatorEl.style.display = '';

    try {
      const resp = await fetch(CONFIG.OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.DEFAULT_MODEL,
          messages: [
            { role: 'user', content: message }
          ],
          stream: false
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined
      });

      if (!resp.ok) {
        addMessage('Failed to get response from local AI.', 'error');
      } else {
        const data = await resp.json();
        const assistantText = data.message?.content || data.response || '';
        if (assistantText) {
          addMessage(assistantText, 'assistant');
        } else {
          addMessage('No response from assistant.', 'error');
        }
      }
    } catch (err) {
      addMessage('Error communicating with local AI.', 'error');
    } finally {
      isTyping = false;
      typingIndicatorEl.style.display = 'none';
    }
  }

  // Add message to UI
  function addMessage(text, type) {
    const el = document.createElement('div');
    el.className = `sk-message sk-${type}`;
    el.textContent = text;
    messagesContainerEl.appendChild(el);
    messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
  }

  // Remove the notch from the page
  function removeNotch() {
    try {
      notchEl.remove();
    } catch (e) {
      // ignore
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.action === 'REMOVE_NOTCH') {
        removeNotch();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  // Initialize
  try {
    createNotch();
  } catch (e) {
    console.warn('assistant-notch init failed', e);
  }

})();


