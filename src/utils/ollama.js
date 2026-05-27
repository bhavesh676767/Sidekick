// Ollama Local AI Integration Utilities (popup-side wrappers)
// All network calls to Ollama are delegated to the background service worker
// to avoid CORS/permission issues. Use chrome.runtime.sendMessage.

export const DEFAULT_MODEL = 'llama3.2:1b';
const RECOMMENDED_MODEL = 'llama3.2:1b';

/**
 * Check if Ollama is running and accessible (via background.js)
 * @returns {Promise<{connected: boolean, models?: Array, error?: string}>}
 */
export async function checkOllamaConnection() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'CHECK_OLLAMA' }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ connected: false, error: 'Could not contact background service' });
        } else {
          resolve(resp || { connected: false, error: 'No response' });
        }
      });
    } catch (err) {
      resolve({ connected: false, error: err?.message || 'Failed to check Ollama' });
    }
  });
}

/**
 * Check if a specific model is installed
 * @param {string} modelName - Model name to check
 * @returns {Promise<{installed: boolean, error?: string}>}
 */
export async function checkModelInstalled(modelName = DEFAULT_MODEL) {
  try {
    const { connected, models, error } = await checkOllamaConnection();
    
    if (!connected) {
      return { installed: false, error: error || 'Ollama not connected' };
    }
    
    const modelInstalled = models.some(m => 
      m.name === modelName || m.name.startsWith(`${modelName}:`)
    );
    
    return { installed: modelInstalled };
  } catch (err) {
    return { installed: false, error: err.message };
  }
}

/**
 * Send a chat message to Ollama
 * @param {string} message - User message
 * @param {string} model - Model to use
 * @param {Function} onStream - Optional streaming callback
 * @returns {Promise<{response: string, error?: string}>}
 */
/**
 * Ask the local Ollama model (delegated to background)
 * @param {string} message
 * @param {string} model
 * @returns {Promise<{response?:string, error?:string}>}
 */
export async function askLocalAI(message, model = DEFAULT_MODEL) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'OLLAMA_CHAT', model, message }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ response: '', error: 'Failed to contact background service' });
        } else {
          resolve(resp || { response: '', error: 'No response from background' });
        }
      });
    } catch (err) {
      resolve({ response: '', error: err?.message || 'Failed to ask Local AI' });
    }
  });
}

/**
 * Copy the install command to clipboard
 * @returns {string} The command that was copied
 */
export function getInstallCommand(model = DEFAULT_MODEL) {
  return `ollama run ${model}`;
}

/**
 * Copy command to clipboard
 * @param {string} command - Command to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyInstallCommand(command) {
  try {
    await navigator.clipboard.writeText(command);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = command;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Get Ollama download URL
 * @returns {string} Download URL
 */
export function getDownloadUrl() {
  return 'https://ollama.com/download';
}

/**
 * Save Ollama setup state to chrome.storage
 * @param {Object} state - State to save
 * @returns {Promise<void>}
 */
export async function saveSetupState(state) {
  const defaultState = {
    ollamaSetupCompleted: false,
    selectedModel: DEFAULT_MODEL,
    useLocalAI: false,
    setupStep: 0
  };
  
  const mergedState = { ...defaultState, ...state };
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ ollamaConfig: mergedState }, resolve);
  });
}

/**
 * Load Ollama setup state from chrome.storage
 * @returns {Promise<Object>} Saved state
 */
export async function loadSetupState() {
  return new Promise((resolve) => {
    chrome.storage.local.get('ollamaConfig', (result) => {
      const defaultState = {
        ollamaSetupCompleted: false,
        selectedModel: DEFAULT_MODEL,
        useLocalAI: false,
        setupStep: 0
      };
      resolve(result.ollamaConfig || defaultState);
    });
  });
}

/**
 * Reset Ollama setup state
 * @returns {Promise<void>}
 */
export async function resetSetupState() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('ollamaConfig', resolve);
  });
}

/**
 * Check if setup is complete
 * @returns {Promise<boolean>}
 */
export async function isSetupComplete() {
  const state = await loadSetupState();
  return state.ollamaSetupCompleted === true;
}

/**
 * Enable or disable local AI
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
export async function setLocalAIEnabled(enabled) {
  const state = await loadSetupState();
  await saveSetupState({ ...state, useLocalAI: enabled });
}

/**
 * Get current local AI enabled status
 * @returns {Promise<boolean>}
 */
export async function isLocalAIEnabled() {
  const state = await loadSetupState();
  return state.useLocalAI === true;
}

/**
 * Detect Ollama installation and readiness state
 * Returns one of: 'not_installed', 'installed_stopped', 'running_no_models', 'ready'
 */
export async function detectOllamaState(recommendedModel = DEFAULT_MODEL) {
  try {
    const res = await checkOllamaConnection();
    if (!res.connected) {
      return { state: 'not_installed', info: res.error || null };
    }
    const models = res.models || [];
    if (!models || models.length === 0) {
      return { state: 'running_no_models', models: [] };
    }
    const hasRecommended = models.some(m => m.name === recommendedModel || m.name.startsWith(`${recommendedModel}:`));
    return { state: 'ready', models, hasRecommended };
  } catch (err) {
    return { state: 'not_installed', info: err?.message || null };
  }
}

/**
 * Trigger model pull on Ollama: POST /api/pull { name }
 * Returns immediately and then callers should poll checkModelInstalled to detect completion.
 */
export async function pullModel(modelName) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'OLLAMA_PULL', model: modelName }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { ok: false, error: 'No response from background' });
        }
      });
    } catch (err) {
      resolve({ ok: false, error: err?.message || 'Failed to request model pull' });
    }
  });
}

/**
 * Friendly error mapping for user-facing messages
 */
export function mapOllamaError(err) {
  if (!err) return 'An unknown error occurred.';
  const msg = (err.message || err || '').toLowerCase();
  if (msg.includes('403')) return 'Sidekick cannot connect to Local AI.';
  if (msg.includes('failed') || msg.includes('could not connect')) return 'Local AI is not running.';
  if (msg.includes('timeout')) return 'AI is taking too long to respond.';
  return 'There was a problem connecting to the Local AI.';
}

// Returns structured error details: { message, code, fix }
export function mapOllamaErrorDetails(err) {
  if (!err) return { message: 'An unknown error occurred.', code: 'unknown', fix: null };
  const raw = (err.message || err || '').toLowerCase();
  if (raw.includes('403')) {
    return {
      message: 'Sidekick is blocked from using Local AI (permission issue).',
      code: 'blocked',
      fix: 'Check your Local AI app settings or allow access from Sidekick. If using Ollama, ensure origins are permissive.'
    };
  }
  if (raw.includes('could not contact') || raw.includes('could not connect') || raw.includes('failed to connect')) {
    return { message: 'Local AI is not running.', code: 'connection', fix: 'Start the Local AI app (Ollama) on your computer, then retry.' };
  }
  if (raw.includes('timeout')) {
    return { message: 'Local AI is taking too long to respond.', code: 'timeout', fix: 'Check your network and try again. If slow, wait a few moments and retry.' };
  }
  // fallback
  return { message: 'There was a problem connecting to the Local AI.', code: 'error', fix: null };
}