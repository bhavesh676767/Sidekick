// Sidekick — Upgraded Background Service Worker (Manifest V3)
// Tasks run in background independently, state persisted to chrome.storage.session

// Local page memory cache
const pageCache = {};

// Initialize task state structure
let activeState = {
  command: "",
  isRunning: false,
  currentStep: 0,
  maxSteps: 8,
  logs: [],
  result: null,
  currentAction: "Idle",
  askUserQuestion: null,
  history: [],
  isFirstStepOfTask: false,
  sessionTabId: null,
  createdAt: null,
  lastUpdated: null
};

// Get storage API (use session if available, fallback to local)
async function getStorage() {
  try {
    return chrome.storage.session;
  } catch {
    return chrome.storage.local;
  }
}

// Persist state to session storage (independent of popup)
async function persistState(newState) {
  activeState = { ...activeState, ...newState, lastUpdated: Date.now() };
  const storage = await getStorage();
  await storage.set({ taskState: activeState });
  
  // Try to notify popup if open (optional)
  chrome.runtime.sendMessage({ action: "STATE_UPDATED", state: activeState }).catch(() => {
    // Popup closed - that's fine, state is still in storage
  });
}

// Update state helper (updates and persists)
async function updateState(newState) {
  await persistState(newState);
}

// Logging helper
function logAction(message, type = "info") {
  const newLog = {
    message,
    type,
    time: new Date().toLocaleTimeString()
  };
  activeState.logs = [newLog, ...activeState.logs].slice(0, 30);
  persistState({});
}

// Load saved state on startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Sidekick Extension Installed");
  const storage = await getStorage();
  const stored = await storage.get("taskState");
  if (stored.taskState) {
    activeState = stored.taskState;
  }
});

// Restore state on service worker restart (important!)
chrome.runtime.onStartup?.addListener(async () => {
  console.log("Service worker restarted, restoring state");
  const storage = await getStorage();
  const stored = await storage.get("taskState");
  if (stored.taskState && stored.taskState.isRunning) {
    activeState = stored.taskState;
    // Resume the task from where it left off
    logAction("Resumed task after service worker restart", "info");
    runNextStep();
  }
});

// Message listener for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_STATE") {
    sendResponse(activeState);
  } else if (request.action === "START_AGENT") {
    startAgentLoop(request.command);
    sendResponse({ success: true });
  } else if (request.action === "STOP_AGENT") {
    stopAgentLoop("Agent stopped by user");
    sendResponse({ success: true });
  } else if (request.action === "USER_RESPONSE") {
    resumeAgentWithResponse(request.response);
    sendResponse({ success: true });
  }
  // Ollama Local AI messages
  else if (request.action === "CHECK_OLLAMA") {
    checkOllamaStatus().then(sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === "ASK_OLLAMA") {
    askOllamaLocal(request.message).then(sendResponse);
    return true;
  } else if (request.action === "INJECT_NOTCH") {
    injectAssistantNotch().then(sendResponse);
    return true;
  } else if (request.action === "REMOVE_NOTCH") {
    removeAssistantNotch().then(sendResponse);
    return true;
  } else if (request.action === "NOTCH_REMOVED") {
    // Handle notch removal notification
    chrome.storage.local.set({ notchActive: false });
    sendResponse({ success: true });
  }
  return true;
});

// Ollama Local AI status check
async function checkOllamaStatus() {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        connected: true, 
        models: data.models || [],
        hasLlama32: data.models?.some(m => m.name.includes('llama3.2')) || false
      };
    }
    return { connected: false, error: 'Ollama responded with an error' };
  } catch (err) {
    return { connected: false, error: 'Could not connect to Ollama' };
  }
}

// Ask Ollama locally (for background use)
async function askOllamaLocal(message) {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        messages: [
          { role: 'system', content: 'You are a helpful browser assistant.' },
          { role: 'user', content: message }
        ],
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, response: data.message?.content || '' };
    }
    return { success: false, error: 'Ollama request failed' };
  } catch (err) {
    return { success: false, error: 'Could not connect to Ollama' };
  }
}

// Inject assistant notch into active tab
async function injectAssistantNotch() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['assistant-notch.js']
      });
      chrome.storage.local.set({ notchActive: true });
      return { success: true };
    }
    return { success: false, error: 'No active tab found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Remove assistant notch from all tabs
async function removeAssistantNotch() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'REMOVE_NOTCH' });
      } catch {
        // Tab might not have the notch, ignore errors
      }
    }
    chrome.storage.local.set({ notchActive: false });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Alarm listener for persistent agent loop continuation
