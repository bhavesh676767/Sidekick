try {
  importScripts("memoryManager.js", "followupEngine.js");
} catch (err) {
  console.warn("Sidekick modular helpers unavailable", err);
}

// Default AI configuration
const DEFAULT_CONFIG = {
  aiMode: "api",
  providerPriority: ["gemini", "openrouter", "groq", "openai", "claude"],
  apiKeys: {}
};

const CONTEXT_TIMEOUT_MS = 2500;
const LLM_TIMEOUT_MS = 30000;
const TOOL_CALL_MAX_TOKENS = 350;
const DIGEST_MAX_TOKENS = 700;
const REPAIR_MAX_TOKENS = 450;
const MAX_HISTORY_MESSAGES = 4;
const SIDEKICK_UI_DEFAULTS = {
  sidekickEnabled: false,
  notchPosition: { x: null, y: null },
  notchCollapsed: true,
  voiceEnabled: true,
  voiceMode: "manual",
  wakeWord: "sidekick",
  autoSpeak: true,
  speechRate: 1,
  lastState: "idle"
};

// Get current provider configuration
async function getProviderConfig() {
  const stored = await chrome.storage.local.get(["aiMode", "providerPriority", "apiKeys", "ollamaBaseUrl", "ollamaModel"]);
  const apiKeys = stored.apiKeys || DEFAULT_CONFIG.apiKeys;
  const providerPriority = (stored.providerPriority || DEFAULT_CONFIG.providerPriority)
    .filter(provider => apiKeys[provider]);
  return {
    aiMode: stored.aiMode || DEFAULT_CONFIG.aiMode,
    providerPriority: providerPriority.length ? providerPriority : (stored.providerPriority || DEFAULT_CONFIG.providerPriority),
    apiKeys,
    ollamaBaseUrl: stored.ollamaBaseUrl || "http://127.0.0.1:11434",
    ollamaModel: stored.ollamaModel || "qwen2.5:3b"
  };
}

let activeState = {
  command: "",
  isRunning: false,
  currentStep: 0,
  maxSteps: 8,
  logs: [],
  result: null,
  currentAction: "Idle",
  askUserQuestion: null,
  suggestedFollowup: null,
  history: [], // API message history (kept short: max 3 steps)
  isFirstStepOfTask: false,
  sessionTabId: null // Isolated tab created for this specific task
};

let pageCache = {};

let voiceState = {
  mode: "idle",
  supported: true,
  transcript: "",
  lastResponse: "",
  error: null,
  updatedAt: Date.now()
};

function isSupportedPageUrl(url) {
  return Boolean(
    url &&
    !url.startsWith("chrome://") &&
    !url.startsWith("edge://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("about:")
  );
}

async function broadcastToSidekickTabs(message) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter(tab => tab.id && isSupportedPageUrl(tab.url))
      .map(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}))
  );
}

async function getSidekickUiState() {
  const stored = await chrome.storage.local.get(Object.keys(SIDEKICK_UI_DEFAULTS));
  return {
    sidekickEnabled: stored.sidekickEnabled ?? SIDEKICK_UI_DEFAULTS.sidekickEnabled,
    notchPosition: stored.notchPosition || SIDEKICK_UI_DEFAULTS.notchPosition,
    notchCollapsed: stored.notchCollapsed ?? SIDEKICK_UI_DEFAULTS.notchCollapsed,
    voiceEnabled: stored.voiceEnabled ?? SIDEKICK_UI_DEFAULTS.voiceEnabled,
    voiceMode: stored.voiceMode || SIDEKICK_UI_DEFAULTS.voiceMode,
    wakeWord: stored.wakeWord || SIDEKICK_UI_DEFAULTS.wakeWord,
    autoSpeak: stored.autoSpeak ?? SIDEKICK_UI_DEFAULTS.autoSpeak,
    speechRate: stored.speechRate || SIDEKICK_UI_DEFAULTS.speechRate,
    lastState: stored.lastState || SIDEKICK_UI_DEFAULTS.lastState
  };
}

async function updateVoiceState(newState) {
  voiceState = { ...voiceState, ...newState, updatedAt: Date.now() };
  await chrome.storage.local.set({ voiceState, lastState: voiceState.mode || "idle" });
  if (chrome.storage.session) {
    await chrome.storage.session.set({ voiceState }).catch(() => {});
  }
  try {
    chrome.runtime.sendMessage({ action: "VOICE_STATE_UPDATED", voiceState });
  } catch (err) {
    // Popup might be closed.
  }
  await broadcastToSidekickTabs({ action: "VOICE_STATE_UPDATED", voiceState });
}

async function maybeQueueFollowup(command, resultText) {
  try {
    const memory = await getSidekickMemory();
    const targetTab = await getTargetTab().catch(() => null);
    const followup = shouldAskSidekickFollowup({
      command,
      memory,
      context: { hasReadablePage: Boolean(targetTab?.url && !targetTab.url.startsWith("chrome://")) }
    });
    if (!followup || followup.when === "before_ambiguous") return null;
    activeState.suggestedFollowup = followup;
    await updateState({ suggestedFollowup: followup });
    await updateVoiceState({ lastResponse: `${voiceFriendlyResponse(resultText)} ${followup.question}` });
    return followup;
  } catch (err) {
    return null;
  }
}

function voiceFriendlyResponse(text) {
  const clean = compactText(String(text || "Done.").replace(/\s+/g, " "), 520);
  if (/^obvious task completed locally\.?$/i.test(clean)) return "Done.";
  if (/^opened url:/i.test(clean)) return "Opened.";
  if (/^searching google for:/i.test(clean)) return clean.replace(/^Searching Google for:/i, "Searching Google for");
  if (/^searching youtube for:/i.test(clean)) return clean.replace(/^Searching YouTube for:/i, "Searching YouTube for");
  return clean;
}

// State update helper
async function updateState(newState) {
  activeState = { ...activeState, ...newState, updatedAt: Date.now() };
  await chrome.storage.local.set({ agentState: activeState });
  if (chrome.storage.session) {
    await chrome.storage.session.set({ agentState: activeState }).catch(() => {});
  }
  // Maintain tasks history for persistence (keep last 50)
  try {
    const stored = await chrome.storage.local.get('tasks');
    const tasks = (stored.tasks && Array.isArray(stored.tasks)) ? stored.tasks : [];
    if (activeState.taskId) {
      const idx = tasks.findIndex(t => t.taskId === activeState.taskId);
      const snapshot = { ...activeState };
      if (idx !== -1) {
        tasks[idx] = snapshot;
      } else {
        tasks.unshift(snapshot);
      }
      const trimmed = tasks.slice(0, 50);
      await chrome.storage.local.set({ tasks: trimmed });
    }
  } catch (e) {
    // ignore persistence errors
  }
  try {
    chrome.runtime.sendMessage({ action: "STATE_UPDATED", state: activeState });
  } catch (err) {
    // Popup might be closed, which is fine
  }
  await broadcastToSidekickTabs({ action: "STATE_UPDATED", state: activeState });
}

// Logging helper
function logAction(message, type = "info") {
  const newLog = {
    message,
    type,
    time: new Date().toLocaleTimeString()
  };
  activeState.logs = [newLog, ...activeState.logs].slice(0, 30);
  updateState({});
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function scheduleNextStep(delay = 800) {
  setTimeout(() => {
    runNextStep().catch(err => {
      stopAgentLoop(`Agent crashed: ${err.message || err}`, true);
    });
  }, delay);
}

// Load saved state on startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Sidekick Extension Installed");
  const stored = await chrome.storage.local.get(["agentState", ...Object.keys(SIDEKICK_UI_DEFAULTS)]);
  if (stored.agentState) {
    activeState = stored.agentState;
  }
  await chrome.storage.local.set({
    sidekickEnabled: stored.sidekickEnabled ?? SIDEKICK_UI_DEFAULTS.sidekickEnabled,
    notchPosition: stored.notchPosition || SIDEKICK_UI_DEFAULTS.notchPosition,
    notchCollapsed: stored.notchCollapsed ?? SIDEKICK_UI_DEFAULTS.notchCollapsed,
    voiceEnabled: stored.voiceEnabled ?? SIDEKICK_UI_DEFAULTS.voiceEnabled,
    voiceMode: stored.voiceMode || SIDEKICK_UI_DEFAULTS.voiceMode,
    wakeWord: stored.wakeWord || SIDEKICK_UI_DEFAULTS.wakeWord,
    autoSpeak: stored.autoSpeak ?? SIDEKICK_UI_DEFAULTS.autoSpeak,
    speechRate: stored.speechRate || SIDEKICK_UI_DEFAULTS.speechRate,
    lastState: stored.lastState || SIDEKICK_UI_DEFAULTS.lastState
  });
});

