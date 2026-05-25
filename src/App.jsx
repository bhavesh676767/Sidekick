import React, { useState, useEffect, useRef } from "react";
import { 
  Settings, 
  Play, 
  Square, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  HelpCircle, 
  Send, 
  X, 
  ChevronRight, 
  Lock, 
  Search,
  Sparkles,
  RefreshCw,
  ClipboardCheck,
  Info,
  Cpu
} from "lucide-react";
import Onboarding from "./components/Onboarding";
import { 
  loadSetupState, 
  isSetupComplete, 
  isLocalAIEnabled,
  setLocalAIEnabled 
} from "./utils/ollama";

// ---------------------------------------------------------------------------
// Preloader Splash Component (Always displayed on startup / initialization)
// ---------------------------------------------------------------------------
function Preloader({ message = "Initializing Sidekick Agent..." }) {
  return (
    <div className="w-[360px] h-[520px] bg-black text-white flex flex-col items-center justify-center animate-fade-in p-6">
      <div className="relative mb-6">
        {/* Outer glowing B&W ring */}
        <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center animate-spin-slow">
          <div className="w-12 h-12 rounded-full border border-dashed border-white/30 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              <span className="text-black font-black text-sm">S</span>
            </div>
          </div>
        </div>
      </div>
      <h2 className="text-sm font-bold tracking-widest uppercase mb-1">Sidekick</h2>
      <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin text-white" />
        {message}
      </p>
    </div>
  );
}

