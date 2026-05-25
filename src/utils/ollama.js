// Ollama Local AI Integration Utilities
// Handles connection checking, model management, and chat API

const OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'llama3.2:1b';
const RECOMMENDED_MODEL = 'llama3.2:1b';

/**
 * Check if Ollama is running and accessible
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
export async function checkOllamaConnection() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return { connected: true, models: data.models || [] };
    }
    return { connected: false, error: 'Ollama responded with an error' };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { connected: false, error: 'Connection timed out. Is Ollama running?' };
    }
    return { connected: false, error: 'Could not connect to Ollama. Make sure it\'s installed and running.' };
  }
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
export async function askLocalAI(message, model = DEFAULT_MODEL, onStream = null) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a lightweight browser assistant. Be short, natural, and helpful. Keep responses concise.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: false
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout for response
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 404) {
        return { 
          response: '', 
          error: `Model "${model}" not found. Run: ollama run ${model}` 
        };
      }
      
      return { response: '', error: `Ollama error: ${errorText}` };
    }
    
    const data = await response.json();
    const assistantMessage = data.message?.content || '';
    
    return { response: assistantMessage };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { response: '', error: 'Request timed out. Try a shorter message.' };
    }
    return { response: '', error: 'Failed to connect to Ollama. Is it running?' };
  }
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