// Message listener for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_STATE") {
    sendResponse(activeState);
  } else if (request.action === "GET_SIDEKICK_STATUS") {
    getSidekickUiState().then(ui => sendResponse({
      success: true,
      ui,
      active: ui.sidekickEnabled,
      state: activeState,
      voiceState
    }));
    return true;
  } else if (request.action === "SAVE_NOTCH_POSITION") {
    chrome.storage.local.set({ notchPosition: request.position || SIDEKICK_UI_DEFAULTS.notchPosition });
    sendResponse({ success: true });
  } else if (request.action === "SET_NOTCH_COLLAPSED") {
    chrome.storage.local.set({ notchCollapsed: Boolean(request.collapsed) });
    sendResponse({ success: true });
  } else if (request.action === "SAVE_VOICE_PREFERENCES") {
    chrome.storage.local.set(request.preferences || {});
    sendResponse({ success: true });
  } else if (request.action === "GET_VOICE_STATE") {
    sendResponse(voiceState);
  } else if (request.action === "VOICE_STATE") {
    updateVoiceState(request.voiceState || {});
    sendResponse({ success: true });
  } else if (request.action === "GET_MEMORY") {
    getSidekickMemory().then(memory => sendResponse({ success: true, memory }));
    return true;
  } else if (request.action === "UPDATE_VOICE_SETTINGS") {
    updateSidekickPreferences(request.preferences || {}).then(memory => sendResponse({ success: true, memory }));
    return true;
  } else if (request.action === "FOLLOWUP_RESPONSE") {
    (async () => {
      const accepted = isAffirmativeFollowupReply(request.response);
      const rejected = isNegativeFollowupReply(request.response);
      if (request.followupKey && (accepted || rejected)) {
        await recordFollowupOutcome(request.followupKey, accepted);
      }
      if (accepted && request.suggestedCommand) {
        await startAgentLoop(request.suggestedCommand, { source: "followup" });
      }
      sendResponse({ success: true, accepted, rejected });
    })();
    return true;
  } else if (request.action === "START_AGENT") {
    startAgentLoop(request.command, { source: request.source || "text" });
    sendResponse({ success: true });
  } else if (request.action === "STOP_AGENT") {
    stopAgentLoop("Agent stopped by user");
    sendResponse({ success: true });
  } else if (request.action === "USER_RESPONSE") {
    resumeAgentWithResponse(request.response);
    sendResponse({ success: true });
  } else if (request.action === "TEST_API_KEY") {
    testApiKey(request.provider, request.apiKey).then(success => {
      sendResponse({ success });
    });
    return true;
  } else if (request.action === "CHECK_OLLAMA") {
    checkOllamaStatus().then(sendResponse);
    return true;
  } else if (request.action === "OLLAMA_CHAT") {
    (async () => {
      try {
        const config = await getProviderConfig();
        const text = await callOllama(
          config.ollamaBaseUrl,
          request.model || config.ollamaModel,
          "You are a helpful browser assistant.",
          request.message || "",
          [],
          null,
          false,
          { maxTokens: DIGEST_MAX_TOKENS, jsonMode: false }
        );
        sendResponse({ success: true, response: text });
      } catch (err) {
        sendResponse({ success: false, error: err.message || "Local AI request failed" });
      }
    })();
    return true;
  } else if (request.action === "OLLAMA_PULL") {
    pullOllamaModel(request.model).then(sendResponse);
    return true;
  } else if (request.action === "INJECT_NOTCH") {
    injectAssistantNotch().then(sendResponse);
    return true;
  } else if (request.action === "REMOVE_NOTCH") {
    removeAssistantNotch().then(sendResponse);
    return true;
  } else if (request.action === "NOTCH_REMOVED") {
    chrome.storage.local.set({ sidekickEnabled: false, notchCollapsed: true, lastState: "idle" });
    sendResponse({ success: true });
  } else if (request.action === 'CALL_GEMINI') {
    (async () => {
      try {
        const config = await getProviderConfig();
        const apiKey = config.apiKeys.gemini;
        if (!apiKey) {
          sendResponse({ ok: false, error: 'Gemini API key not configured' });
          return;
        }
        const text = await callGemini(apiKey, request.systemPrompt, request.userPrompt, request.history || [], request.retryPrompt || null);
        sendResponse({ ok: true, text });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Gemini call failed' });
      }
    })();
    return true;
  } else if (request.action === 'CALL_AI_ENDPOINT') {
    (async () => {
      try {
        // request: { provider, endpoint, payload }
        const config = await getProviderConfig();
        const apiKey = config.apiKeys[request.provider];
        if (!apiKey) {
          sendResponse({ ok: false, error: 'API key not configured for provider' });
          return;
        }
        const url = `${request.baseUrl || ''}${request.endpoint}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(request.payload)
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          sendResponse({ ok: false, error: `Remote API Error (${resp.status}): ${txt}` });
          return;
        }
        const data = await resp.json().catch(() => null);
        sendResponse({ ok: true, data });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'AI endpoint request failed' });
      }
    })();
    return true;
  }
  return true;
});

async function checkOllamaStatus() {
  try {
    const config = await getProviderConfig();
    const response = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      return { connected: false, error: `Ollama responded with ${response.status}` };
    }
    const data = await response.json();
    return {
      connected: true,
      models: data.models || [],
      hasModel: (data.models || []).some(model => model.name === config.ollamaModel || model.name?.startsWith(`${config.ollamaModel}:`))
    };
  } catch (err) {
    return { connected: false, error: err.message || "Could not connect to Ollama" };
  }
}

async function pullOllamaModel(model) {
  try {
    const config = await getProviderConfig();
    const response = await fetch(`${config.ollamaBaseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model || config.ollamaModel, stream: false }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: `Ollama pull failed (${response.status}): ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Failed to pull Ollama model" };
  }
}

async function injectAssistantNotch() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isSupportedPageUrl(tab.url)) {
      return { success: false, error: "No injectable active tab found" };
    }
    const ui = await getSidekickUiState();
    await chrome.storage.local.set({ sidekickEnabled: true, lastState: voiceState.mode || ui.lastState });
    await ensureContentScriptInTab(tab.id);
    await chrome.tabs.sendMessage(tab.id, {
      action: "SHOW_SIDEKICK",
      ui: { ...ui, sidekickEnabled: true, lastState: voiceState.mode || ui.lastState }
    }).catch(() => {});
    await broadcastToSidekickTabs({ action: "SIDEKICK_ENABLED", enabled: true });
    return { success: true, active: true };
  } catch (err) {
    return { success: false, error: err.message || "Failed to inject assistant notch" };
  }
}

async function removeAssistantNotch() {
  try {
    await chrome.storage.local.set({ sidekickEnabled: false, notchCollapsed: true, lastState: "idle" });
    await broadcastToSidekickTabs({ action: "HIDE_SIDEKICK" });
    return { success: true, active: false };
  } catch (err) {
    return { success: false, error: err.message || "Failed to remove assistant notch" };
  }
}

// Stop agent loop
function stopAgentLoop(message, isError = false) {
  const spoken = `${voiceFriendlyResponse(message)}${!isError && activeState.suggestedFollowup?.question ? ` ${activeState.suggestedFollowup.question}` : ""}`;
  updateState({
    isRunning: false,
    currentAction: "Idle",
    result: {
      type: isError ? "error" : "success",
      text: message
    }
  });
  updateVoiceState({
    mode: isError ? "error" : "idle",
    lastResponse: spoken,
    error: isError ? spoken : null
  });
  logAction(message, isError ? "error" : "success");
}

// Safe check to verify or inject content script
async function ensureContentScriptInTab(tabId) {
  try {
    await withTimeout(new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_TEXT" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          reject(new Error("Ping failed"));
        } else {
          resolve(response);
        }
      });
    }), CONTEXT_TIMEOUT_MS, "Content script ping");
  } catch (err) {
    logAction("Content script inactive. Injecting sidekick DOM driver...", "info");
    await withTimeout(chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }), CONTEXT_TIMEOUT_MS, "Content script injection");
    await new Promise(r => setTimeout(r, 400));
  }
}

// Get session-isolated tab securely, maintaining active workspace safety
async function getTargetTab() {
  if (activeState.sessionTabId) {
    try {
      const tab = await chrome.tabs.get(activeState.sessionTabId);
      if (tab) return tab;
    } catch (err) {
      activeState.sessionTabId = null;
      await updateState({});
    }
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0];
}

// Secure call to content script
async function delegateToContent(type, args, tabId) {
  return withTimeout(new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type, args }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: true });
      }
    });
  }), CONTEXT_TIMEOUT_MS, type);
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isSupportedPageUrl(tab?.url)) return;
  const ui = await getSidekickUiState().catch(() => null);
  if (!ui?.sidekickEnabled) return;
  try {
    await ensureContentScriptInTab(tabId);
    await chrome.tabs.sendMessage(tabId, { action: "SHOW_SIDEKICK", ui }).catch(() => {});
    await chrome.tabs.sendMessage(tabId, { action: "STATE_UPDATED", state: activeState }).catch(() => {});
    await chrome.tabs.sendMessage(tabId, { action: "VOICE_STATE_UPDATED", voiceState }).catch(() => {});
  } catch (err) {
    // Ignore restricted or navigation-race failures.
  }
});

// Local Cheap Routing Parser to optimize API tokens
function tryLocalRouting(command) {
  const lower = command.toLowerCase().trim();
  const cleaned = lower.replace(/[?.!]+$/g, "").trim();
  const smartRoute = classifySmartRoute(command);
  if (smartRoute) {
    return { tool: "smart_route", args: smartRoute };
  }

  if (detectShoppingIntent(command)) {
    return chooseMarketplaceForCommand(command);
  }
  const directUrl = extractUrl(command);
  if (directUrl && /^(open|go to|visit|launch|bring up|navigate to)\b/i.test(command.trim())) {
    return { tool: "open_url", args: { url: directUrl } };
  }

  const siteAliases = {
    youtube: "https://www.youtube.com",
    yt: "https://www.youtube.com",
    google: "https://www.google.com",
    gmail: "https://mail.google.com",
    maps: "https://www.google.com/maps",
    github: "https://github.com",
    chatgpt: "https://chatgpt.com",
    wikipedia: "https://www.wikipedia.org",
    wiki: "https://www.wikipedia.org",
    "merriam webster": "https://www.merriam-webster.com",
    dictionary: "https://www.merriam-webster.com",
    britannica: "https://www.britannica.com",
    notes: "https://keep.google.com",
    "google keep": "https://keep.google.com",
    keep: "https://keep.google.com",
    notion: "https://www.notion.so",
    docs: "https://docs.google.com",
    "google docs": "https://docs.google.com",
    drive: "https://drive.google.com",
    "google drive": "https://drive.google.com",
    pinterest: "https://www.pinterest.com",
    awwwards: "https://www.awwwards.com",
    awards: "https://www.awwwards.com",
    behance: "https://www.behance.net",
    dribbble: "https://dribbble.com",
    mobbin: "https://mobbin.com",
    unsplash: "https://unsplash.com",
    pexels: "https://www.pexels.com",
    pixabay: "https://pixabay.com",
    canva: "https://www.canva.com",
    figma: "https://www.figma.com/community",
    linkedin: "https://www.linkedin.com",
    instagram: "https://www.instagram.com",
    x: "https://x.com",
    twitter: "https://x.com",
    reddit: "https://www.reddit.com",
    discord: "https://discord.com/app",
    amazon: "https://www.amazon.com",
    flipkart: "https://www.flipkart.com",
    stackoverflow: "https://stackoverflow.com",
    "stack overflow": "https://stackoverflow.com",
    mdn: "https://developer.mozilla.org",
    npm: "https://www.npmjs.com",
    steam: "https://store.steampowered.com",
    "epic games": "https://store.epicgames.com",
    roblox: "https://www.roblox.com",
    minecraft: "https://www.minecraft.net",
    crazygames: "https://www.crazygames.com",
    coursera: "https://www.coursera.org",
    udemy: "https://www.udemy.com",
    "google calendar": "https://calendar.google.com",
    calendar: "https://calendar.google.com",
    todoist: "https://todoist.com",
    miro: "https://miro.com/app",
    netflix: "https://www.netflix.com",
    spotify: "https://open.spotify.com"
  };

  const openMatch = cleaned.match(/^(?:open|go to|visit|launch|bring up|navigate to)\s+(.+)$/);
  if (openMatch) {
    const target = openMatch[1].replace(/^(the|my)\s+/, "").trim();
    const exactSite = /\s+(for|of|about)\s+/.test(target) ? null : findSiteAlias(target, siteAliases);
    if (exactSite) {
      return { tool: "open_url", args: { url: exactSite } };
    }
  }

  const definitionMatch = cleaned.match(/^(?:define|definition of|meaning of|what is the meaning of|what does)\s+(.+?)(?:\s+mean)?$/);
  if (definitionMatch) {
    const query = definitionMatch[1].replace(/^the word\s+/, "").trim();
    return { tool: "open_url", args: { url: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(query)}` } };
  }

  const wikiMatch = cleaned.match(/^(?:open|search|find|show)\s+(?:wikipedia|wiki)\s+(?:for\s+|about\s+)?(.+)$/);
  if (wikiMatch) {
    return { tool: "open_url", args: { url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(wikiMatch[1])}` } };
  }

  const imageMatch = cleaned.match(/^(?:show|find|search|open)\s+(?:images|photos|pictures|pics)\s+(?:of|for)?\s*(.+)$/);
  if (imageMatch) {
    return { tool: "open_url", args: { url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageMatch[1])}` } };
  }

  const googleImagesMatch = cleaned.match(/^(?:show|find|search|open)\s+google\s+images\s+(?:of|for)?\s*(.+)$/);
  if (googleImagesMatch) {
    return { tool: "open_url", args: { url: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(googleImagesMatch[1])}` } };
  }

  const pinterestMatch = cleaned.match(/^(?:show|find|search|open)\s+(?:pinterest|pinspiration)\s+(?:for\s+|of\s+)?(.+)$/);
  if (pinterestMatch) {
    return { tool: "open_url", args: { url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(pinterestMatch[1])}` } };
  }

  const inspirationSiteMatch = cleaned.match(/^(?:show|find|search|open)\s+(awwwards|behance|dribbble|mobbin|figma community|unsplash|pexels|pixabay)\s+(?:for\s+|of\s+|about\s+)?(.+)$/);
  if (inspirationSiteMatch) {
    const site = inspirationSiteMatch[1];
    const query = encodeURIComponent(inspirationSiteMatch[2]);
    const searchUrls = {
      awwwards: `https://www.awwwards.com/websites/?text=${query}`,
      behance: `https://www.behance.net/search/projects?search=${query}`,
      dribbble: `https://dribbble.com/search/${query}`,
      mobbin: `https://mobbin.com/search?q=${query}`,
      "figma community": `https://www.figma.com/community/search?query=${query}`,
      unsplash: `https://unsplash.com/s/photos/${query}`,
      pexels: `https://www.pexels.com/search/${query}/`,
      pixabay: `https://pixabay.com/images/search/${query}/`
    };
    return { tool: "open_url", args: { url: searchUrls[site] } };
  }

  const videoMatch = cleaned.match(/^(?:show|find|search|open|play)\s+(?:videos?|youtube videos?)\s+(?:of|for|about)?\s*(.+)$/);
  if (videoMatch) {
    return { tool: "youtube_search", args: { query: videoMatch[1] } };
  }

  const designMatch = cleaned.match(/^(?:find|show|search|open)\s+(?:design|ui|ux|website|web design|inspiration|references?)\s+(?:for|about|of)?\s*(.+)$/);
  if (designMatch) {
    return { tool: "open_url", args: { url: `https://www.awwwards.com/websites/?text=${encodeURIComponent(designMatch[1])}` } };
  }

  const bestRatedMatch = cleaned.match(/^(?:find|search|open|show)\s+(?:the\s+)?(?:best|top|highest rated|good rated|most good rated)\s+(.+)$/);
  if (bestRatedMatch) {
    return { tool: "google_search", args: { query: `${bestRatedMatch[1]} best rated trusted reviews` } };
  }
   
  if (lower === "open youtube" || lower === "get youtube on" || lower === "open yt" || lower === "bring up youtube") {
    return { tool: "open_url", args: { url: "https://www.youtube.com" } };
  }
  if (lower === "open github" || lower === "get github on") {
    return { tool: "open_url", args: { url: "https://www.github.com" } };
  }
  if (lower === "open chatgpt" || lower === "get chatgpt on") {
    return { tool: "open_url", args: { url: "https://chatgpt.com" } };
  }
  if (lower.startsWith("search google ")) {
    const query = command.substring(14).trim();
    return { tool: "google_search", args: { query } };
  }
  if (lower.startsWith("google search ")) {
    const query = command.substring(14).trim();
    return { tool: "google_search", args: { query } };
  }
  if (lower === "scroll down" || lower === "scroll down a bit") {
    return { tool: "scroll_down", args: {} };
  }
  if (lower === "scroll up") {
    return { tool: "scroll_up", args: {} };
  }
  if (lower === "go back") {
    return { tool: "go_back", args: {} };
  }
  if (lower === "click first result" || lower === "open first result") {
    return { tool: "click_link", args: { target: "first result" } };
  }
  if (lower === "open the best product" || lower === "open best product") {
    return { tool: "open_best_product", args: {} };
  }
  if (lower === "close tab" || lower === "close this tab") {
    return { tool: "close_current_tab", args: {} };
  }
  if (lower === "summarize page" || lower === "summarize this page" || lower === "summarize this webpage" || lower === "what is this page about") {
    return { tool: "summarize_page", args: {} };
  }
  if (lower.startsWith("go to ") && (lower.includes(":") || lower.includes("min") || lower.includes("sec") || lower.includes("second"))) {
    const ts = command.substring(6).trim();
    return { tool: "youtube_seek_to_timestamp", args: { timestamp: ts } };
  }
  if (lower === "show my youtube history" || lower === "open youtube history") {
    return { tool: "youtube_open_history", args: {} };
  }
  if (lower === "open my github profile" || lower === "open github profile") {
    return { tool: "open_profile", args: { site: "github" } };
  }

  return null; // Passes to Gemini Flash
}