export default function App() {
  // Loading state for Preloader initialization
  const [initLoading, setInitLoading] = useState(true);
  const [preloaderMessage, setPreloaderMessage] = useState("Securing browser pipeline...");

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [ollamaSetupDone, setOllamaSetupDone] = useState(false);
  const [localAIEnabled, setLocalAIEnabledState] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // --- Per-provider API key state ---
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");

  // Saved flags (true if a key is stored in chrome.storage)
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [groqSaved, setGroqSaved] = useState(false);
  const [openRouterSaved, setOpenRouterSaved] = useState(false);

  // Preference order: array of provider ids, index 0 = 1st preference
  // e.g. ["gemini", "groq", "openrouter"]
  const [prefOrder, setPrefOrder] = useState(["gemini", "groq", "openrouter"]);

  const [showSettings, setShowSettings] = useState(false);

  // Any key saved? Used to unlock the main UI
  const anyKeySaved = geminiSaved || groqSaved || openRouterSaved;

  // Command & Input
  const [inputCommand, setInputCommand] = useState("");

  // Agent State mirroring background.js state
  const [agentState, setAgentState] = useState({
    command: "",
    isRunning: false,
    currentStep: 0,
    maxSteps: 8,
    logs: [],
    result: null,
    currentAction: "Idle",
    askUserQuestion: null
  });

  // Local state for ask_user response
  const [userResponseText, setUserResponseText] = useState("");

  const logsEndRef = useRef(null);

  // Load configuration and agent state on mount
  useEffect(() => {
    async function loadData() {
      setPreloaderMessage("Checking API credentials...");
      const stored = await chrome.storage.local.get([
        "geminiApiKey", "groqApiKey", "openRouterApiKey", "apiPrefOrder"
      ]);
      if (stored.geminiApiKey)    { setGeminiKey(stored.geminiApiKey);       setGeminiSaved(true); }
      if (stored.groqApiKey)      { setGroqKey(stored.groqApiKey);           setGroqSaved(true); }
      if (stored.openRouterApiKey){ setOpenRouterKey(stored.openRouterApiKey); setOpenRouterSaved(true); }
      if (stored.apiPrefOrder)    setPrefOrder(stored.apiPrefOrder);

      // Check onboarding state
      setPreloaderMessage("Checking setup status...");
      const setupComplete = await isSetupComplete();
      const localEnabled = await isLocalAIEnabled();
      setOllamaSetupDone(setupComplete);
      setLocalAIEnabledState(localEnabled);
      
      // Show onboarding if not completed
      if (!setupComplete) {
        setShowOnboarding(true);
      }

      setPreloaderMessage("Restoring active sessions...");
      
      // Try to get state from background first, fallback to storage
      try {
        chrome.runtime.sendMessage({ action: "GET_STATE" }, (response) => {
          if (response && response.command) {
            setAgentState(response);
          } else {
            // Fallback: load from chrome.storage.session directly
            chrome.storage.session.get("taskState", (stored) => {
              if (stored.taskState && stored.taskState.command) {
                setAgentState(stored.taskState);
              }
            });
          }
          setOnboardingChecked(true);
          setTimeout(() => setInitLoading(false), 1200);
        });
      } catch (err) {
        // Background not available, try storage directly
        chrome.storage.session.get("taskState", (stored) => {
          if (stored.taskState && stored.taskState.command) {
            setAgentState(stored.taskState);
          }
          setOnboardingChecked(true);
          setTimeout(() => setInitLoading(false), 1200);
        });
      }
    }
    loadData();
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    setOllamaSetupDone(true);
    setLocalAIEnabledState(true);
    
    // Inject the floating notch
    chrome.runtime.sendMessage({ action: "INJECT_NOTCH" });
  };

  // Handle onboarding skip
  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
  };

  // Toggle local AI
  const toggleLocalAI = async () => {
    const newState = !localAIEnabled;
    await setLocalAIEnabled(newState);
    setLocalAIEnabledState(newState);
    
    if (newState) {
      chrome.runtime.sendMessage({ action: "INJECT_NOTCH" });
    } else {
      chrome.runtime.sendMessage({ action: "REMOVE_NOTCH" });
    }
  };

  // Listen for realtime agent state broadcasts from background.js
  useEffect(() => {
    const handleMessage = (msg) => {
      if (msg.action === "STATE_UPDATED") {
        setAgentState(msg.state);
        // Clear user response if agent is no longer waiting
        if (!msg.state.askUserQuestion) {
          setUserResponseText("");
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Scroll logs to top/bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentState.logs]);

  // --- Per-provider save / delete handlers ---
  const saveKey = async (provider) => {
    if (provider === "gemini" && geminiKey.trim()) {
      await chrome.storage.local.set({ geminiApiKey: geminiKey.trim() });
      setGeminiSaved(true);
    } else if (provider === "groq" && groqKey.trim()) {
      await chrome.storage.local.set({ groqApiKey: groqKey.trim() });
      setGroqSaved(true);
    } else if (provider === "openrouter" && openRouterKey.trim()) {
      await chrome.storage.local.set({ openRouterApiKey: openRouterKey.trim() });
      setOpenRouterSaved(true);
    }
  };

  const deleteKey = async (provider) => {
    if (provider === "gemini") {
      await chrome.storage.local.remove("geminiApiKey");
      setGeminiKey(""); setGeminiSaved(false);
    } else if (provider === "groq") {
      await chrome.storage.local.remove("groqApiKey");
      setGroqKey(""); setGroqSaved(false);
    } else if (provider === "openrouter") {
      await chrome.storage.local.remove("openRouterApiKey");
      setOpenRouterKey(""); setOpenRouterSaved(false);
    }
  };

  // Update preference order slot
  const updatePref = async (slot, newProvider) => {
    // Swap: if newProvider is already elsewhere, swap those slots
    const current = [...prefOrder];
    const existingSlot = current.indexOf(newProvider);
    if (existingSlot !== -1 && existingSlot !== slot) {
      current[existingSlot] = current[slot]; // put displaced one in old slot
    }
    current[slot] = newProvider;
    setPrefOrder(current);
    await chrome.storage.local.set({ apiPrefOrder: current });
  };

  // Run Command
  const handleRunCommand = () => {
    const cmd = inputCommand.trim();
    if (!cmd) return;
    chrome.runtime.sendMessage({ action: "START_AGENT", command: cmd }, () => {
      setInputCommand("");
    });
  };

  // Stop Command
  const handleStopAgent = () => {
    chrome.runtime.sendMessage({ action: "STOP_AGENT" });
  };

  // Quick action chip triggers
  const handleQuickAction = (text) => {
    setInputCommand(text);
    chrome.runtime.sendMessage({ action: "START_AGENT", command: text });
  };

  // Submit User response for ask_user
  const handleSubmitResponse = () => {
    const resp = userResponseText.trim();
    if (!resp) return;
    chrome.runtime.sendMessage({ action: "USER_RESPONSE", response: resp });
  };

  // Enter triggers
  const handleKeyDownCommand = (e) => {
    if (e.key === "Enter" && inputCommand.trim() && !agentState.isRunning) {
      handleRunCommand();
    }
  };

  const handleKeyDownResponse = (e) => {
    if (e.key === "Enter" && userResponseText.trim()) {
      handleSubmitResponse();
    }
  };

  // Render Preloader if loading
  if (initLoading) {
    return <Preloader message={preloaderMessage} />;
  }

  // Render Onboarding if not completed
  if (showOnboarding && onboardingChecked) {
    return <Onboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
  }

  return (
    <div className="w-[360px] h-[520px] overflow-hidden bg-black text-white flex flex-col relative animate-fade-in">
      
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.07] shrink-0 bg-neutral-950">
        <div className="flex items-center gap-2">
          <div className="relative">
            <img
              src="sidekick_logo.png"
              alt="Sidekick"
              className="w-7 h-7 rounded-lg bg-white p-0.5 object-contain"
            />
            {agentState.isRunning && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-black tracking-widest uppercase">Sidekick</h1>
              <span className="text-[8px] font-mono px-1 py-0.25 bg-white/10 rounded text-gray-300">MVP</span>
            </div>
            <p className="text-[9px] text-gray-400 font-mono">
              {agentState.isRunning 
                ? `Active • Step ${agentState.currentStep}/8` 
                : agentState.askUserQuestion 
                ? "Waiting for response" 
                : "Secure Sandbox Ready"}
            </p>
          </div>
        </div>

        <button 
          onClick={() => setShowSettings(true)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 active:scale-90 rounded-lg transition-all"
          title="Configure API Keys & Preferences"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* ---- Main Body Layout ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* API Key Banner Warning if no key at all */}
        {!anyKeySaved && (
          <div className="p-3 bg-neutral-950 border border-dashed border-red-500/30 rounded-xl flex items-start gap-2.5 animate-slide-up text-xs">
            <Lock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-400 block">No API Key Configured</span>
              <p className="text-gray-400 text-[10px] leading-relaxed mb-1.5">
                Add at least one API key (Gemini, Groq, or OpenRouter) to activate Sidekick.
              </p>
              <button
                onClick={() => setShowSettings(true)}
                className="px-2.5 py-1 text-[9px] font-mono bg-white text-black rounded hover:bg-gray-200 transition-all font-bold"
              >
                Setup Credentials
              </button>
            </div>
          </div>
        )}

        {/* Action input panel */}
        {anyKeySaved && !agentState.isRunning && !agentState.askUserQuestion && (
          <div className="space-y-2.5 animate-slide-up">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                onKeyDown={handleKeyDownCommand}
                placeholder="Where should Sidekick navigate?..."
                className="w-full bg-neutral-900 border border-white/[0.08] rounded-xl pl-3 pr-11 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-all"
              />
              <button
                onClick={handleRunCommand}
                disabled={!inputCommand.trim()}
                className="absolute right-1.5 p-1.5 bg-white text-black hover:bg-gray-200 active:scale-95 disabled:opacity-30 disabled:hover:bg-white rounded-lg transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {[
                "open youtube",
                "open github",
                "summarize page",
                "google search chatgpt"
              ].map((label) => (
                <button
                  key={label}
                  onClick={() => handleQuickAction(label)}
                  className="px-2.5 py-1 text-[9px] font-mono bg-neutral-900 border border-white/[0.04] text-gray-400 hover:text-white hover:border-white/10 rounded-full transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Execution Screen / Agent Active */}
        {(agentState.isRunning || agentState.askUserQuestion || agentState.logs.length > 0) && (
          <div className="space-y-3.5 animate-slide-up">
            
            {/* Command Header under run */}
            <div className="p-3 bg-neutral-950 border border-white/[0.04] rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Active Command</span>
                <p className="text-[11px] font-mono text-gray-200 truncate">{agentState.command}</p>
              </div>
              
              {agentState.isRunning && (
                <button
                  onClick={handleStopAgent}
                  className="px-3 py-1.5 text-[9px] font-mono bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  Stop
                </button>
              )}
            </div>

            {/* Active Action Ticker */}
            {agentState.isRunning && (
              <div className="p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-lg flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin shrink-0" />
                <span className="text-[10px] font-mono text-gray-300 animate-pulse truncate">
                  {agentState.currentAction}
                </span>
              </div>
            )}

            {/* User Clarification Modal / Panel inside log */}
            {agentState.askUserQuestion && (
              <div className="p-3.5 bg-neutral-950 border border-white/20 rounded-xl space-y-3 animate-slide-up shadow-xl shadow-black/80">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Sidekick Question</span>
                    <p className="text-xs text-white leading-relaxed">{agentState.askUserQuestion}</p>
                  </div>
                </div>
                
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={userResponseText}
                    onChange={(e) => setUserResponseText(e.target.value)}
                    onKeyDown={handleKeyDownResponse}
                    placeholder="Provide details..."
                    className="w-full bg-neutral-900 border border-white/[0.1] rounded-lg pl-3 pr-10 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                  <button
                    onClick={handleSubmitResponse}
                    disabled={!userResponseText.trim()}
                    className="absolute right-1.5 p-1 bg-white text-black hover:bg-gray-200 disabled:opacity-30 rounded transition-all"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Agent Action Steps log */}
            {agentState.logs.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-[8px] font-mono text-gray-500 uppercase tracking-wider pl-1">Activity Log</h3>
                <div className="max-h-[140px] overflow-y-auto border border-white/[0.04] rounded-xl bg-neutral-950 divide-y divide-white/[0.03]">
                  {agentState.logs.map((log, i) => (
                    <div key={i} className="p-2.5 flex items-start justify-between gap-3 text-[10px] font-mono">
                      <div className="flex items-start gap-2 min-w-0">
                        {log.type === "success" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : log.type === "error" ? (
                          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0 mt-1.5 ml-1" />
                        )}
                        <span className="text-gray-300 break-words leading-relaxed min-w-0">{log.message}</span>
                      </div>
                      <span className="text-[8px] text-gray-600 shrink-0">{log.time}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final Result Card display */}
        {agentState.result && (
          <div className="p-3.5 bg-neutral-950 border border-white/10 rounded-xl space-y-2 animate-slide-up">
            <div className="flex items-center gap-1.5">
              {agentState.result.type === "error" ? (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-[9px] font-mono text-red-400 uppercase tracking-wider font-bold">Execution Failed</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider font-bold">Task Completed</span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-200 leading-relaxed font-mono">
              {agentState.result.text}
            </p>
          </div>
        )}

      </div>

      {/* ---- Footer ---- */}
      <footer className="text-center text-[8px] font-mono text-gray-600 py-3 border-t border-white/[0.05] shrink-0 bg-neutral-950">
        TEXT MODE &bull; VOICE COMING SOON
      </footer>      {/* ---- Settings Overlay Modal ---- */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-4 space-y-4 animate-slide-up">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-white" />
                <h3 className="text-xs font-black uppercase tracking-wider">API Keys & Preferences</h3>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-1 text-gray-400 hover:text-white rounded-lg transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-0.5">

              {/* ── Preference Order ── */}
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
                <label className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Preference Order</label>
                <p className="text-[8px] text-gray-500 leading-relaxed">Sidekick uses your 1st-choice key first, then falls back in order.</p>
                {[0, 1, 2].map((slot) => (
                  <div key={slot} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-gray-500 w-4 shrink-0">{slot + 1}.</span>
                    <select
                      value={prefOrder[slot]}
                      onChange={(e) => updatePref(slot, e.target.value)}
                      className="flex-1 bg-neutral-900 border border-white/[0.1] rounded-lg px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-white/30"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="groq">Groq</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                      prefOrder[slot] === "gemini" && geminiSaved ? "bg-emerald-500/20 text-emerald-400" :
                      prefOrder[slot] === "groq" && groqSaved ? "bg-emerald-500/20 text-emerald-400" :
                      prefOrder[slot] === "openrouter" && openRouterSaved ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {(prefOrder[slot] === "gemini" && geminiSaved) ||
                       (prefOrder[slot] === "groq" && groqSaved) ||
                       (prefOrder[slot] === "openrouter" && openRouterSaved) ? "● set" : "○ unset"}
                    </span>
                  </div>
                ))}
              </div>

              {/* ── Gemini Key ── */}
              <KeyCard
                label="Gemini API Key"
                placeholder="AIzaSy..."
                hint="Connects to gemini-2.5-flash. Never uploaded."
                value={geminiKey}
                onChange={setGeminiKey}
                saved={geminiSaved}
                onSave={() => saveKey("gemini")}
                onDelete={() => deleteKey("gemini")}
              />

              {/* ── Groq Key ── */}
              <KeyCard
                label="Groq API Key"
                placeholder="gsk_..."
                hint="Fast inference via Groq Cloud."
                value={groqKey}
                onChange={setGroqKey}
                saved={groqSaved}
                onSave={() => saveKey("groq")}
                onDelete={() => deleteKey("groq")}
              />

              {/* ── OpenRouter Key ── */}
              <KeyCard
                label="OpenRouter API Key"
                placeholder="sk-or-..."
                hint="Access 200+ models via OpenRouter."
                value={openRouterKey}
                onChange={setOpenRouterKey}
                saved={openRouterSaved}
                onSave={() => saveKey("openrouter")}
                onDelete={() => deleteKey("openrouter")}
              />

              {/* ── Local AI Toggle ── */}
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest font-bold block">Local AI (Ollama)</span>
                    <span className="text-[8px] text-gray-600">Run AI locally with Ollama. Requires Ollama running on localhost:11434.</span>
                  </div>
                  <button
                    onClick={toggleLocalAI}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      localAIEnabled ? 'bg-emerald-500' : 'bg-neutral-700'
                    }`}
                  >
                    <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${
                      localAIEnabled ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>
                {ollamaSetupDone && (
                  <div className="flex items-center gap-1.5 text-[8px] text-emerald-400">
                    <Cpu className="w-3 h-3" />
                    <span>Ollama setup complete</span>
                  </div>
                )}
              </div>

            </div>

            <div className="text-[8px] font-mono text-gray-600 text-center pt-1">
              Sidekick Secured Sandboxed Loop
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable API Key Card ──────────────────────────────────────────────────
function KeyCard({ label, placeholder, hint, value, onChange, saved, onSave, onDelete }) {
  return (
    <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest font-bold block">{label}</span>
          <span className="text-[8px] text-gray-600">{hint}</span>
        </div>
        {saved && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">● Saved</span>
        )}
      </div>
      {saved ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-neutral-900 border border-white/[0.05] rounded-lg px-3 py-1.5 text-[10px] font-mono text-gray-500 tracking-widest">
            ••••••••••••••••
          </div>
          <button
            onClick={onDelete}
            className="px-2.5 py-1.5 text-[9px] font-mono bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 rounded-lg transition-all shrink-0"
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-neutral-900 border border-white/[0.1] rounded-lg px-3 py-1.5 text-[10px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-white/30 min-w-0"
          />
          <button
            onClick={onSave}
            disabled={!value.trim()}
            className="px-2.5 py-1.5 text-[9px] font-mono bg-white text-black hover:bg-gray-200 active:scale-95 disabled:opacity-30 rounded-lg transition-all shrink-0"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
