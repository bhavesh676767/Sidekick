import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Settings,
  Sparkles,
  Sun,
  X,
  Play,
  Square
} from "lucide-react";

import SidekickNotch from "./notch/SidekickNotch";
import { MascotPlaceholder, Doodle } from "./components/Illustrations";

const chromeApi = (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage && chrome?.storage?.local) ? chrome : {
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {}
    }
  },
  runtime: {
    sendMessage: (_message, callback) => callback?.({ success: true, ui: {}, active: false, state: { logs: [] }, voiceState: {} }),
    onMessage: {
      addListener: () => {},
      removeListener: () => {}
    }
  }
};

const DEFAULT_SETTINGS = {
  voiceEnabled: false,
  voiceMode: "text",
  wakeWord: "sidekick",
  autoSpeak: false,
  preferredVoice: "",
  speechRate: 1,
  muted: false,
  memoryLearning: true
};

const THEME = {
  light: {
    app: "bg-[#f8f5eb] text-[#1c1c18] sketch-font",
    soft: "bg-[#fffef8] border-[#1c1c18]",
    panel: "bg-[#fcfaf4] border-[#1c1c18]",
    raised: "bg-[#fffefb] border-[#1c1c18]",
    muted: "text-[#6e6b5d]",
    faint: "text-[#928e7e]",
    text: "text-[#1c1c18]",
    input: "bg-[#fffefc] border-[#1c1c18] text-[#1c1c18] placeholder:text-[#9e9a8b]",
    ghost: "bg-[#ebe5d3] text-[#1c1c18] border-[#1c1c18] hover:bg-[#ded7c3]",
    primary: "bg-[#dfff14] text-[#1c1c18] border-[#1c1c18] hover:bg-[#d0ed00]",
    danger: "bg-[#ffccd5] text-[#80061e] border-[#1c1c18] hover:bg-[#ffb3c1]",
    statusOn: "bg-[#dfff14] text-[#1c1c18] border-[#1c1c18]",
    statusOff: "bg-[#ebe5d3] text-[#6e6b5d] border-[#1c1c18]"
  },
  dark: {
    app: "bg-[#181816] text-[#f7f3e8] sketch-font",
    soft: "bg-[#252522] border-[#f7f3e8]",
    panel: "bg-[#1f1f1c] border-[#f7f3e8]",
    raised: "bg-[#282824] border-[#f7f3e8]",
    muted: "text-[#b2ae9e]",
    faint: "text-[#838073]",
    text: "text-[#f7f3e8]",
    input: "bg-[#121210] border-[#f7f3e8] text-[#f7f3e8] placeholder:text-[#838073]",
    ghost: "bg-[#35342e] text-[#f7f3e8] border-[#f7f3e8] hover:bg-[#3f3e37]",
    primary: "bg-[#dfff14] text-[#11120a] border-[#f7f3e8] hover:bg-[#d0ed00]",
    danger: "bg-[#4d101a] text-[#ffccd5] border-[#f7f3e8] hover:bg-[#601420]",
    statusOn: "bg-[#dfff14] text-[#11120a] border-[#f7f3e8]",
    statusOff: "bg-[#35342e] text-[#b2ae9e] border-[#f7f3e8]"
  }
};

// Cute, raw, hand-drawn Loading Screen
function Preloader({ message = "Booting Sidekick..." }) {
  return (
    <div className="w-[360px] h-[520px] bg-[#f8f5eb] text-[#1c1c18] flex flex-col items-center justify-center animate-fade-in p-6 sketch-font">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center animate-spin-slow">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-[#dfff14] border-2 border-current flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[#1c1c18] font-black text-sm">S</span>
            </div>
          </div>
        </div>
      </div>
      <h2 className="text-base font-black tracking-widest uppercase mb-1">Sidekick</h2>
      <p className="text-xs font-bold font-mono flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#928e7e]" />
        {message}
      </p>
    </div>
  );
}