const SMART_ROUTE_DEFINITIONS = {
  ecommerce: ["amazon", "flipkart", "youtube"],
  education: ["coursera", "youtube", "reddit"],
  dev: ["stackoverflow", "github", "mdn"],
  media: ["youtube", "spotify"],
  social: ["instagram", "x", "linkedin", "reddit", "discord"],
  productivity: ["notion", "google_docs", "google_calendar", "todoist", "miro"],
  research: ["google", "reddit", "github", "youtube"],
  games: ["steam", "epic_games", "roblox", "minecraft", "crazygames"],
  startup: ["crunchbase", "linkedin", "reddit"]
};

const SMART_ROUTE_SITES = {
  google: { label: "Google", url: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}` },
  reddit: { label: "Reddit", url: (query) => `https://www.reddit.com/search/?q=${encodeURIComponent(query)}` },
  github: { label: "GitHub", url: (query) => `https://github.com/search?q=${encodeURIComponent(query)}` },
  youtube: { label: "YouTube", url: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` },
  amazon: { label: "Amazon", url: (query) => buildMarketplaceUrl("amazon_india", query) },
  flipkart: { label: "Flipkart", url: (query) => buildMarketplaceUrl("flipkart", query) },
  stackoverflow: { label: "Stack Overflow", url: (query) => `https://stackoverflow.com/search?q=${encodeURIComponent(query)}` },
  mdn: { label: "MDN", url: (query) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}` },
  npm: { label: "npm", url: (query) => `https://www.npmjs.com/search?q=${encodeURIComponent(query)}` },
  crunchbase: { label: "Crunchbase", url: (query) => `https://www.crunchbase.com/discover/organization.companies/field/organizations/name/${encodeURIComponent(query)}` },
  linkedin: { label: "LinkedIn", url: (query) => `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}` },
  coursera: { label: "Coursera", url: (query) => `https://www.coursera.org/search?query=${encodeURIComponent(query)}` },
  steam: { label: "Steam", url: (query) => `https://store.steampowered.com/search/?term=${encodeURIComponent(query)}` },
  epic_games: { label: "Epic Games Store", url: (query) => `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(query)}&sortBy=relevancy&sortDir=DESC&count=40` },
  roblox: { label: "Roblox", url: () => "https://www.roblox.com" },
  minecraft: { label: "Minecraft", url: () => "https://www.minecraft.net" },
  crazygames: { label: "CrazyGames", url: (query) => `https://www.crazygames.com/search?q=${encodeURIComponent(query)}` },
  instagram: { label: "Instagram", url: () => "https://www.instagram.com" },
  x: { label: "X", url: () => "https://x.com" },
  discord: { label: "Discord", url: () => "https://discord.com/app" },
  spotify: { label: "Spotify", url: (query) => `https://open.spotify.com/search/${encodeURIComponent(query)}` },
  notion: { label: "Notion", url: () => "https://www.notion.so" },
  google_docs: { label: "Google Docs", url: () => "https://docs.google.com" },
  google_calendar: { label: "Google Calendar", url: () => "https://calendar.google.com" },
  todoist: { label: "Todoist", url: () => "https://todoist.com" },
  miro: { label: "Miro", url: () => "https://miro.com/app" }
};

function classifySmartRoute(command) {
  const lower = String(command || "").toLowerCase().trim();
  const query = cleanRouteQuery(command);

  if (/^(?:open|go to|launch|visit|bring up)\s+/.test(lower)) {
    return null;
  }

  if (/research\s+ai\s+tools?/.test(lower)) return smartRouteArgs("research", query || "AI tools", ["google", "reddit", "github", "youtube"]);
  if (/research\s+ai\s+browser\s+agents?/.test(lower)) return smartRouteArgs("research", query || "AI browser agents", ["google", "reddit", "github", "youtube"]);
  if (/startup research|research\s+(?:a\s+)?startup|competitor research|company research/.test(lower)) return smartRouteArgs("startup", query, SMART_ROUTE_DEFINITIONS.startup);
  if (/best\s+(?:online\s+)?course|find\s+.*course|learn\s+.*course/.test(lower)) return smartRouteArgs("education", query, SMART_ROUTE_DEFINITIONS.education);
  if (/coding help|debug|stackoverflow|stack overflow|mdn|developer docs/.test(lower)) return smartRouteArgs("dev", query, SMART_ROUTE_DEFINITIONS.dev);
  if (/react animation libraries|npm package|javascript library|js library|coding library|developer tool|api docs/.test(lower)) return smartRouteArgs("dev", query, ["google", "github", "npm", "mdn"]);
  if (/best laptop|gaming laptop|laptop under|phone under|best phone|headphones under/.test(lower)) return smartRouteArgs("ecommerce", query, SMART_ROUTE_DEFINITIONS.ecommerce);
  if (/play\s+.*(?:music|song|lofi|playlist)|relaxing lofi|watch\s+.*(?:video|movie|trailer)|entertainment/.test(lower)) return smartRouteArgs("media", query, SMART_ROUTE_DEFINITIONS.media);
  if (/(?:open|go to|launch)\s+(instagram|x|twitter|linkedin|reddit|discord)\b/.test(lower)) return null;
  if (/(?:post|message|dm|community|social|microblog|professional network)\b/.test(lower)) return smartRouteArgs("social", query, SMART_ROUTE_DEFINITIONS.social);
  if (/(?:notes?|docs?|calendar|tasks?|todo|whiteboard|workspace|productivity)\b/.test(lower)) return smartRouteArgs("productivity", query, SMART_ROUTE_DEFINITIONS.productivity);
  if (/(?:pc games?|epic games?|roblox|minecraft|browser games?|crazygames|steam)\b/.test(lower)) return smartRouteArgs("games", query, SMART_ROUTE_DEFINITIONS.games);
  if (/^research\b/.test(lower)) return smartRouteArgs("research", query, SMART_ROUTE_DEFINITIONS.research);

  return null;
}

function cleanRouteQuery(command) {
  return String(command || "")
    .replace(/^sidekick\s+/i, "")
    .replace(/^(?:find|search|open|show|play|research|compare|best|look up|help me find)\s+/i, "")
    .replace(/\b(?:on|in)\s+(?:google|reddit|github|youtube|amazon|flipkart|coursera|linkedin|stackoverflow|stack overflow|mdn|npm)\b/ig, "")
    .trim();
}

function smartRouteArgs(intent, query, route) {
  const safeQuery = query || intent;
  return {
    intent,
    query: safeQuery,
    route,
    routeLabels: route.map((site) => SMART_ROUTE_SITES[site]?.label || site)
  };
}

function extractUrl(text) {
  const match = String(text || "").match(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/i);
  if (!match) return null;
  const raw = match[1];
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function findSiteAlias(target, aliases) {
  if (aliases[target]) return aliases[target];
  const normalized = target.replace(/\s+(website|site|app|homepage|page)$/i, "").trim();
  if (aliases[normalized]) return aliases[normalized];
  const key = Object.keys(aliases).find(alias => normalized === alias || normalized.includes(alias));
  return key ? aliases[key] : null;
}

const INDIA_MARKETPLACE_ROUTES = {
  amazon_india: { platform: "Amazon India", url: "https://www.amazon.in/s?k=" },
  flipkart: { platform: "Flipkart", url: "https://www.flipkart.com/search?q=" },
  meesho: { platform: "Meesho", url: "https://www.meesho.com/search?q=" },
  tatacliq: { platform: "Tata CLiQ", url: "https://www.tatacliq.com/search/?searchCategory=all&text=" },
  croma: { platform: "Croma", url: "https://www.croma.com/searchB?q=" },
  reliance_digital: { platform: "Reliance Digital", url: "https://www.reliancedigital.in/search?q=" },
  vijay_sales: { platform: "Vijay Sales", url: "https://www.vijaysales.com/search/" },
  myntra: { platform: "Myntra", url: "https://www.myntra.com/" },
  ajio: { platform: "Ajio", url: "https://www.ajio.com/search/?text=" },
  nykaa_fashion: { platform: "Nykaa Fashion", url: "https://www.nykaafashion.com/catalogsearch/result/?q=" },
  hm_india: { platform: "H&M India", url: "https://www2.hm.com/en_in/search-results.html?q=" },
  zara_india: { platform: "Zara India", url: "https://www.zara.com/in/en/search?searchTerm=" },
  ikea_india: { platform: "IKEA India", url: "https://www.ikea.com/in/en/search/?q=" },
  pepperfry: { platform: "Pepperfry", url: "https://www.pepperfry.com/site_product/search?q=" }
};

function detectShoppingIntent(command) {
  const lower = String(command || "").toLowerCase();
  return /(buy|best deal|cheapest|under\s+\d|under\s+₹|price|laptop|shoes|hoodie|t-shirt|clothes|phone|headphones|keyboard|compare products|running shoes|deal)/.test(lower);
}

function inferShoppingCategory(command) {
  const lower = String(command || "").toLowerCase();
  if (/(laptop|phone|iphone|keyboard|headphones|electronics|gaming)/.test(lower)) return "electronics";
  if (/(hoodie|t-shirt|shirt|fashion|clothes|jeans|jacket)/.test(lower)) return "fashion";
  if (/(shoes|running shoes|sneakers)/.test(lower)) return "shoes";
  if (/(beauty|makeup|skin|cosmetic)/.test(lower)) return "beauty";
  if (/(sofa|chair|table|home|furniture)/.test(lower)) return "home";
  if (/(book|novel|books)/.test(lower)) return "books";
  return "general";
}

function chooseMarketplaceForCommand(command) {
  const lower = String(command || "").toLowerCase();
  const query = String(command || "").replace(/^sidekick\s+/i, "").trim();
  if (lower.includes("myntra")) return { tool: "myntra_search", args: { query: query.replace(/myntra/ig, "").trim() || query } };
  if (lower.includes("ajio")) return { tool: "ajio_search", args: { query: query.replace(/ajio/ig, "").trim() || query } };
  if (lower.includes("flipkart")) return { tool: "flipkart_search", args: { query: query.replace(/flipkart/ig, "").trim() || query } };
  if (lower.includes("amazon")) return { tool: "amazon_search", args: { query: query.replace(/amazon/ig, "").trim() || query } };
  if (lower.includes("croma")) return { tool: "croma_search", args: { query: query.replace(/croma/ig, "").trim() || query } };

  const category = inferShoppingCategory(command);
  if (category === "electronics") return { tool: /under\s+\d|deal|cheap|budget/.test(lower) ? "flipkart_search" : "amazon_search", args: { query } };
  if (category === "fashion" || category === "shoes") return { tool: "myntra_search", args: { query } };
  if (category === "beauty") return { tool: "open_marketplace", args: { platform: "nykaa_fashion", query } };
  if (category === "home") return { tool: "open_marketplace", args: { platform: "ikea_india", query } };
  if (category === "books") return { tool: "amazon_search", args: { query } };
  return { tool: "amazon_search", args: { query } };
}

function compactText(value, max = 800) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

// Call Gemini API securely
async function callGemini(apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null, options = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const contents = [];
  for (const turn of history) {
    contents.push({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }]
    });
  }
  
  contents.push({
    role: "user",
    parts: [{ text: retryPrompt ? retryPrompt : userPrompt }]
  });

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      responseMimeType: options.jsonMode === false ? undefined : "application/json",
      maxOutputTokens: options.maxTokens || TOOL_CALL_MAX_TOKENS,
      temperature: options.temperature ?? 0.2
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Received empty response from Gemini Flash");
  }
  return text.trim();
}

