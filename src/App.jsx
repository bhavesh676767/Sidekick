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
  Info
} from "lucide-react";

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

  // API Key & Settings
  const [apiKey, setApiKey] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      // 1. Fetch saved API Key
      const keyData = await chrome.storage.local.get("geminiApiKey");
      if (keyData.geminiApiKey) {
        setIsKeySaved(true);
        setApiKey(keyData.geminiApiKey);
      }

      setPreloaderMessage("Restoring active sessions...");
      // 2. Fetch current running agent state from background.js
      chrome.runtime.sendMessage({ action: "GET_STATE" }, (response) => {
        if (response) {
          setAgentState(response);
        }
        // Artificial delay for smooth aesthetic wow factor transition
        setTimeout(() => {
          setInitLoading(false);
        }, 1200);
      });
    }

    loadData();
  }, []);

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

  // Save API Key
  const handleSaveApiKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    await chrome.storage.local.set({ geminiApiKey: trimmed });
    setIsKeySaved(true);
    setShowSettings(false);
  };

  // Reset API Key
  const handleResetApiKey = async () => {
    await chrome.storage.local.remove("geminiApiKey");
    setApiKey("");
    setIsKeySaved(false);
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
          title="Configure Gemini API"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* ---- Main Body Layout ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* API Key Banner Warning if missing */}
        {!isKeySaved && (
          <div className="p-3 bg-neutral-950 border border-dashed border-red-500/30 rounded-xl flex items-start gap-2.5 animate-slide-up text-xs">
            <Lock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-red-400 block">Gemini API Key Required</span>
              <p className="text-gray-400 text-[10px] leading-relaxed mb-1.5">
                Paste your Gemini Flash key to activate browser execution tools.
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
        {isKeySaved && !agentState.isRunning && !agentState.askUserQuestion && (
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
      </footer>

      {/* ---- Settings Overlay Modal ---- */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full bg-neutral-950 border border-white/10 rounded-2xl p-4 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-white" />
                <h3 className="text-xs font-black uppercase tracking-wider">Settings</h3>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-gray-400 uppercase tracking-widest block font-bold">Gemini API Key</label>
                <p className="text-[8px] text-gray-500 leading-relaxed">
                  Used directly from your browser to connect to gemini-2.5-flash. Key is never uploaded elsewhere.
                </p>
              </div>

              {isKeySaved ? (
                <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">API Key Stored Safely</span>
                  </div>
                  <button 
                    onClick={handleResetApiKey}
                    className="px-2.5 py-1 text-[9px] font-mono bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 rounded transition-all"
                  >
                    Delete Key
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your AIzaSy... API key"
                    className="w-full bg-neutral-900 border border-white/[0.1] rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                  <button 
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim()}
                    className="w-full py-2 bg-white text-black hover:bg-gray-200 active:scale-95 disabled:opacity-40 disabled:hover:bg-white rounded-xl text-xs font-bold transition-all"
                  >
                    Save Configuration
                  </button>
                </div>
              )}
            </div>

            <div className="text-[8px] font-mono text-gray-600 text-center pt-2">
              Sidekick Secured Sandboxed Loop
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