function ToggleRow({ theme, label, hint, value, onChange, disabled = false }) {
  const t = THEME[theme];
  return (
    <div className={`flex items-center justify-between gap-3 sketch-border-sm px-3 py-2.5 ${t.panel}`}>
      <div className="min-w-0">
        <div className={`text-[11px] font-black ${t.text}`}>{label}</div>
        <div className={`text-[9px] leading-relaxed ${t.muted}`}>{hint}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`flex h-7 w-12 items-center rounded-full p-1 border-2 border-current transition disabled:opacity-40 ${value ? "bg-[#dfff14]" : t.ghost}`}
      >
        <span className={`h-4.5 w-4.5 rounded-full border border-current bg-white transition ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function KeyCard({ theme, label, value, saved, onChange, onSave, onDelete, placeholder }) {
  const t = THEME[theme];
  return (
    <div className={`sketch-border-sm p-3 ${t.panel}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${t.faint}`}>{label}</span>
        {saved && <span className="sketch-border-sm bg-[#dfff14] px-2 py-0.5 text-[9px] font-black text-[#11120a] sketch-shadow-sm">Saved</span>}
      </div>
      {saved ? (
        <div className="flex items-center gap-2">
          <div className={`flex-1 sketch-border-sm px-3 py-1.5 text-[10px] tracking-[0.2em] ${t.input}`}>••••••••••••••••</div>
          <button onClick={onDelete} className={`sketch-border-sm px-3 py-1.5 text-[10px] font-black transition sketch-shadow-sm ${t.ghost}`}>
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`min-w-0 flex-1 sketch-border-sm px-3 py-1.5 text-[11px] font-semibold outline-none transition focus:bg-white dark:focus:bg-neutral-950 ${t.input}`}
          />
          <button onClick={onSave} disabled={!value.trim()} className={`sketch-border-sm px-3 py-1.5 text-[10px] font-black transition disabled:opacity-35 sketch-shadow-sm ${t.primary}`}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeButton({ theme, value, icon: Icon, title, body, active, onClick }) {
  const t = THEME[theme];
  return (
    <button
      onClick={onClick}
      className={`sketch-border-sm p-3 text-left transition sketch-shadow-sm ${active ? "border-[#dfff14] bg-[#dfff14]/20" : t.panel}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-full border border-current ${active ? "bg-[#dfff14] text-[#11120a]" : t.ghost}`}>
          <Icon className="h-4 w-4" />
        </span>
        {active && <Check className="h-4 w-4 text-[#97ad00]" />}
      </div>
      <div className={`text-xs font-black ${t.text}`}>{title}</div>
      <div className={`mt-1 text-[9px] leading-relaxed ${t.muted}`}>{body}</div>
    </button>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [sidekickActive, setSidekickActive] = useState(false);
  const [theme, setTheme] = useState("light");
  const [themeChosen, setThemeChosen] = useState(false);
  const [agentState, setAgentState] = useState({ command: "", isRunning: false, currentAction: "Idle", result: null, logs: [] });
  const [voiceState, setVoiceState] = useState({ mode: "idle", lastResponse: "", transcript: "", error: null });
  const [appSettings, setAppSettings] = useState(DEFAULT_SETTINGS);
  const [aiMode, setAiMode] = useState("api");
  const [providerPriority, setProviderPriority] = useState(["gemini", "openrouter", "groq", "openai", "claude"]);
  const [apiKeys, setApiKeys] = useState({ gemini: "", openrouter: "", groq: "", claude: "", openai: "" });
  const [testedKeys, setTestedKeys] = useState({ gemini: false, openrouter: false, groq: false, claude: false, openai: false });
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:3b");
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [testingOllama, setTestingOllama] = useState(false);

  // Home Page Prompt Input State
  const [promptInput, setPromptInput] = useState("");

  const t = THEME[theme];
  const hasApiKey = providerPriority.some((provider) => apiKeys[provider] && testedKeys[provider]);
  const aiReady = aiMode === "ollama" ? Boolean(ollamaStatus?.connected) : hasApiKey;
  const isWindowsDesktop = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent) && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  useEffect(() => {
    async function load() {
      setBooting(true);
      const stored = await chromeApi.storage.local.get([
        "aiMode",
        "providerPriority",
        "apiKeys",
        "ollamaBaseUrl",
        "ollamaModel",
        "voiceSettings",
        "sidekickTheme",
        "sidekickThemeChosen"
      ]);
      if (stored.sidekickTheme) setTheme(stored.sidekickTheme);
      setThemeChosen(Boolean(stored.sidekickThemeChosen));
      if (stored.aiMode) setAiMode(stored.aiMode);
      if (stored.providerPriority) setProviderPriority(stored.providerPriority);
      if (stored.apiKeys) {
        setApiKeys((prev) => ({ ...prev, ...stored.apiKeys }));
        const nextTested = {};
        Object.keys(stored.apiKeys).forEach((key) => {
          if (stored.apiKeys[key]) nextTested[key] = true;
        });
        setTestedKeys((prev) => ({ ...prev, ...nextTested }));
      }
      if (stored.ollamaBaseUrl) setOllamaBaseUrl(stored.ollamaBaseUrl);
      if (stored.ollamaModel) setOllamaModel(stored.ollamaModel);
      if (stored.voiceSettings) setAppSettings((prev) => ({ ...prev, ...stored.voiceSettings }));

      chromeApi.runtime.sendMessage({ action: "GET_SIDEKICK_STATUS" }, (response) => {
        if (response?.success) {
          setSidekickActive(Boolean(response.active));
          setAgentState(response.state || {});
          setVoiceState(response.voiceState || {});
        }
        setBooting(false);
      });

      if ((stored.aiMode || aiMode) === "ollama") {
        chromeApi.runtime.sendMessage({ action: "CHECK_OLLAMA" }, (resp) => {
          setOllamaStatus(resp?.connected ? { connected: true, models: resp.models || [] } : { connected: false, error: resp?.error || "Offline" });
        });
      }
    }

    load();
  }, []);

  useEffect(() => {
    const listener = (message) => {
      if (message.action === "STATE_UPDATED") setAgentState(message.state);
      else if (message.action === "VOICE_STATE_UPDATED") setVoiceState(message.voiceState);
      else if (message.action === "SIDEKICK_ENABLED") setSidekickActive(Boolean(message.enabled));
    };
    chromeApi.runtime.onMessage.addListener(listener);
    return () => chromeApi.runtime.onMessage.removeListener(listener);
  }, []);

  const previewState = useMemo(() => {
    if (voiceState?.error) return "error";
    if (agentState?.isRunning) return "processing";
    return "idle";
  }, [agentState?.isRunning, voiceState?.error]);

  // Theme selection is handled by the firstRun overlay below (line ~483)

  const saveTheme = async (nextTheme, chosen = true) => {
    setTheme(nextTheme);
    setThemeChosen(chosen);
    await chromeApi.storage.local.set({ sidekickTheme: nextTheme, sidekickThemeChosen: chosen });
  };

  const launchSidekick = async () => {
    setLaunching(true);
    return new Promise((resolve) => {
      chromeApi.runtime.sendMessage({ action: "INJECT_NOTCH" }, (response) => {
        setLaunching(false);
        if (response?.success) setSidekickActive(true);
        resolve(response?.success);
      });
    });
  };

  const hideSidekick = async () => {
    setHiding(true);
    chromeApi.runtime.sendMessage({ action: "REMOVE_NOTCH" }, (response) => {
      setHiding(false);
      if (response?.success) setSidekickActive(false);
    });
  };

  const saveKey = async (provider, value) => {
    if (!value.trim()) return;
    chromeApi.runtime.sendMessage({ action: "TEST_API_KEY", provider, apiKey: value.trim() }, async (res) => {
      if (!res?.success) return;
      const stored = await chromeApi.storage.local.get("apiKeys");
      const next = { ...(stored.apiKeys || {}), [provider]: value.trim() };
      await chromeApi.storage.local.set({ apiKeys: next });
      setApiKeys((prev) => ({ ...prev, [provider]: value.trim() }));
      setTestedKeys((prev) => ({ ...prev, [provider]: true }));
    });
  };

  const deleteKey = async (provider) => {
    const stored = await chromeApi.storage.local.get("apiKeys");
    const next = { ...(stored.apiKeys || {}) };
    delete next[provider];
    await chromeApi.storage.local.set({ apiKeys: next });
    setApiKeys((prev) => ({ ...prev, [provider]: "" }));
    setTestedKeys((prev) => ({ ...prev, [provider]: false }));
  };

  const saveAppSetting = async (key, value) => {
    const next = { ...appSettings, [key]: value };
    setAppSettings(next);
    await chromeApi.storage.local.set({ voiceSettings: next });
    chromeApi.runtime.sendMessage({ action: "UPDATE_VOICE_SETTINGS", preferences: { memoryLearning: next.memoryLearning } });
  };

  const updateProviderPref = async (slot, newProvider) => {
    const current = [...providerPriority];
    const existingSlot = current.indexOf(newProvider);
    if (existingSlot !== -1 && existingSlot !== slot) current[existingSlot] = current[slot];
    current[slot] = newProvider;
    setProviderPriority(current);
    await chromeApi.storage.local.set({ providerPriority: current });
  };

  const saveProviderMode = async (mode = aiMode) => {
    setAiMode(mode);
    await chromeApi.storage.local.set({ aiMode: mode, ollamaBaseUrl, ollamaModel, providerPriority });
    if (mode === "ollama") testOllamaConnection();
  };

  const testOllamaConnection = async () => {
    setTestingOllama(true);
    await chromeApi.storage.local.set({ ollamaBaseUrl, ollamaModel });
    chromeApi.runtime.sendMessage({ action: "CHECK_OLLAMA" }, (resp) => {
      setTestingOllama(false);
      setOllamaStatus(resp?.connected ? { connected: true, models: resp.models || [] } : { connected: false, error: resp?.error || "Offline" });
    });
  };

  // Submit Prompt from Popup Input field
  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || !aiReady) return;

    let active = sidekickActive;
    if (!active) {
      const ok = await launchSidekick();
      if (!ok) return;
    }

    chromeApi.runtime.sendMessage({ action: "START_AGENT", command: promptInput.trim(), source: "text" }, (response) => {
      if (response?.success) {
        setPromptInput("");
      }
    });
  };

  const handleStopAgent = () => {
    chromeApi.runtime.sendMessage({ action: "STOP_AGENT" });
  };

  // Interactive Mascot Speech Bubble Content
  const bubbleText = useMemo(() => {
    if (!aiReady) return "Wait, my brain is unplugged! Please click below to connect an AI key or Ollama in settings so I can browse with you!";
    if (agentState.isRunning) {
      if (agentState.currentAction.toLowerCase().includes("reasoning")) return "Thinking hard about what to do next... 🤔";
      if (agentState.currentAction.toLowerCase().includes("executing")) return `Working on: ${agentState.currentAction.replace(/Step \d+: Executing /g, "")}! 🚀`;
      return `${agentState.currentAction}`;
    }
    if (sidekickActive) return "Yay! I am live on your browser page. Type a command in the box below and watch me work! 📝";
    return "Hey Bhavesh! I am ready to be your browser buddy. Launch me or type a task below to start pair browsing! 🎈";
  }, [aiReady, agentState.isRunning, agentState.currentAction, sidekickActive]);

  // Show Preloader if booting, launching or hiding
  if (booting) {
    return <Preloader message="Starting Sidekick..." />;
  }

  const settingsPanel = (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className={`w-full max-h-[480px] sketch-border p-4 ${t.raised} flex flex-col sketch-shadow`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${t.faint}`}>Settings</div>
            <div className={`mt-0.5 text-base font-black ${t.text}`}>Tune your buddy</div>
          </div>
          <button onClick={() => setShowSettings(false)} className={`sketch-border-sm p-1.5 transition sketch-shadow-sm ${t.ghost}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>AI Provider Mode</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => saveProviderMode("api")} className={`sketch-border-sm px-3 py-2 text-[11px] font-black transition sketch-shadow-sm ${aiMode === "api" ? t.primary : t.ghost}`}>Cloud API</button>
              <button onClick={() => saveProviderMode("ollama")} className={`sketch-border-sm px-3 py-2 text-[11px] font-black transition sketch-shadow-sm ${aiMode === "ollama" ? t.primary : t.ghost}`}>Local Ollama</button>
            </div>
          </div>

          {aiMode === "ollama" && (
            <div className={`space-y-2.5 sketch-border-sm p-3 ${t.panel}`}>
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>
                <Cpu className="h-3.5 w-3.5" />
                Ollama Local Server
              </div>
              <input value={ollamaBaseUrl} onChange={(e) => setOllamaBaseUrl(e.target.value)} placeholder="Ollama Server URL" className={`w-full sketch-border-sm px-3 py-1.5 text-[11px] font-semibold outline-none ${t.input}`} />
              <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="Model (e.g. qwen2.5:3b)" className={`w-full sketch-border-sm px-3 py-1.5 text-[11px] font-semibold outline-none ${t.input}`} />
              <button onClick={testOllamaConnection} className={`inline-flex w-full items-center justify-center gap-2 sketch-border-sm px-3 py-1.5 text-[11px] font-black sketch-shadow-sm ${t.primary}`}>
                {testingOllama ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                Connect & Test
              </button>
              {ollamaStatus && <div className={`text-[10px] font-bold ${ollamaStatus.connected ? "text-emerald-500" : "text-red-500"}`}>{ollamaStatus.connected ? "Connected!" : ollamaStatus.error}</div>}
            </div>
          )}

          {aiMode === "api" && (
            <div className="space-y-4">
              <div className={`space-y-2 sketch-border-sm p-3 ${t.panel}`}>
                <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>Preferred Provider Order</div>
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((slot) => (
                    <div key={slot} className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-gray-500">Choice {slot + 1}:</span>
                      <select
                        value={providerPriority[slot] || ""}
                        onChange={(e) => updateProviderPref(slot, e.target.value)}
                        className={`flex-1 sketch-border-sm px-3 py-1 text-[11px] font-semibold outline-none ${t.input}`}
                      >
                        <option value="gemini">Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Claude</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="groq">Groq</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {Array.from(new Set(providerPriority)).map((provider) => (
                <KeyCard
                  key={provider}
                  theme={theme}
                  label={`${provider} key`}
                  value={apiKeys[provider] || ""}
                  saved={Boolean(testedKeys[provider])}
                  onChange={(value) => setApiKeys((prev) => ({ ...prev, [provider]: value }))}
                  onSave={() => saveKey(provider, apiKeys[provider] || "")}
                  onDelete={() => deleteKey(provider)}
                  placeholder={`Enter ${provider} key`}
                />
              ))}
            </div>
          )}

          <div className="sketch-divider" />

          <ToggleRow theme={theme} label="Auto-Memory learning" hint="Remember browser styles and workflow choices." value={appSettings.memoryLearning} onChange={(value) => saveAppSetting("memoryLearning", value)} />
        </div>
      </div>
    </div>
  );

  const firstRun = !themeChosen && (
    <div className={`absolute inset-0 z-[60] p-5 ${t.app}`}>
      <div className={`flex h-full flex-col sketch-border-lg p-5 ${t.raised} sketch-shadow-lg`}>
        <div className="flex items-center gap-3">
          <div className="sketch-border bg-[#dfff14] w-12 h-12 flex items-center justify-center font-black text-lg shadow-[3px_3px_0px_0px_currentColor]">S</div>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${t.faint}`}>Sidekick</div>
            <h1 className={`text-xl font-black leading-none ${t.text}`}>Pick your theme</h1>
          </div>
        </div>
        <p className={`mt-4 text-[12px] font-semibold leading-relaxed ${t.muted}`}>
          Welcome! I am your raw, handdrawn pair browsing buddy. Pick a visual vibe to get started. You can toggle this later in Settings.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ThemeButton theme={theme} active={theme === "light"} icon={Sun} title="Cream light" body="Cozy paper feel." onClick={() => setTheme("light")} />
          <ThemeButton theme={theme} active={theme === "dark"} icon={Moon} title="Matte dark" body="Warm charcoal." onClick={() => setTheme("dark")} />
        </div>
        <button onClick={() => saveTheme(theme, true)} className={`mt-auto inline-flex items-center justify-center gap-2 sketch-border px-4 py-2.5 text-sm font-black sketch-shadow ${t.primary}`}>
          Start Sidekick Buddy! ➔
        </button>
      </div>
    </div>
  );

  return (
    <div className={`relative flex h-[520px] w-[360px] flex-col overflow-hidden ${t.app}`}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rotate-12 rounded-[34px] bg-[#dfff14]/30" />
      <div className="pointer-events-none absolute -left-10 bottom-10 h-24 w-24 rounded-[28px] bg-[#b9d8ff]/25" />

      {/* Header Banner */}
      <header className="relative z-10 flex items-center justify-between px-4 pb-2.5 pt-4">
        <div className="flex items-center gap-3">
          <div className="sketch-border bg-[#dfff14] w-9 h-9 flex items-center justify-center font-black text-sm sketch-shadow-sm">S</div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-black ${t.text}`}>Sidekick Buddy</span>
              <span className={`inline-block w-2.5 h-2.5 rounded-full border border-current ${sidekickActive ? "bg-[#dfff14]" : "bg-red-400"}`}></span>
            </div>
            <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${t.faint}`}>Pair Browsing Assistant</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick theme toggler */}
          <button 
            onClick={() => saveTheme(theme === "light" ? "dark" : "light", true)}
            className={`sketch-border-sm p-1.5 transition sketch-shadow-sm ${t.ghost}`}
            title="Toggle Theme"
          >
            {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
          {/* Settings cog */}
          <button 
            onClick={() => setShowSettings(true)} 
            className={`sketch-border-sm p-1.5 transition sketch-shadow-sm ${t.ghost}`}
            title="Open Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        
        {/* Offline warning banner if no API Key/Ollama connected (inform user here on home page!) */}
        {!aiReady && (
          <div className="sketch-border p-3 bg-[#ffe5ec] dark:bg-[#3d0814] text-[#80061e] dark:text-[#ffccd5] text-xs leading-relaxed sketch-shadow flex flex-col gap-1.5 animate-slide-up">
            <span className="font-black flex items-center gap-1.5 text-xs uppercase tracking-wider">
              ⚠️ offline buddy (no brain)
            </span>
            <p className="font-semibold">I have no active AI model key configured! Please connect an API key or local Ollama server in settings so I can reasoning and browse for you.</p>
            <button 
              onClick={() => setShowSettings(true)} 
              className={`sketch-border-sm px-2.5 py-1 text-center font-black bg-[#80061e] dark:bg-[#ffccd5] text-[#ffe5ec] dark:text-[#3d0814] self-start text-[10px] tracking-wide mt-1 sketch-shadow-sm hover:translate-y-0.5`}
            >
              Add API Key / Connect Ollama ➔
            </button>
          </div>
        )}

        {/* Mascot Speech Bubble Section */}
        <div className="flex items-start gap-3 pt-1">
          <div className="w-12 h-12 shrink-0 flex items-center justify-center">
            <MascotPlaceholder className="w-12 h-12 scale-125" />
          </div>
          {/* Sketchy Speech bubble */}
          <div className="relative border-2 border-current p-2.5 rounded-2xl bg-white dark:bg-[#1a1a1a] text-[11px] font-black leading-relaxed sketch-shadow-sm flex-1">
            <div className="absolute left-[-7px] top-4.5 w-0 h-0 border-t-[6px] border-t-transparent border-r-[7px] border-r-current border-b-[6px] border-b-transparent"></div>
            <p>{bubbleText}</p>
          </div>
        </div>

        {/* THE PROMPT INPUT - THE MOST MAIN SPOT IN THE CENTER! */}
        <div className={`sketch-border-lg p-3 ${t.raised} sketch-shadow`}>
          <div className={`mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] ${t.faint}`}>
            <Sparkles className="h-3.5 w-3.5 text-[#b7cf00]" />
            Direct browser prompt
          </div>
          <form onSubmit={handlePromptSubmit} className="space-y-2">
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePromptSubmit(e);
                }
              }}
              disabled={!aiReady}
              placeholder={aiReady ? "Type a task (e.g. 'open reddit and post a status' or 'find best phone')..." : "Configure an AI connection in Settings to unlock..."}
              className={`w-full h-16 bg-transparent resize-none outline-none border-none sketch-font text-sm leading-relaxed ${t.text} disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            <div className="flex gap-2 justify-between items-center">
              <span className={`text-[9px] font-bold ${t.muted}`}>Press Enter to submit</span>
              
              <div className="flex gap-2">
                {agentState.isRunning && (
                  <button 
                    type="button"
                    onClick={handleStopAgent}
                    className={`sketch-border-sm sketch-shadow-sm px-3.5 py-1.5 flex items-center gap-1.5 font-black text-xs transition ${t.danger}`}
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </button>
                )}
                
                <button 
                  type="submit" 
                  disabled={!promptInput.trim() || !aiReady || agentState.isRunning} 
                  className={`sketch-border-sm sketch-shadow-sm px-4 py-1.5 flex items-center gap-1.5 font-black text-xs transition ${promptInput.trim() && aiReady && !agentState.isRunning ? t.primary : 'opacity-40 cursor-not-allowed'}`}
                >
                  <Play className="h-3 w-3 fill-current" />
                  Go! 🚀
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Task Progress & Notch Preview - Displays only when active or running */}
        {(agentState.isRunning || sidekickActive) && (
          <div className="sketch-divider" />
        )}

        {agentState.isRunning && (
          <div className={`sketch-border p-3.5 ${t.soft} sketch-shadow space-y-2.5 animate-slide-up`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-500 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Browser agent executing task
              </span>
              <span className={`text-[9px] font-bold ${t.faint}`}>Step {agentState.currentStep || 1}</span>
            </div>
            
            <div className={`p-2 sketch-border-sm bg-[#fffdf6] dark:bg-[#1f1f1d] text-xs font-semibold ${t.text}`}>
              {agentState.currentAction}
            </div>

            {/* Scrollable logs preview */}
            <div className="space-y-1.5">
              <span className={`text-[9px] font-black uppercase tracking-[0.14em] ${t.faint}`}>Execution Logs</span>
              <div className={`max-h-24 overflow-y-auto sketch-border-sm p-2 ${t.panel} text-[10px] font-mono leading-relaxed space-y-1`}>
                {(agentState.logs || []).slice(-4).map((log, idx) => (
                  <div key={idx} className={`${t.text}`}>
                    <span className={`font-black uppercase tracking-[0.08em] ${t.faint}`}>[{log.time}]</span> {log.message}
                  </div>
                ))}
                {(!agentState.logs || agentState.logs.length === 0) && (
                  <div className={`text-center ${t.muted}`}>Starting browser steps...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sidekick Notch Control Panel */}
        <div className={`sketch-border p-3 ${t.soft} sketch-shadow-sm flex items-center justify-between gap-3`}>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${t.faint}`}>Notch Buddy Control</div>
            <p className={`text-[10px] font-semibold leading-relaxed mt-0.5 ${t.muted}`}>
              Inject the voice control notch directly onto the current tab.
            </p>
          </div>
          <div className="flex gap-2">
            {sidekickActive ? (
              <button onClick={hideSidekick} disabled={hiding} className={`sketch-border-sm sketch-shadow-sm px-3 py-1.5 text-[10px] font-black whitespace-nowrap ${t.ghost}`}>
                {hiding ? <Loader2 className="h-3 w-3 animate-spin" /> : <EyeOff className="h-3 w-3 inline mr-1" />}
                Hide Notch
              </button>
            ) : (
              <button onClick={launchSidekick} disabled={launching || !aiReady} className={`sketch-border-sm sketch-shadow-sm px-3 py-1.5 text-[10px] font-black whitespace-nowrap ${t.primary}`}>
                {launching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 inline mr-1" />}
                Launch Notch
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className={`sketch-border p-3.5 ${t.panel} sketch-shadow-sm`}>
          <div className="mb-2 flex items-center justify-between">
            <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${t.faint}`}>Recent Tasks</div>
            <Doodle type="dots" className="h-4 w-12 opacity-35" />
          </div>
          <div className="space-y-1.5">
            {(agentState.logs || []).slice(0, 2).map((log, index) => (
              <div key={`${log.time}-${index}`} className={`sketch-border-sm px-3 py-1.5 bg-[#fcfaf2] dark:bg-[#1a1a17] text-[11px] leading-relaxed ${t.text}`}>
                <div className="font-semibold">{log.message}</div>
                <div className={`mt-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${t.faint}`}>{log.time}</div>
              </div>
            ))}
            {(!agentState.logs || agentState.logs.length === 0) && (
              <div className={`text-center py-2 text-[10px] font-semibold ${t.muted}`}>
                No recent browse operations found.
              </div>
            )}
          </div>
        </div>

      </div>

      {showSettings && settingsPanel}
      {firstRun}
    </div>
  );
}