async function callClaude(apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null, options = {}) {
  const messages = history.map(turn => ({
    role: turn.role === "user" ? "user" : "assistant",
    content: turn.text
  }));

  messages.push({
    role: "user",
    content: retryPrompt ? retryPrompt : userPrompt
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      system: systemPrompt,
      max_tokens: options.maxTokens || TOOL_CALL_MAX_TOKENS,
      messages
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.find(part => part.type === "text")?.text;
  if (!text) {
    throw new Error("Received empty response from Claude");
  }
  return text.trim();
}

// Fetch tool with JSONMode & repair retry
async function fetchNextTool(systemPrompt, userPrompt, history) {
  let responseText = await callLLM(systemPrompt, userPrompt, history, null, { maxTokens: TOOL_CALL_MAX_TOKENS });
  try {
    const parsed = JSON.parse(extractJsonObject(responseText));
    if (!parsed.tool) {
      throw new Error("Missing 'tool' property in JSON");
    }
    return parsed;
  } catch (err) {
    logAction("JSON parsing failed, retrying with repair instructions...", "warning");
    const repairPrompt = `Your previous response failed to parse as valid JSON. Ensure that you return ONLY valid JSON matching the format: {"tool": "tool_name", "args": {...}}. Never output backticks (\`\`\`) or comments outside JSON.
Error encountered: ${err.message}
Your previous response was:
${responseText}`;
    const retryText = await callLLM(systemPrompt, userPrompt, history, repairPrompt, { maxTokens: REPAIR_MAX_TOKENS });
    try {
      const parsed = JSON.parse(extractJsonObject(retryText));
      if (!parsed.tool) throw new Error("Missing 'tool' property in retry JSON");
      return parsed;
    } catch (finalErr) {
      throw new Error(`Failed to parse Gemini output as JSON after retry. Details: ${finalErr.message}`);
    }
  }
}

// Local chunking compressor for long pages to prevent token limits
async function localChunkAndSummarize(pageText) {
  if (pageText.length <= 4000) {
    return askLLMToDigest("Summarize this webpage simple and clear in 2-3 short bullet points:", pageText);
  }
  
  // Split into chunks of 4000 characters
  const chunks = [];
  for (let i = 0; i < pageText.length; i += 4000) {
    chunks.push(pageText.substring(i, i + 4000));
  }
  
  logAction(`Page text is long (${pageText.length} chars). Summarizing in ${chunks.length} chunks...`, "info");
  
  const chunkSummaries = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    const sum = await askLLMToDigest(`Summarize part ${idx + 1} of the webpage:`, chunks[idx]);
    chunkSummaries.push(sum);
  }
  
  const merged = chunkSummaries.join("\n\n");
  const finalSummary = await askLLMToDigest("Consolidate the following section summaries into a single cohesive, high-quality, brief bulleted summary:", merged);
  return finalSummary;
}

// Main logic coordinator
async function startAgentLoop(command, options = {}) {
  const config = await getProviderConfig();
  await updateVoiceState({ mode: "processing", transcript: command, error: null });
  try {
    await rememberSidekickCommand(command, options.source || "text");
  } catch (err) {
    // Memory should never block task execution.
  }
  
  if (config.aiMode === "api") {
    let hasAnyKey = false;
    for (const provider of config.providerPriority) {
      if (config.apiKeys[provider]) {
        hasAnyKey = true;
        break;
      }
    }
    if (!hasAnyKey) {
      stopAgentLoop("No API keys configured. Go to Settings to add one.", true);
      return;
    }
  } else if (config.aiMode === "ollama") {
    const status = await checkOllamaStatus();
    if (!status.connected) {
      stopAgentLoop(`Local AI is not connected: ${status.error || "Ollama offline"}`, true);
      return;
    }
  }

  // Initialize task metadata and persist
  const taskId = `task_${Date.now()}`;
  const startTs = Date.now();
  const tab = await getTargetTab();
  await updateState({
    taskId,
    command,
    provider: config.aiMode === "ollama" ? "ollama" : config.providerPriority.find(provider => config.apiKeys[provider]) || null,
    activeTabId: tab?.id || null,
    isRunning: true,
    currentStep: 0,
    logs: [],
    result: null,
    currentAction: "Initializing agent...",
    askUserQuestion: null,
    suggestedFollowup: null,
    history: [],
    isFirstStepOfTask: true,
    sessionTabId: null,
    startedAt: startTs
  });

  logAction(`Starting agent: "${command}"`, "info");
  scheduleNextStep(0);
}

// Resume loop with user feedback
async function resumeAgentWithResponse(response) {
  logAction(`User response: "${response}"`, "info");
  
  activeState.history.push({
    role: "user",
    text: `User confirmation/details: ${compactText(response, 400)}`
  });

  // Keep history short to reduce tokens while preserving recent recovery context.
  if (activeState.history.length > MAX_HISTORY_MESSAGES) {
    activeState.history = activeState.history.slice(-MAX_HISTORY_MESSAGES);
  }

  await updateState({
    askUserQuestion: null,
    isRunning: true,
    currentAction: "Resuming agent loop..."
  });

  scheduleNextStep(0);
}

// Execute the loop
async function runNextStep() {
  if (!activeState.isRunning) return;

  if (activeState.currentStep >= activeState.maxSteps) {
    stopAgentLoop("Reached maximum step limit (8 steps). Stopping.", true);
    return;
  }

  activeState.currentStep += 1;
  await updateState({ currentAction: `Step ${activeState.currentStep}: Formulating context...` });

  // 1. Cheap Local Routing Check on First Step
  if (activeState.currentStep === 1) {
    const localChoice = tryLocalRouting(activeState.command);
    if (localChoice) {
      logAction(`Local Router matched action: ${localChoice.tool}`, "success");
      await updateState({ currentAction: `Step ${activeState.currentStep}: Executing ${localChoice.tool}...` });
      try {
        const result = await executeTool(localChoice.tool, localChoice.args);
        if (localChoice.tool === "summarize_page" && result.success) {
          stopAgentLoop(result.data);
        } else {
          await maybeQueueFollowup(activeState.command, result?.data || "Done.");
          stopAgentLoop(result?.data || "Done.");
        }
      } catch (err) {
        logAction(`Local routing execution failed: ${err.message}. Falling back to Gemini.`, "warning");
      }
      return;
    }
  }

  // 2. Fetch context of currently target/active tab (optimized tiny context)
  let tab = null;
  let context = { url: "", title: "", visibleText: "No active tab context available", buttons: [], links: [], searchResults: [], inputs: [], headings: [] };
  
  try {
    tab = await getTargetTab();
    if (tab && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
      await ensureContentScriptInTab(tab.id);
      const res = await delegateToContent("GET_PAGE_CONTEXT", {}, tab.id);
      if (res && res.success) {
        context = res.data;
      }
      const searchResultsRes = await delegateToContent("GET_SEARCH_RESULTS", {}, tab.id);
      if (searchResultsRes?.success) {
        context.searchResults = searchResultsRes.data || [];
      }
    }
  } catch (err) {
    context.visibleText = `Context extraction error: ${err.message}`;
  }

  // Optimize context: check if page exists in memory Cache to bypass re-reading
  if (context.url && pageCache[context.url]) {
    context.pageSummary = pageCache[context.url].summary;
    // Don't send raw page text if summary is already cached!
    context.visibleText = "PAGE CONTENT RESIDES IN MEMORY CACHE. SUMMARY: " + context.pageSummary;
  }

  if (activeState.currentStep === 1) {
    try {
      const memory = await getSidekickMemory();
      const followup = shouldAskSidekickFollowup({
        command: activeState.command,
        memory,
        context: { hasReadablePage: Boolean(context.url) }
      });
      if (followup?.when === "before_ambiguous") {
        await updateVoiceState({ mode: "idle", lastResponse: followup.question });
        await updateState({
          isRunning: false,
          currentAction: "Waiting for user input...",
          askUserQuestion: followup.question,
          suggestedFollowup: followup
        });
        logAction(`Asked user: "${followup.question}"`, "info");
        return;
      }
    } catch (err) {
      // Follow-up engine is opportunistic.
    }
  }

  // 3. Prepare user prompt containing Tiny Context & Compact Element Indexing
  const lastLogs = activeState.logs.slice(0, 3).map(l => `[${l.type}] ${l.message}`).join("\n");
  const userPrompt = `USER REQUEST: "${activeState.command}"
CURRENT TAB INFO:
URL: ${context.url || "none"}
Title: ${context.title || "none"}

COMPACT ELEMENT INDEXES (TOKEN CAPPED):
Buttons (max 20): ${JSON.stringify(context.buttons || [])}
Inputs (max 12): ${JSON.stringify(context.inputs || [])}
Links (max 20): ${JSON.stringify(context.links || [])}
Search results (max 20): ${JSON.stringify(context.searchResults || [])}
Headings: ${JSON.stringify(context.headings || [])}

LAST 3 AGENT ACTIONS:
${lastLogs || "None"}

Please choose exactly ONE next tool call to solve the user's request.`;

  // 4. Gemini Reasoning Prompt
  await updateState({ currentAction: `Step ${activeState.currentStep}: Reasoning...` });
  logAction(`Step ${activeState.currentStep}: Deciding next action...`, "info");

  const systemPrompt = `You are Sidekick, a voice-first browser agent. Return exactly one compact JSON object: {"tool":"name","args":{}}. No markdown or explanation.
Use only these tools:
nav: open_url,new_tab,open_task_in_new_tab,close_current_tab,close_tab,close_window,reload_page,go_back,go_forward,get_current_url,get_page_title,list_windows,list_tabs,switch_to_tab,duplicate_current_tab,open_marketplace,smart_route
search: google_search,youtube_search,github_search,maps_search,site_search,open_profile,amazon_search,flipkart_search,myntra_search,ajio_search,croma_search
page: get_page_context,get_page_text,get_links,get_search_results,get_buttons,get_inputs,get_headings,get_images,find_text_on_page,click_text,click_link,click_button,click_input,hover_text,double_click_text,scroll_down,scroll_up,scroll_to_top,scroll_to_bottom,press_enter,press_key
input: type_text,clear_input,paste_text,select_dropdown,check_checkbox,uncheck_checkbox,select_all
form: detect_form,get_form_fields,fill_field,select_option,check_box,uncheck_box,choose_radio,clear_field,review_form,submit_form
writing: write_text,rewrite_selected_text,fix_grammar_selected_text,shorten_selected_text,expand_selected_text,change_tone_selected_text,insert_bullet_points,continue_writing,replace_selected_text
commerce: extract_product_cards,extract_prices,compare_prices,find_best_value_item,sort_items_by_price,extract_reviews,extract_ratings,compare_products,open_best_product,open_product_by_id
youtube: youtube_seek_to_timestamp,youtube_get_current_timestamp,youtube_get_video_title,youtube_open_history,youtube_open_profile,youtube_open_subscriptions,youtube_open_watch_later
extract: extract_table,extract_emails,extract_phone_numbers,extract_links,extract_headings,extract_dates,extract_jobs,extract_courses,extract_events,extract_contact_info
digest: summarize_page,extract_notes,answer_from_page,compare_page_items
browser: zoom_in,zoom_out,reset_zoom,scroll_to_text,highlight_text,open_link_by_text,open_downloads,open_history,open_bookmarks
utility: wait,copy_current_url,copy_selected_text,ask_user,done

Rules: choose one next action; use sk-* ids, visible text, visible search results, or product ids from current page tools; never invent page elements or call a tool with missing required args. If a link is needed, choose from visible links or search results. Ask_user only if genuinely ambiguous or risky. Risky: payment,purchase,delete,submit/send/post,password/login,account settings,suspicious downloads.
Forms: detect_form first, then get_form_fields, then fill one field at a time. Ask short questions for missing form values. Never submit_form until the user clearly confirms submission. Ask clearly before filling sensitive fields: password, payment, address, phone number, government ID.
Writing: for rewrite/fix/shorten/expand/tone commands, operate on selected text when possible. Before replacing selected text use replace_selected_text so an undo copy is stored. Writing modes include Formal, Friendly, Short, Professional, Gen Z casual, Sales copy, Simple language, Academic, Startup pitch.
Scraping: extract only visible public page data. Do not bypass logins, paywalls, CAPTCHAs, or site restrictions.
Zoom: only zoom if the user asks for zoom/readability help.
Navigation brain: classify intent before search. shopping -> ecommerce routes, learning -> education, coding -> dev, entertainment -> media, social -> social platforms, productivity -> workspace apps, research -> multi-source search. Known site/app or URL -> open_url. Best/top/rated/good link -> google_search or direct marketplace search, then use get_search_results/get_links/click_link/open_best_product. Definitions -> Merriam-Webster/Wikipedia/Britannica via search/open. Videos/tutorials -> youtube_search. Notes/docs/files -> Keep/Docs/Drive/Notion. Places/nearby -> maps_search.
Research routing: AI tools or broad research -> Google, Reddit, GitHub, YouTube. Best laptop -> Amazon, Flipkart, YouTube reviews. Coding help -> Stack Overflow, GitHub, MDN. Startup research -> Crunchbase, LinkedIn, Reddit. Best course -> Coursera, YouTube, Reddit.
Shopping brain: prefer direct marketplace search over generic Google search. Use Amazon India/Flipkart/Croma for electronics, Myntra/Ajio for fashion and shoes, Nykaa for beauty, IKEA/Pepperfry for home. Compare visible products using price, rating, reviews, and relevance. Do not claim something is best unless visible data supports it.
Completion: {"tool":"done","args":{"message":"short result"}}.`;

  const config = await getProviderConfig();
  let choice = null;
  try {
    choice = await fetchNextToolWithProvider(systemPrompt, userPrompt, activeState.history);
  } catch (err) {
    stopAgentLoop(`LLM failed: ${err.message}`, true);
    return;
  }

  // Save choices to short history (max 3 steps of interaction kept)
  activeState.history.push({
    role: "model",
    text: compactText(choice, 300)
  });

  if (activeState.history.length > MAX_HISTORY_MESSAGES) {
    activeState.history = activeState.history.slice(-MAX_HISTORY_MESSAGES);
  }

  await updateState({ currentAction: `Step ${activeState.currentStep}: Executing ${choice.tool}...` });
  logAction(`${config.aiMode === "ollama" ? "Ollama" : "LLM"} chose tool: ${choice.tool}`, "info");

  // 5. Execute Tool
  let result = null;
  try {
    result = await executeTool(choice.tool, choice.args);
    if (result && result.success === false && /Missing link target|Missing search query|Missing marketplace target/i.test(result.error || "")) {
      throw new Error(result.error);
    }
  } catch (err) {
    logAction(`Tool execution error: ${err.message}. Retrying step...`, "warning");
    activeState.history.push({
      role: "user",
      text: `Error executing ${choice.tool}: ${compactText(err.message, 300)}. Please try an alternative tool.`
    });
    try {
      choice = await fetchNextToolWithProvider(systemPrompt, userPrompt, activeState.history);
      result = await executeTool(choice.tool, choice.args);
      if (result && result.success === false && /Missing link target|Missing search query|Missing marketplace target/i.test(result.error || "")) {
        throw new Error(result.error);
      }
    } catch (retryErr) {
      if (/Missing link target|Missing search query|Missing marketplace target/i.test(retryErr.message || "")) {
        await updateVoiceState({ mode: "idle", lastResponse: "Which result should I open?" });
        await updateState({
          isRunning: false,
          currentAction: "Waiting for user input...",
          askUserQuestion: "Which result should I open?"
        });
        return;
      }
      stopAgentLoop(`Execution failed twice. Details: ${retryErr.message}`, true);
      return;
    }
  }

  // 6. Handle Done / Clarifications
  if (choice.tool === "done") {
    await maybeQueueFollowup(activeState.command, choice.args?.message || "Done.");
    stopAgentLoop(choice.args?.message || "Task completed!");
    return;
  }

  if (choice.tool === "ask_user") {
    await updateVoiceState({ mode: "idle", lastResponse: choice.args?.question || "Please clarify." });
    await updateState({
      isRunning: false,
      currentAction: "Waiting for user input...",
      askUserQuestion: choice.args?.question || "Please clarify."
    });
    logAction(`Asked user: "${choice.args?.question}"`, "info");
    return;
  }

  if (result?.requiresConfirmation) {
    await updateVoiceState({ mode: "idle", lastResponse: result.question || "Please confirm before I continue." });
    await updateState({
      isRunning: false,
      currentAction: "Waiting for confirmation...",
      askUserQuestion: result.question || "Please confirm before I continue."
    });
    logAction(`Asked confirmation: "${result.question || "Please confirm."}"`, "info");
    return;
  }

  // Log result
  if (result && result.success) {
    logAction(`Executed ${choice.tool} successfully`, "success");
    activeState.history.push({
      role: "user",
      text: `Tool result: ${compactText(result.data || "success", 700)}`
    });
  } else {
    logAction(`Tool ${choice.tool} warning: ${result?.error || "unsuccessful"}`, "warning");
    activeState.history.push({
      role: "user",
      text: `Tool result warning: ${compactText(result?.error || "failed", 300)}`
    });
  }

  scheduleNextStep();
}

// Secure clipboard copy helper via scripting
async function copyToTabClipboard(text, tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (val) => {
      navigator.clipboard.writeText(val).catch(() => {});
    },
    args: [text]
  });
}