chrome.alarms.onAlarm.addListener((alarm) => {
  try {
    if (alarm.name === "continueAgentLoop" && activeState.isRunning) {
      runNextStep();
    }
  } catch (err) {
    console.error("Error in alarm handler:", err);
  }
});

// Stop agent loop
function stopAgentLoop(message, isError = false) {
  updateState({
    isRunning: false,
    currentAction: "Idle",
    result: {
      type: isError ? "error" : "success",
      text: message
    }
  });
  logAction(message, isError ? "error" : "success");
}

// Safe check to verify or inject content script
async function ensureContentScriptInTab(tabId) {
  try {
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_TEXT" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          reject(new Error("Ping failed"));
        } else {
          resolve(response);
        }
      });
    });
  } catch (err) {
    logAction("Content script inactive. Injecting sidekick DOM driver...", "info");
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
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
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type, args }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: true });
      }
    });
  });
}

// Local Cheap Routing Parser to optimize API tokens
function tryLocalRouting(command) {
  const lower = command.toLowerCase().trim();
  
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

// Call any API provider (with dynamic selection based on preference order)
async function callPreferredAi(systemPrompt, userPrompt, history = [], retryPrompt = null, skipProvider = null) {
  const apiConfig = await getNextAvailableApiKey(skipProvider);
  
  if (!apiConfig) {
    throw new Error("No API keys configured. Please add at least one API key in Settings.");
  }

  const { provider, apiKey } = apiConfig;

  if (provider === 'gemini') {
    return await callGemini(apiKey, systemPrompt, userPrompt, history, retryPrompt);
  } else {
    // For other providers (groq, openrouter), use the callAiProvider function
    return await callAiProvider(provider, apiKey, systemPrompt, userPrompt, history, retryPrompt);
  }
}

// Get the next available API key based on preference order
async function getNextAvailableApiKey(skipProvider = null) {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'apiPrefOrder'],
      (result) => {
        const prefOrder = result.apiPrefOrder || ['gemini', 'groq', 'openrouter'];
        const availableKeys = {
          gemini: result.geminiApiKey || null,
          groq: result.groqApiKey || null,
          openrouter: result.openRouterApiKey || null,
        };

        for (const provider of prefOrder) {
          if (provider === skipProvider) continue;
          if (availableKeys[provider]) {
            return resolve({
              provider,
              apiKey: availableKeys[provider],
            });
          }
        }

        resolve(null);
      }
    );
  });
}