function validateLinkArgs(args = {}) {
  if (!args.url && !args.target && !args.id && !args.query) {
    return {
      success: false,
      error: "Missing link target. Ask LLM to choose a visible link or search result."
    };
  }
  return null;
}

function hasRecentUserConfirmation(pattern = /confirm|yes|submit|send|post|go ahead|do it/i) {
  return activeState.history.some((turn) => turn.role === "user" && pattern.test(String(turn.text || "")));
}

function isSensitiveFormField(field = {}) {
  const text = `${field.label || ""} ${field.type || ""} ${field.name || ""} ${field.placeholder || ""}`.toLowerCase();
  return Boolean(field.sensitive || /(password|passcode|card|cvv|cvc|payment|address|phone|mobile|aadhaar|aadhar|pan|ssn|government|passport|license)/.test(text));
}

function buildMarketplaceUrl(platformKey, query = "") {
  const normalizedKey = String(platformKey || "").toLowerCase().replace(/\s+/g, "_");
  const aliasMap = {
    amazon: "amazon_india",
    "amazon_india": "amazon_india",
    flipkart: "flipkart",
    myntra: "myntra",
    ajio: "ajio",
    croma: "croma",
    meesho: "meesho",
    tatacliq: "tatacliq",
    "tata_cliq": "tatacliq",
    nykaa: "nykaa_fashion",
    "nykaa_fashion": "nykaa_fashion",
    ikea: "ikea_india",
    "ikea_india": "ikea_india"
  };
  const route = INDIA_MARKETPLACE_ROUTES[aliasMap[normalizedKey] || normalizedKey];
  if (!route) return null;
  return `${route.url}${encodeURIComponent(query)}`;
}

function buildSmartRouteUrl(args = {}) {
  const route = Array.isArray(args.route) && args.route.length ? args.route : SMART_ROUTE_DEFINITIONS[args.intent] || ["google"];
  const firstSite = route[0];
  const site = SMART_ROUTE_SITES[firstSite] || SMART_ROUTE_SITES.google;
  const query = args.query || args.intent || "";
  return site.url(query);
}

// Router of the 65+ browser tools
async function executeTool(toolName, args = {}) {
  let targetTab = await getTargetTab();
  let tabId = targetTab?.id;

  // Workspace Safeguard: If first step of a brand new task demands navigation/search,
  // we open a new tab by default instead of overwriting the user's active page!
  const isNavigational = [
    "open_url", "google_search", "youtube_search", "github_search", 
    "maps_search", "site_search", "open_profile", "youtube_open_history",
    "youtube_open_subscriptions", "youtube_open_watch_later", "open_marketplace",
    "amazon_search", "flipkart_search", "myntra_search", "ajio_search", "croma_search",
    "smart_route"
  ].includes(toolName);

  if (isNavigational && activeState.isFirstStepOfTask) {
    logAction(`New task detected. Isolating session to a new tab to protect workspace.`, "info");
    // Resolve URL to open
    let targetUrl = "https://www.google.com";
    if (toolName === "open_url") targetUrl = args.url;
    else if (toolName === "google_search") targetUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
    else if (toolName === "youtube_search") targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
    else if (toolName === "github_search") targetUrl = `https://github.com/search?q=${encodeURIComponent(args.query)}`;
    else if (toolName === "maps_search") targetUrl = `https://www.google.com/maps/search/${encodeURIComponent(args.query)}`;
    else if (toolName === "site_search") targetUrl = `https://www.google.com/search?q=site:${args.site}+${encodeURIComponent(args.query)}`;
    else if (toolName === "open_marketplace") targetUrl = buildMarketplaceUrl(args.platform, args.query || "");
    else if (toolName === "smart_route") targetUrl = buildSmartRouteUrl(args);
    else if (toolName === "amazon_search") targetUrl = buildMarketplaceUrl("amazon_india", args.query);
    else if (toolName === "flipkart_search") targetUrl = buildMarketplaceUrl("flipkart", args.query);
    else if (toolName === "myntra_search") targetUrl = buildMarketplaceUrl("myntra", args.query);
    else if (toolName === "ajio_search") targetUrl = buildMarketplaceUrl("ajio", args.query);
    else if (toolName === "croma_search") targetUrl = buildMarketplaceUrl("croma", args.query);
    else if (toolName === "youtube_open_history") targetUrl = `https://www.youtube.com/feed/history`;
    else if (toolName === "youtube_open_subscriptions") targetUrl = `https://www.youtube.com/feed/subscriptions`;
    else if (toolName === "youtube_open_watch_later") targetUrl = `https://www.youtube.com/playlist?list=WL`;
    else if (toolName === "open_profile") {
      const siteMap = {
        github: "https://github.com/settings/profile",
        google: "https://myaccount.google.com",
        youtube: "https://www.youtube.com/feed/you",
        chatgpt: "https://chatgpt.com",
        linkedin: "https://www.linkedin.com/in/me/"
      };
      targetUrl = siteMap[args.site.toLowerCase()] || `https://www.google.com`;
    }

    const isolatedTab = await chrome.tabs.create({ url: targetUrl });
    activeState.sessionTabId = isolatedTab.id;
    activeState.isFirstStepOfTask = false;
    await updateState({});
    await new Promise(r => setTimeout(r, 2000));
    if (toolName === "smart_route") {
      const labels = (args.routeLabels || args.route || []).join(" -> ");
      return { success: true, data: `Opened ${args.intent || "smart"} route for "${args.query || ""}". Route: ${labels}. Continue with the next route source when useful.` };
    }
    return { success: true, data: `Isolated workspace in new tab. Opened: ${targetUrl}` };
  }

  // Safeguard Close confirmation interceptor
  if (toolName === "close_other_tabs") {
    const isConfirmed = activeState.history.some(h => h.role === "user" && h.text.toLowerCase().includes("confirm close"));
    if (!isConfirmed) {
      // Prompt user
      return {
        success: true,
        data: {
          tool: "ask_user",
          args: {
            question: "Confirm closing all other tabs? Type 'confirm close' to proceed, or 'cancel'."
          }
        }
      };
    }
  }

  // Execution router
  switch (toolName) {
    case "open_url": {
      const invalid = validateLinkArgs(args);
      if (invalid) return invalid;
      if (tabId) {
        await chrome.tabs.update(tabId, { url: args.url });
      } else {
        const created = await chrome.tabs.create({ url: args.url });
        activeState.sessionTabId = created.id;
        await updateState({});
      }
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Opened URL: ${args.url}` };
    }

    case "new_tab":
    case "open_task_in_new_tab": {
      const created = await chrome.tabs.create({ url: args.url || "https://www.google.com" });
      activeState.sessionTabId = created.id;
      await updateState({});
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Isolated new tab with ID: ${created.id}` };
    }

    case "close_current_tab":
    case "close_tab": {
      if (tabId) {
        await chrome.tabs.remove(tabId);
        if (activeState.sessionTabId === tabId) {
          activeState.sessionTabId = null;
          await updateState({});
        }
        return { success: true, data: "Closed active tab" };
      }
      throw new Error("No tab active to close");
    }

    case "close_window": {
      const win = await chrome.windows.getCurrent();
      await chrome.windows.remove(win.id);
      return { success: true, data: "Closed window" };
    }

    case "list_windows": {
      const list = await chrome.windows.getAll({ populate: true });
      const mapped = list.map(w => ({ id: w.id, tabsCount: w.tabs?.length || 0 }));
      return { success: true, data: mapped };
    }

    case "list_tabs": {
      const list = await chrome.tabs.query({ currentWindow: true });
      const mapped = list.map(t => ({ id: t.id, title: t.title, url: t.url }));
      return { success: true, data: mapped };
    }

    case "switch_to_tab": {
      const list = await chrome.tabs.query({ currentWindow: true });
      const match = list.find(t => 
        (t.title && t.title.toLowerCase().includes(args.query.toLowerCase())) || 
        (t.url && t.url.toLowerCase().includes(args.query.toLowerCase()))
      );
      if (match) {
        await chrome.tabs.update(match.id, { active: true });
        activeState.sessionTabId = match.id;
        await updateState({});
        return { success: true, data: `Focused tab: ${match.title}` };
      }
      throw new Error(`Tab matching query "${args.query}" not found`);
    }

    case "duplicate_current_tab": {
      if (tabId) {
        const dup = await chrome.tabs.duplicate(tabId);
        return { success: true, data: `Duplicated tab: ${dup.id}` };
      }
      throw new Error("No active tab to duplicate");
    }

    case "get_current_url": {
      if (targetTab?.url) {
        return { success: true, data: targetTab.url };
      }
      throw new Error("No active tab URL available");
    }

    case "get_page_title": {
      if (targetTab?.title) {
        return { success: true, data: targetTab.title };
      }
      throw new Error("No active tab title available");
    }

    case "reload_page": {
      if (tabId) {
        await chrome.tabs.reload(tabId);
        await new Promise(r => setTimeout(r, 1500));
        return { success: true, data: "Page reloaded" };
      }
      throw new Error("No tab active");
    }

    case "go_back": {
      if (tabId) {
        await chrome.tabs.goBack(tabId);
        await new Promise(r => setTimeout(r, 1500));
        return { success: true, data: "History back" };
      }
      throw new Error("No active tab");
    }

    case "go_forward": {
      if (tabId) {
        await chrome.tabs.goForward(tabId);
        await new Promise(r => setTimeout(r, 1500));
        return { success: true, data: "History forward" };
      }
      throw new Error("No active tab");
    }

    case "google_search": {
      if (!args.query) return { success: false, error: "Missing link target. Ask LLM to choose a visible link or search result." };
      const u = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching Google for: ${args.query}` };
    }

    case "youtube_search": {
      if (!args.query) return { success: false, error: "Missing search query." };
      const u = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching YouTube for: ${args.query}` };
    }

    case "github_search": {
      if (!args.query) return { success: false, error: "Missing search query." };
      const u = `https://github.com/search?q=${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching GitHub for: ${args.query}` };
    }

    case "maps_search": {
      if (!args.query) return { success: false, error: "Missing search query." };
      const u = `https://www.google.com/maps/search/${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching Maps for: ${args.query}` };
    }

    case "site_search": {
      if (!args.site || !args.query) return { success: false, error: "Missing link target. Ask LLM to choose a visible link or search result." };
      const u = `https://www.google.com/search?q=site:${args.site}+${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching ${args.site} for: ${args.query}` };
    }

    case "smart_route": {
      const url = buildSmartRouteUrl(args);
      if (!url) return { success: false, error: "Missing smart route target." };
      const labels = (args.routeLabels || args.route || []).join(" -> ");
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2200));
      return {
        success: true,
        data: `Opened ${args.intent || "smart"} route for "${args.query || ""}". Route: ${labels}. Continue with the next route source when useful.`
      };
    }

    case "open_marketplace": {
      const url = buildMarketplaceUrl(args.platform, args.query || "");
      if (!url) return { success: false, error: "Missing marketplace target." };
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Opened ${INDIA_MARKETPLACE_ROUTES[args.platform]?.platform || args.platform}` };
    }

    case "amazon_search":
    case "flipkart_search":
    case "myntra_search":
    case "ajio_search":
    case "croma_search": {
      if (!args.query) return { success: false, error: "Missing search query." };
      const platformKeyMap = {
        amazon_search: "amazon_india",
        flipkart_search: "flipkart",
        myntra_search: "myntra",
        ajio_search: "ajio",
        croma_search: "croma"
      };
      const platformKey = platformKeyMap[toolName];
      const url = buildMarketplaceUrl(platformKey, args.query);
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2200));
      return { success: true, data: `Searching ${INDIA_MARKETPLACE_ROUTES[platformKey].platform} for: ${args.query}` };
    }

    case "open_profile": {
      const siteMap = {
        github: "https://github.com/settings/profile",
        google: "https://myaccount.google.com",
        youtube: "https://www.youtube.com/feed/you",
        chatgpt: "https://chatgpt.com",
        linkedin: "https://www.linkedin.com/in/me/"
      };
      const url = siteMap[args.site.toLowerCase()] || `https://www.google.com`;
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Opened profile: ${args.site}` };
    }

    case "youtube_open_history": {
      const url = "https://www.youtube.com/feed/history";
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2000));
      
      // Check login status via content script
      const loginCheck = await delegateToContent("YOUTUBE_CHECK_LOGIN", {}, tabId || activeState.sessionTabId);
      if (loginCheck && loginCheck.success && !loginCheck.data) {
        return {
          success: true,
          data: {
            tool: "ask_user",
            args: { question: "Please log in to your YouTube account in the isolated tab, then type 'logged in' so I can proceed." }
          }
        };
      }
      return { success: true, data: "Opened watch history" };
    }

    case "youtube_open_profile": {
      const url = "https://www.youtube.com/feed/you";
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: "Opened YouTube library" };
    }

    case "youtube_open_subscriptions": {
      const url = "https://www.youtube.com/feed/subscriptions";
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: "Opened YouTube subscriptions" };
    }

    case "youtube_open_watch_later": {
      const url = "https://www.youtube.com/playlist?list=WL";
      if (tabId) await chrome.tabs.update(tabId, { url });
      else await chrome.tabs.create({ url });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: "Opened watch later playlist" };
    }

    case "summarize_page": {
      if (tabId) {
        const textRes = await delegateToContent("GET_PAGE_TEXT", {}, tabId);
        if (textRes && textRes.success) {
          const summary = await localChunkAndSummarize(textRes.data);
          // Cache final summary
          pageCache[targetTab.url] = { summary, title: targetTab.title, timestamp: Date.now() };
          return { success: true, data: summary };
        }
        throw new Error("Could not extract page text.");
      }
      throw new Error("No active tab to summarize.");
    }

    case "extract_notes": {
      if (tabId) {
        const textRes = await delegateToContent("GET_PAGE_TEXT", {}, tabId);
        if (textRes && textRes.success) {
          const notes = await askLLMToDigest("Extract all important takeaways, facts, or instructions in format bulleted list:", textRes.data);
          return { success: true, data: notes };
        }
        throw new Error("Notes extraction failed");
      }
      throw new Error("No active tab open");
    }

    case "answer_from_page": {
      if (tabId) {
        const textRes = await delegateToContent("GET_PAGE_TEXT", {}, tabId);
        if (textRes && textRes.success) {
          const ans = await askLLMToDigest(`Answer the user question: "${args.question}" using only this page context:`, textRes.data);
          return { success: true, data: ans };
        }
        throw new Error("Failed to extract page text for answering");
      }
      throw new Error("No active tab open");
    }

    case "compare_page_items": {
      if (tabId) {
        const textRes = await delegateToContent("GET_PAGE_TEXT", {}, tabId);
        if (textRes && textRes.success) {
          const comp = await askLLMToDigest("Compare the main items, services or features found on this page in simple terms:", textRes.data);
          return { success: true, data: comp };
        }
        throw new Error("Compare page items failed");
      }
      throw new Error("No active tab open");
    }

    case "copy_current_url": {
      if (targetTab && tabId) {
        await copyToTabClipboard(targetTab.url, tabId);
        return { success: true, data: "URL copied" };
      }
      throw new Error("No active tab to copy URL");
    }

    case "copy_selected_text": {
      if (tabId) {
        const textRes = await delegateToContent("COPY_SELECTED_TEXT", {}, tabId);
        if (textRes && textRes.success && textRes.data) {
          await copyToTabClipboard(textRes.data, tabId);
          return { success: true, data: `Copied: "${textRes.data.substring(0, 30)}..."` };
        }
        throw new Error("No selected text found to copy");
      }
      throw new Error("No active tab");
    }

    // Advanced E-Commerce Comparisons & Evaluation
    case "compare_prices": {
      if (tabId) {
        const listRes = await delegateToContent("EXTRACT_PRODUCT_CARDS", {}, tabId);
        if (listRes && listRes.success && listRes.data.length > 0) {
          const digest = await askLLMToDigest("Compare the prices of these products and summarize the cheapest and best value options: ", JSON.stringify(listRes.data));
          return { success: true, data: digest };
        }
        throw new Error("No products found on page to compare prices");
      }
      throw new Error("No active tab open");
    }

    case "find_best_value_item": {
      if (tabId) {
        const listRes = await delegateToContent("EXTRACT_PRODUCT_CARDS", {}, tabId);
        if (listRes && listRes.success && listRes.data.length > 0) {
          const digest = await askLLMToDigest("Based on visible page data (rating, review count, price), identify the single best value item and justify why: ", JSON.stringify(listRes.data));
          return { success: true, data: digest };
        }
        throw new Error("No products found on page to analyze for value");
      }
      throw new Error("No active tab open");
    }

    case "wait": {
      await new Promise(r => setTimeout(r, args.ms || 1000));
      return { success: true, data: `Waited for ${args.ms || 1000}ms` };
    }

    case "compare_products": {
      if (tabId) {
        const listRes = await delegateToContent("EXTRACT_PRODUCT_CARDS", {}, tabId);
        if (listRes?.success && listRes.data?.length > 0) {
          const digest = await askLLMToDigest(`Compare these products using criteria "${args.criteria || "price, rating, reviews, relevance"}" and name the strongest visible option:`, JSON.stringify(listRes.data));
          return { success: true, data: digest, products: listRes.data };
        }
        return { success: false, error: "No visible products found to compare." };
      }
      return { success: false, error: "No active tab open" };
    }

    case "open_best_product": {
      if (!tabId) return { success: false, error: "No active tab open" };
      const listRes = await delegateToContent("EXTRACT_PRODUCT_CARDS", {}, tabId);
      if (!listRes?.success || !listRes.data?.length) return { success: false, error: "No visible products found to open." };
      const ranked = [...listRes.data].sort((a, b) => {
        const priceA = Number(a.priceValue ?? Infinity);
        const priceB = Number(b.priceValue ?? Infinity);
        const ratingA = Number(a.ratingValue ?? 0);
        const ratingB = Number(b.ratingValue ?? 0);
        const reviewA = Number(a.reviewsCount ?? 0);
        const reviewB = Number(b.reviewsCount ?? 0);
        return (ratingB * 100 + reviewB / 20 - priceB / 1000) - (ratingA * 100 + reviewA / 20 - priceA / 1000);
      });
      const best = ranked[0];
      if (!best?.url) return { success: false, error: "Missing link target. Ask LLM to choose a visible link or search result." };
      if (tabId) await chrome.tabs.update(tabId, { url: best.url });
      else await chrome.tabs.create({ url: best.url });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Opened best visible product: ${best.title}`, products: ranked };
    }

    case "open_product_by_id": {
      if (!tabId || !args.id) return { success: false, error: "Missing link target. Ask LLM to choose a visible link or search result." };
      await ensureContentScriptInTab(tabId);
      const result = await delegateToContent("OPEN_PRODUCT_BY_ID", args, tabId);
      return result?.success ? result : { success: false, error: result?.error || "Could not open product by id." };
    }

    case "done":
    case "ask_user": {
      return { success: true, data: args };
    }

    // Default DOM delegation tools
    default: {
      if (!tabId) {
        throw new Error(`Cannot execute DOM tool "${toolName}" because no active tab is open.`);
      }
      const typeMap = {
        youtube_seek_to_timestamp: "YOUTUBE_SEEK_TO_TIMESTAMP",
        youtube_get_current_timestamp: "YOUTUBE_GET_CURRENT_TIMESTAMP",
        youtube_get_video_title: "YOUTUBE_GET_VIDEO_TITLE",
        extract_product_cards: "EXTRACT_PRODUCT_CARDS",
        extract_prices: "EXTRACT_PRICES",
        sort_items_by_price: "SORT_ITEMS_BY_PRICE",
        extract_reviews: "EXTRACT_REVIEWS",
        extract_ratings: "EXTRACT_RATINGS",
        get_page_context: "GET_PAGE_CONTEXT",
        get_page_text: "GET_PAGE_TEXT",
        get_links: "GET_LINKS",
        get_search_results: "GET_SEARCH_RESULTS",
        get_buttons: "GET_BUTTONS",
        get_inputs: "GET_INPUTS",
        get_headings: "GET_HEADINGS",
        get_images: "GET_IMAGES",
        find_text_on_page: "FIND_TEXT",
        click_text: "CLICK_TEXT",
        click_link: "CLICK_LINK",
        click_button: "CLICK_BUTTON",
        click_input: "CLICK_INPUT",
        hover_text: "HOVER_TEXT",
        double_click_text: "DOUBLE_CLICK_TEXT",
        scroll_down: "SCROLL_DOWN",
        scroll_up: "SCROLL_UP",
        scroll_to_top: "SCROLL_TO_TOP",
        scroll_to_bottom: "SCROLL_TO_BOTTOM",
        press_enter: "PRESS_ENTER",
        press_key: "PRESS_KEY",
        type_text: "TYPE_TEXT",
        clear_input: "CLEAR_INPUT",
        paste_text: "PASTE_TEXT",
        select_dropdown: "SELECT_DROPDOWN",
        check_checkbox: "CHECK_CHECKBOX",
        uncheck_checkbox: "UNCHECK_CHECKBOX",
        extract_emails: "EXTRACT_EMAILS",
        extract_phone_numbers: "EXTRACT_PHONE_NUMBERS",
        extract_dates: "EXTRACT_DATES",
        extract_prices: "EXTRACT_PRICES",
        youtube_open_first_video: "YOUTUBE_OPEN_FIRST",
        youtube_play_pause: "YOUTUBE_PLAY_PAUSE",
        youtube_fullscreen: "YOUTUBE_FULLSCREEN",
        youtube_change_speed: "YOUTUBE_CHANGE_SPEED",
        youtube_skip_forward: "YOUTUBE_SKIP_FORWARD",
        youtube_skip_back: "YOUTUBE_SKIP_BACK"
      };

      if (["click_link", "click_text", "click_button", "click_input"].includes(toolName)) {
        const invalid = validateLinkArgs(args);
        if (invalid) return invalid;
      }

      const mappedType = typeMap[toolName];
      if (!mappedType) {
        throw new Error(`Tool "${toolName}" is not approved or implemented.`);
      }

      await ensureContentScriptInTab(tabId);
      const contentResult = await delegateToContent(mappedType, args, tabId);
      if (contentResult && contentResult.success) {
        return contentResult;
      } else {
        throw new Error(contentResult?.error || `Content script action failed for "${toolName}"`);
      }
    }
  }
}