// Call generic AI provider (for Groq, OpenRouter, etc.)
async function callAiProvider(provider, apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null) {
  let baseUrl = '';
  let model = 'gpt-3.5-turbo';

  if (provider === 'groq') {
    baseUrl = 'https://api.groq.com/openai/v1';
    model = 'llama-3.3-70b-versatile'; // Updated from decommissioned mixtral-8x7b-32768
  } else if (provider === 'openrouter') {
    baseUrl = 'https://openrouter.ai/api/v1';
    model = 'openai/gpt-3.5-turbo';
  }

  const messages = [];
  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  for (const turn of history) {
    messages.push({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    });
  }

  messages.push({
    role: 'user',
    content: retryPrompt ? retryPrompt : userPrompt,
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.toUpperCase()} API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Received empty response from ${provider}`);
  }
  return text.trim();
}

// Call Gemini API securely
async function callGemini(apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null) {
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
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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

// Fetch tool with JSONMode & repair retry
async function fetchNextTool(systemPrompt, userPrompt, history) {
  let responseText = await callPreferredAi(systemPrompt, userPrompt, history);
  try {
    const parsed = JSON.parse(responseText);
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
    const retryText = await callPreferredAi(systemPrompt, userPrompt, history, repairPrompt);
    try {
      const parsed = JSON.parse(retryText);
      if (!parsed.tool) throw new Error("Missing 'tool' property in retry JSON");
      return parsed;
    } catch (finalErr) {
      throw new Error(`Failed to parse AI output as JSON after retry. Details: ${finalErr.message}`);
    }
  }
}

// Fetch tool with fallback to next provider if primary fails
async function fetchNextToolWithFallback(systemPrompt, userPrompt, history) {
  const apiConfig = await getNextAvailableApiKey();
  if (!apiConfig) {
    throw new Error("No API keys configured");
  }

  try {
    return await fetchNextTool(systemPrompt, userPrompt, history);
  } catch (err) {
    logAction(`Primary provider (${apiConfig.provider}) failed. Trying fallback...`, "warning");
    
    // Try with next available provider
    try {
      return await fetchNextTool(systemPrompt, userPrompt, history);
    } catch (fallbackErr) {
      throw new Error(`All providers exhausted: ${fallbackErr.message}`);
    }
  }
}

// Local chunking compressor for long pages to prevent token limits
async function localChunkAndSummarize(pageText) {
  if (pageText.length <= 4000) {
    return askAiToDigest("Summarize this webpage simple and clear in 2-3 short bullet points:", pageText);
  }
  
  // Split into chunks of 4000 characters
  const chunks = [];
  for (let i = 0; i < pageText.length; i += 4000) {
    chunks.push(pageText.substring(i, i + 4000));
  }
  
  logAction(`Page text is long (${pageText.length} chars). Summarizing in ${chunks.length} chunks...`, "info");
  
  const chunkSummaries = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    const sum = await askAiToDigest(`Summarize part ${idx + 1} of the webpage:`, chunks[idx]);
    chunkSummaries.push(sum);
  }
  
  const merged = chunkSummaries.join("\n\n");
  const finalSummary = await askAiToDigest("Consolidate the following section summaries into a single cohesive, high-quality, brief bulleted summary:", merged);
  return finalSummary;
}

// Main logic coordinator
async function startAgentLoop(command) {
  // Check if at least one API key is configured
  const keyData = await chrome.storage.local.get(['geminiApiKey', 'groqApiKey', 'openRouterApiKey']);
  if (!keyData.geminiApiKey && !keyData.groqApiKey && !keyData.openRouterApiKey) {
    stopAgentLoop("No API keys configured. Go to Settings to add at least one.", true);
    return;
  }

  await updateState({
    command,
    isRunning: true,
    currentStep: 0,
    logs: [],
    result: null,
    currentAction: "Initializing agent...",
    askUserQuestion: null,
    history: [],
    isFirstStepOfTask: true,
    sessionTabId: null
  });

  logAction(`Starting agent: "${command}"`, "info");
  runNextStep();
}

// Resume loop with user feedback
async function resumeAgentWithResponse(response) {
  logAction(`User response: "${response}"`, "info");
  
  activeState.history.push({
    role: "user",
    text: `User confirmation/details: ${response}`
  });

  // Keep history capped to last 3 steps to optimize tokens
  if (activeState.history.length > 6) {
    activeState.history = activeState.history.slice(-6);
  }

  await updateState({
    askUserQuestion: null,
    isRunning: true,
    currentAction: "Resuming agent loop..."
  });

  runNextStep();
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
          stopAgentLoop("Obvious task completed locally.");
        }
      } catch (err) {
        logAction(`Local routing execution failed: ${err.message}. Falling back to AI.`, "warning");
      }
      return;
    }
  }

  // 2. Fetch context of currently target/active tab (optimized tiny context)
  let tab = null;
  let context = { url: "", title: "", visibleText: "No active tab context available", buttons: [], links: [], inputs: [], headings: [] };
  
  try {
    tab = await getTargetTab();
    if (tab && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
      await ensureContentScriptInTab(tab.id);
      const res = await delegateToContent("GET_PAGE_CONTEXT", {}, tab.id);
      if (res && res.success) {
        context = res.data;
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

  // 3. Prepare user prompt containing Tiny Context & Compact Element Indexing
  const lastLogs = activeState.logs.slice(0, 3).map(l => `[${l.type}] ${l.message}`).join("\n");
  const userPrompt = `USER REQUEST: "${activeState.command}"
CURRENT TAB INFO:
URL: ${context.url || "none"}
Title: ${context.title || "none"}

COMPACT ELEMENT INDEXES (CAPPED FOR TOKEN SAVINGS):
Buttons (max 30): ${JSON.stringify(context.buttons || [])}
Inputs (max 20): ${JSON.stringify(context.inputs || [])}
Links (max 30): ${JSON.stringify(context.links || [])}
Headings: ${JSON.stringify(context.headings || [])}

LAST 3 AGENT ACTIONS:
${lastLogs || "None"}

Please choose exactly ONE next tool call to solve the user's request.`;

  // 4. AI Reasoning Prompt
  await updateState({ currentAction: `Step ${activeState.currentStep}: Reasoning...` });
  logAction(`Step ${activeState.currentStep}: Deciding next action...`, "info");

  const systemPrompt = `You are Sidekick, a secure and powerful browser-control agent.
You understand messy natural language, slang, short commands, and indirect instructions.
You control the browser only through approved tools.
Choose exactly ONE next tool call.
Use the compact element indexes to choose target elements.
Never invent visible elements.
Never output markdown.
Never explain.
Return only valid JSON.
Always make your best attempt without asking for clarification.

Only ask for confirmation if the action is risky (risky actions include: payment, purchase, delete, submit form, send message, send email, post publicly, password/login, account setting changes, downloading suspicious files).

For all other tasks, proceed with your best interpretation of the user's intent.

Allowed response format:
{
  "tool": "tool_name",
  "args": {}
}

IMPORTANT: Tool names must be in snake_case (lowercase with underscores), like "click_text", "open_url", "scroll_down".
Do NOT use UPPERCASE or SCREAMING_SNAKE_CASE for tool names.

If task is complete, choose:
{
  "tool": "done",
  "args": {
    "message": "Explain what was accomplished in a small sentence."
  }
}

If a risky action is detected, ask for confirmation:
{
  "tool": "ask_user",
  "args": {
    "question": "This action is potentially risky. Do you want to proceed? (yes/no)"
  }
}

Here are the 65+ approved tools you can choose from:

Navigation & Tabs:
- open_url(url: string)
- new_tab(url?: string)
- open_task_in_new_tab(url: string) [opens a tab isolated specifically for this task]
- close_current_tab()
- close_tab()
- close_window()
- reload_page()
- go_back()
- go_forward()
- get_current_url()
- get_page_title()
- list_windows()
- list_tabs()
- switch_to_tab(query: string) [switches active tab matching query title/url]
- duplicate_current_tab()

Search & Profiles:
- google_search(query: string)
- youtube_search(query: string)
- github_search(query: string)
- maps_search(query: string)
- site_search(site: string, query: string)
- open_profile(site: string) [Resolves: "github", "google", "youtube", "chatgpt", "linkedin" profiles]

DOM Reading & Interaction:
- get_page_context()
- get_page_text()
- get_links()
- get_buttons()
- get_inputs()
- get_headings()
- get_images()
- find_text_on_page(query: string)
- click_text(target: string) [target can be exact text or compact sk-* element ID]
- click_link(target: string)
- click_button(target: string)
- click_input(target: string)
- hover_text(target: string)
- double_click_text(target: string)
- scroll_down()
- scroll_up()
- scroll_to_top()
- scroll_to_bottom()
- press_enter()
- press_key(key: string)

Input tools:
- type_text(text: string, target?: string) [target can be input text/placeholder or sk-* ID]
- clear_input(target?: string)
- paste_text(text: string)
- select_dropdown(target: string, value: string)
- check_checkbox(target: string)
- uncheck_checkbox(target: string)

E-Commerce & Extraction Tools:
- extract_product_cards() [pulls title, price, rating, reviews from Amazon/eBay/Shopify lists]
- extract_prices()
- compare_prices() [compares prices of products currently extracted]
- find_best_value_item() [identifies best rating-price value item on page]
- sort_items_by_price()
- extract_reviews()
- extract_ratings()

YouTube Specific Tools:
- youtube_seek_to_timestamp(timestamp: string) [seek video player using time like "2:35" or "5 minutes"]
- youtube_get_current_timestamp()
- youtube_get_video_title()
- youtube_open_history() [opens watch history feed]
- youtube_open_profile()
- youtube_open_subscriptions()
- youtube_open_watch_later()

Content digests:
- summarize_page() [uses chunked summary pipeline]
- extract_notes()
- answer_from_page(question: string)
- extract_emails()
- extract_phone_numbers()
- extract_dates()
- extract_prices()
- compare_page_items()

Utility tools:
- wait(ms: number)
- copy_current_url()
- copy_selected_text()
- ask_user(question: string)
- done(message: string)`;

  let choice = null;
  try {
    choice = await fetchNextTool(systemPrompt, userPrompt, activeState.history);
  } catch (err) {
    logAction(`AI provider failed: ${err.message}. Trying fallback provider...`, "warning");
    try {
      // Try with a different provider (skip the one that failed)
      choice = await fetchNextToolWithFallback(systemPrompt, userPrompt, activeState.history);
    } catch (fallbackErr) {
      stopAgentLoop(`All AI providers failed: ${fallbackErr.message}`, true);
      return;
    }
  }

  // Save choices to short history (max 3 steps of interaction kept)
  activeState.history.push({
    role: "model",
    text: JSON.stringify(choice)
  });

  if (activeState.history.length > 6) {
    activeState.history = activeState.history.slice(-6);
  }

  await updateState({ currentAction: `Step ${activeState.currentStep}: Executing ${choice.tool}...` });
  logAction(`AI chose tool: ${choice.tool}`, "info");

  // 5. Execute Tool
  let result = null;
  try {
    result = await executeTool(choice.tool, choice.args);
  } catch (err) {
    logAction(`Tool execution error: ${err.message}. Retrying step...`, "warning");
    activeState.history.push({
      role: "user",
      text: `Error executing ${choice.tool}: ${err.message}. Please try an alternative tool.`
    });
    try {
      choice = await fetchNextTool(systemPrompt, userPrompt, activeState.history);
      result = await executeTool(choice.tool, choice.args);
    } catch (retryErr) {
      stopAgentLoop(`Execution failed twice. Details: ${retryErr.message}`, true);
      return;
    }
  }

  // 6. Handle Done / Clarifications
  if (choice.tool === "done") {
    stopAgentLoop(choice.args?.message || "Task completed!");
    return;
  }

  if (choice.tool === "ask_user") {
    await updateState({
      isRunning: false,
      currentAction: "Waiting for user input...",
      askUserQuestion: choice.args?.question || "Please clarify."
    });
    logAction(`Asked user: "${choice.args?.question}"`, "info");
    return;
  }

  // Log result
  if (result && result.success) {
    logAction(`Executed ${choice.tool} successfully`, "success");
    activeState.history.push({
      role: "user",
      text: `Tool result: ${JSON.stringify(result.data || "success")}`
    });
  } else {
    logAction(`Tool ${choice.tool} warning: ${result?.error || "unsuccessful"}`, "warning");
    activeState.history.push({
      role: "user",
      text: `Tool result warning: ${result?.error || "failed"}`
    });
  }

  // Schedule next step with persistent alarm (survives service worker reload)
  if (activeState.isRunning) {
    chrome.alarms.create("continueAgentLoop", { delayInMinutes: 0.013 }); // ~800ms
  }
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

// Router of the 65+ browser tools
async function executeTool(toolName, args = {}) {
  let targetTab = await getTargetTab();
  let tabId = targetTab?.id;

  // Workspace Safeguard: If first step of a brand new task demands navigation/search,
  // we open a new tab by default instead of overwriting the user's active page!
  const isNavigational = [
    "open_url", "google_search", "youtube_search", "github_search", 
    "maps_search", "site_search", "open_profile", "youtube_open_history",
    "youtube_open_subscriptions", "youtube_open_watch_later"
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
      const u = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching Google for: ${args.query}` };
    }

    case "youtube_search": {
      const u = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching YouTube for: ${args.query}` };
    }

    case "github_search": {
      const u = `https://github.com/search?q=${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching GitHub for: ${args.query}` };
    }

    case "maps_search": {
      const u = `https://www.google.com/maps/search/${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching Maps for: ${args.query}` };
    }

    case "site_search": {
      const u = `https://www.google.com/search?q=site:${args.site}+${encodeURIComponent(args.query)}`;
      if (tabId) await chrome.tabs.update(tabId, { url: u });
      else await chrome.tabs.create({ url: u });
      await new Promise(r => setTimeout(r, 2000));
      return { success: true, data: `Searching ${args.site} for: ${args.query}` };
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
          const notes = await askAiToDigest("Extract all important takeaways, facts, or instructions in format bulleted list:", textRes.data);
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
          const ans = await askAiToDigest(`Answer the user question: "${args.question}" using only this page context:`, textRes.data);
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
          const comp = await askAiToDigest("Compare the main items, services or features found on this page in simple terms:", textRes.data);
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
          const digest = await askAiToDigest("Compare the prices of these products and summarize the cheapest and best value options: ", JSON.stringify(listRes.data));
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
          const digest = await askAiToDigest("Based on visible page data (rating, review count, price), identify the single best value item and justify why: ", JSON.stringify(listRes.data));
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

// Gemini digests
async function askAiToDigest(promptPrefix, pageText) {
  const prompt = `${promptPrefix}
----- PAGE TEXT START -----
${pageText.substring(0, 12000)}
----- PAGE TEXT END -----`;

  try {
    return await callPreferredAi(
      "You are a helpful summarizer and analyzer. Provide concise, clear responses.",
      prompt,
      []
    );
  } catch (err) {
    throw new Error(`Digest request failed: ${err.message}`);
  }
}