// Call Ollama API
async function callOllama(baseUrl, model, systemPrompt, userPrompt, history = [], retryPrompt = null, jsonMode = true, options = {}) {
  const messages = [];
  
  // Add system prompt
  messages.push({ role: "system", content: systemPrompt });
  
  // Add history
  for (const turn of history) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text
    });
  }
  
  // Add current prompt
  messages.push({
    role: "user",
    content: retryPrompt ? retryPrompt : userPrompt
  });

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        num_predict: options.maxTokens || TOOL_CALL_MAX_TOKENS
      },
      ...(jsonMode ? { format: "json" } : {})
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      throw new Error(`Model "${model}" not found. Install with: ollama run ${model}`);
    }
    throw new Error(`Ollama API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.message?.content;
  if (!text) {
    throw new Error("Received empty response from Ollama");
  }
  return text.trim();
}

// Testing API key helper
async function testApiKey(provider, apiKey) {
  try {
    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }),
        signal: AbortSignal.timeout(5000)
      });
      return resp.ok;
    } else if (provider === "claude") {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "Say OK" }]
        }),
        signal: AbortSignal.timeout(5000)
      });
      return resp.ok;
    }

    // OpenAI compatible endpoints testing
    let apiUrl = "";
    let model = "";
    if (provider === "openai") {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      model = "gpt-4o-mini";
    } else if (provider === "openrouter") {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      model = "google/gemini-2.5-flash";
    } else if (provider === "groq") {
      apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      model = "llama-3.3-70b-versatile";
    } else if (provider === "deepseek") {
      apiUrl = "https://api.deepseek.com/chat/completions";
      model = "deepseek-chat";
    } else if (provider === "mistral") {
      apiUrl = "https://api.mistral.ai/v1/chat/completions";
      model = "mistral-small-latest";
    } else if (provider === "perplexity") {
      apiUrl = "https://api.perplexity.ai/chat/completions";
      model = "sonar";
    } else if (provider === "cohere") {
      apiUrl = "https://api.cohere.com/v1/chat/completions";
      model = "command-r";
    } else {
      return false;
    }

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 5
      }),
      signal: AbortSignal.timeout(5000)
    });
    return resp.ok;
  } catch (e) {
    return false;
  }
}

// Call helper for OpenAI-compatible completions
async function callOpenAICompatible(apiUrl, model, apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null, options = {}) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(h => ({ role: h.role === "user" ? "user" : "assistant", content: h.text })),
    { role: "user", content: retryPrompt || userPrompt }
  ];

  const payload = {
    model: model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens || TOOL_CALL_MAX_TOKENS
  };

  if (apiUrl.includes("api.openai.com") || apiUrl.includes("api.groq.com") || apiUrl.includes("openrouter.ai") || apiUrl.includes("api.deepseek.com") || apiUrl.includes("api.mistral.ai")) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Received empty response from API");
  }
  return text.trim();
}

// Unified provider caller routing
async function callProvider(provider, apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null, options = {}) {
  if (provider === "gemini") {
    return await callGemini(apiKey, systemPrompt, userPrompt, history, retryPrompt, options);
  } else if (provider === "claude") {
    return await callClaude(apiKey, systemPrompt, userPrompt, history, retryPrompt, options);
  }
  
  let apiUrl = "";
  let model = "";
  if (provider === "openai") {
    apiUrl = "https://api.openai.com/v1/chat/completions";
    model = "gpt-4o-mini";
  } else if (provider === "openrouter") {
    apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    model = "google/gemini-2.5-flash";
  } else if (provider === "groq") {
    apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    model = "llama-3.3-70b-versatile";
  } else if (provider === "deepseek") {
    apiUrl = "https://api.deepseek.com/chat/completions";
    model = "deepseek-chat";
  } else if (provider === "mistral") {
    apiUrl = "https://api.mistral.ai/v1/chat/completions";
    model = "mistral-small-latest";
  } else if (provider === "perplexity") {
    apiUrl = "https://api.perplexity.ai/chat/completions";
    model = "sonar";
  } else if (provider === "cohere") {
    apiUrl = "https://api.cohere.com/v1/chat/completions";
    model = "command-r";
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return await callOpenAICompatible(apiUrl, model, apiKey, systemPrompt, userPrompt, history, retryPrompt, options);
}

// Unified LLM call function - routes to appropriate provider
async function callLLM(systemPrompt, userPrompt, history = [], retryPrompt = null, options = {}) {
  const config = await getProviderConfig();
  
  if (config.aiMode === "api") {
    let lastError = null;
    for (const provider of config.providerPriority) {
      const apiKey = config.apiKeys[provider];
      if (!apiKey) continue;
      
      try {
        logAction(`Calling provider: ${provider}`, "info");
        const res = await callProvider(provider, apiKey, systemPrompt, userPrompt, history, retryPrompt, options);
        logAction(`Provider ${provider} call successful`, "success");
        return res;
      } catch (err) {
        lastError = err;
        logAction(`Provider ${provider} failed: ${err.message || err}. Trying backup...`, "warning");
      }
    }
    throw new Error(lastError ? `All API fallback providers failed. Last error: ${lastError.message}` : "No API keys configured");
  } else if (config.aiMode === "ollama") {
    logAction(`Calling local model: ${config.ollamaModel}`, "info");
    const res = await callOllama(
      config.ollamaBaseUrl,
      config.ollamaModel,
      systemPrompt,
      userPrompt,
      history,
      retryPrompt,
      options.jsonMode !== false,
      options
    );
    logAction("Local model call successful", "success");
    return res;
  } else {
    throw new Error(`Unknown AI mode: ${config.aiMode}`);
  }
}

// Fetch tool with JSONMode & repair retry (provider-agnostic)
async function fetchNextToolWithProvider(systemPrompt, userPrompt, history) {
  let responseText;
  try {
    responseText = await callLLM(systemPrompt, userPrompt, history, null, { maxTokens: TOOL_CALL_MAX_TOKENS });
  } catch (err) {
    throw err;
  }
  
  try {
    const parsed = JSON.parse(extractJsonObject(responseText));
    if (!parsed.tool) {
      throw new Error("Missing 'tool' property in JSON");
    }
    return parsed;
  } catch (err) {
    logAction("JSON parsing failed, retrying with repair instructions...", "warning");
    const repairPrompt = `Your previous response failed to parse as valid JSON. Ensure that you return ONLY valid JSON matching the format: {"tool": "tool_name", "args": {...}}. Never output backticks (\`\`\`) or comments outside JSON.
Error encountered: ${err.message}
Your previous response was:
${responseText}`;
    
    try {
      const retryText = await callLLM(systemPrompt, userPrompt, history, repairPrompt, { maxTokens: REPAIR_MAX_TOKENS });
      const parsed = JSON.parse(extractJsonObject(retryText));
      if (!parsed.tool) throw new Error("Missing 'tool' property in retry JSON");
      return parsed;
    } catch (finalErr) {
      throw new Error(`Failed to parse LLM output as JSON after retry. Details: ${finalErr.message}`);
    }
  }
}

function extractJsonObject(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  if (clean.startsWith("{") && clean.endsWith("}")) return clean;
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end > start) return clean.slice(start, end + 1);
  return clean;
}

async function askLLMToDigest(promptPrefix, pageText) {
  const prompt = `${promptPrefix}
----- PAGE TEXT START -----
${String(pageText || "").substring(0, 12000)}
----- PAGE TEXT END -----`;

  try {
    return await callLLM(
      "You are a concise browser assistant. Answer directly and briefly. Do not output tool JSON for this request.",
      prompt,
      [],
      null,
      { maxTokens: DIGEST_MAX_TOKENS, jsonMode: false, temperature: 0.3 }
    );
  } catch (err) {
    throw new Error(`Digest request failed: ${err.message}`);
  }
}

// Gemini digests
async function askGeminiToDigest(apiKey, promptPrefix, pageText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const prompt = `${promptPrefix}
----- PAGE TEXT START -----
${pageText.substring(0, 12000)}
----- PAGE TEXT END -----`;

  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      maxOutputTokens: 500
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini digest request failed: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty digest response");
  return text.trim();
}
