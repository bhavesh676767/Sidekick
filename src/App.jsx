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
  X
} from "lucide-react";

import SidekickNotch from "./notch/SidekickNotch";

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
    app: "bg-[#f7f4ea] text-[#151512]",
    soft: "bg-[#fffdf5] border-[#d9d5c8]",
    panel: "bg-[#fbf8ef] border-[#d9d5c8]",
    raised: "bg-[#fffdf6] border-[#d9d5c8] shadow-[0_14px_30px_rgba(47,43,31,0.10)]",
    muted: "text-[#747062]",
    faint: "text-[#9a9585]",
    text: "text-[#151512]",
    input: "bg-[#f6f1e6] border-[#d6d0c1] text-[#151512] placeholder:text-[#aaa390]",
    ghost: "bg-[#ece6d6] text-[#24231f] hover:bg-[#e3dccb]",
    primary: "bg-[#dfff14] text-[#11120a] hover:bg-[#d3f000]",
    danger: "bg-[#151512] text-[#f7f4ea] hover:bg-[#2a2924]",
    statusOn: "bg-[#dfff14] text-[#151512]",
    statusOff: "bg-[#e9e3d2] text-[#756f60]"
  },
  dark: {
    app: "bg-[#161614] text-[#f5f1e7]",
    soft: "bg-[#22221f] border-[#35342f]",
    panel: "bg-[#1d1d1a] border-[#34332e]",
    raised: "bg-[#242420] border-[#3a3932] shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
    muted: "text-[#aaa696]",
    faint: "text-[#797568]",
    text: "text-[#f5f1e7]",
    input: "bg-[#151512] border-[#393831] text-[#f5f1e7] placeholder:text-[#777164]",
    ghost: "bg-[#32312b] text-[#f5f1e7] hover:bg-[#3b3a33]",
    primary: "bg-[#dfff14] text-[#11120a] hover:bg-[#d3f000]",
    danger: "bg-[#f5f1e7] text-[#151512] hover:bg-[#e8e1d0]",
    statusOn: "bg-[#dfff14] text-[#11120a]",
    statusOff: "bg-[#33322c] text-[#aaa696]"
  }
};

function ToggleRow({ theme, label, hint, value, onChange, disabled = false }) {
  const t = THEME[theme];
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${t.panel}`}>
      <div className="min-w-0">
        <div className={`text-[11px] font-black ${t.text}`}>{label}</div>
        <div className={`text-[9px] leading-relaxed ${t.muted}`}>{hint}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`flex h-7 w-12 items-center rounded-full p-1 transition disabled:opacity-40 ${value ? t.primary : t.ghost}`}
      >
        <span className={`h-5 w-5 rounded-full bg-current transition ${value ? "translate-x-5 text-[#11120a]" : "translate-x-0 text-[#f7f4ea]"}`} />
      </button>
    </div>
  );
}

function KeyCard({ theme, label, value, saved, onChange, onSave, onDelete, placeholder }) {
  const t = THEME[theme];
  return (
    <div className={`rounded-2xl border p-3 ${t.panel}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${t.faint}`}>{label}</span>
        {saved && <span className="rounded-full bg-[#dfff14] px-2 py-1 text-[9px] font-black text-[#11120a]">Saved</span>}
      </div>
      {saved ? (
        <div className="flex items-center gap-2">
          <div className={`flex-1 rounded-xl border px-3 py-2 text-[10px] tracking-[0.2em] ${t.input}`}>••••••••••••••••</div>
          <button onClick={onDelete} className={`rounded-xl px-3 py-2 text-[10px] font-black transition ${t.ghost}`}>
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
            className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-[11px] font-semibold outline-none transition focus:border-[#dfff14] ${t.input}`}
          />
          <button onClick={onSave} disabled={!value.trim()} className={`rounded-xl px-3 py-2 text-[10px] font-black transition disabled:opacity-35 ${t.primary}`}>
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
      className={`rounded-[22px] border p-3 text-left transition ${active ? "border-[#dfff14] bg-[#dfff14]/20" : t.panel}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${active ? "bg-[#dfff14] text-[#11120a]" : t.ghost}`}>
          <Icon className="h-4 w-4" />
        </span>
        {active && <Check className="h-4 w-4 text-[#97ad00]" />}
      </div>
      <div className={`text-sm font-black ${t.text}`}>{title}</div>
      <div className={`mt-1 text-[10px] leading-relaxed ${t.muted}`}>{body}</div>
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

  const t = THEME[theme];
  const hasApiKey = providerPriority.some((provider) => apiKeys[provider] && testedKeys[provider]);
  const aiReady = aiMode === "ollama" ? Boolean(ollamaStatus?.connected) : hasApiKey;
  const isWindowsDesktop = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent) && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  useEffect(() => {
    async function load() {
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

  const saveTheme = async (nextTheme, chosen = true) => {
    setTheme(nextTheme);
    setThemeChosen(chosen);
    await chromeApi.storage.local.set({ sidekickTheme: nextTheme, sidekickThemeChosen: chosen });
  };

  const launchSidekick = async () => {
    setLaunching(true);
    chromeApi.runtime.sendMessage({ action: "INJECT_NOTCH" }, (response) => {
      setLaunching(false);
      if (response?.success) setSidekickActive(true);
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

  if (booting) {
    return (
      <div className={`flex h-[520px] w-[360px] items-center justify-center ${t.app}`}>
        <div className="text-center">
          <img src="/sidekick_logo.png" alt="" className="mx-auto mb-4 h-14 w-14 rounded-2xl" />
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#9eb300]" />
        </div>
      </div>
    );
  }

  const settingsPanel = (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className={`w-full rounded-[28px] border p-4 ${t.raised}`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${t.faint}`}>Settings</div>
            <div className={`mt-1 text-base font-black ${t.text}`}>Tune the little helper</div>
          </div>
          <button onClick={() => setShowSettings(false)} className={`rounded-full p-2 transition ${t.ghost}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
          <div className={`rounded-2xl border p-3 ${t.panel}`}>
            <div className={`mb-2 text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>Theme</div>
            <div className="grid grid-cols-2 gap-2">
              <ThemeButton theme={theme} active={theme === "light"} icon={Sun} title="Cream" body="Soft, bright, cozy." onClick={() => saveTheme("light")} />
              <ThemeButton theme={theme} active={theme === "dark"} icon={Moon} title="Matte" body="Quiet charcoal." onClick={() => saveTheme("dark")} />
            </div>
          </div>

          <div className={`rounded-2xl border p-3 ${t.panel}`}>
            <div className={`mb-2 text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>AI mode</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => saveProviderMode("api")} className={`rounded-2xl px-3 py-2 text-[11px] font-black transition ${aiMode === "api" ? t.primary : t.ghost}`}>Cloud API</button>
              <button onClick={() => saveProviderMode("ollama")} className={`rounded-2xl px-3 py-2 text-[11px] font-black transition ${aiMode === "ollama" ? t.primary : t.ghost}`}>Local AI</button>
            </div>
          </div>

          {aiMode === "ollama" && (
            <div className={`space-y-2 rounded-2xl border p-3 ${t.panel}`}>
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>
                <Cpu className="h-3.5 w-3.5" />
                Ollama
              </div>
              <input value={ollamaBaseUrl} onChange={(e) => setOllamaBaseUrl(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold outline-none ${t.input}`} />
              <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold outline-none ${t.input}`} />
              <button onClick={testOllamaConnection} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black ${t.primary}`}>
                {testingOllama ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                Test connection
              </button>
              {ollamaStatus && <div className={`text-[10px] ${t.muted}`}>{ollamaStatus.connected ? "Connected" : ollamaStatus.error}</div>}
            </div>
          )}

          {aiMode === "api" && (
            <div className="space-y-3">
              <div className={`rounded-2xl border p-3 ${t.panel}`}>
                <div className={`mb-2 text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>Provider order</div>
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((slot) => (
                    <select
                      key={slot}
                      value={providerPriority[slot] || ""}
                      onChange={(e) => updateProviderPref(slot, e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold outline-none ${t.input}`}
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="claude">Claude</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="groq">Groq</option>
                    </select>
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

          {isWindowsDesktop && (
            <div className={`rounded-2xl border p-3 text-[10px] font-semibold leading-relaxed ${t.panel} ${t.muted}`}>
              Sidekick is prompt based. For dictation on Windows desktop, click the prompt field and press <span className={`font-black ${t.text}`}>Windows + H</span>.
            </div>
          )}

          <ToggleRow theme={theme} label="Memory learning" hint="Store lightweight learned preferences locally." value={appSettings.memoryLearning} onChange={(value) => saveAppSetting("memoryLearning", value)} />
        </div>
      </div>
    </div>
  );

  const firstRun = !themeChosen && (
    <div className={`absolute inset-0 z-[60] p-5 ${t.app}`}>
      <div className={`flex h-full flex-col rounded-[30px] border p-5 ${t.raised}`}>
        <div className="flex items-center gap-3">
          <img src="/sidekick_logo.png" alt="Sidekick" className="h-14 w-14 rounded-2xl object-cover" />
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${t.faint}`}>Sidekick</div>
            <h1 className={`text-2xl font-black leading-none ${t.text}`}>Pick a vibe</h1>
          </div>
        </div>
        <p className={`mt-4 text-[12px] font-semibold leading-relaxed ${t.muted}`}>
          Choose how Sidekick should look. You can switch this later in settings.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ThemeButton theme={theme} active={theme === "light"} icon={Sun} title="Cream light" body="Friendly and bright." onClick={() => setTheme("light")} />
          <ThemeButton theme={theme} active={theme === "dark"} icon={Moon} title="Matte dark" body="Soft charcoal." onClick={() => setTheme("dark")} />
        </div>
        <button onClick={() => saveTheme(theme, true)} className={`mt-auto inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${t.primary}`}>
          Start Sidekick
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={`relative flex h-[520px] w-[360px] flex-col overflow-hidden ${t.app}`}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rotate-12 rounded-[34px] bg-[#dfff14]/80" />
      <div className="pointer-events-none absolute -left-10 bottom-10 h-24 w-24 rounded-[28px] bg-[#b9d8ff]/40" />

      <header className="relative z-10 flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <img src="/sidekick_logo.png" alt="Sidekick" className="h-11 w-11 rounded-2xl object-cover shadow-sm" />
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${t.faint}`}>Sidekick</div>
            <div className={`mt-0.5 text-base font-black ${t.text}`}>Sidekick buddy</div>
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} className={`rounded-full p-2 transition ${t.ghost}`}>
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className={`rounded-[26px] border p-4 ${t.raised}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${sidekickActive ? t.statusOn : t.statusOff}`}>
                {sidekickActive ? "Live" : "Off"}
              </div>
              <p className={`mt-3 text-[12px] font-semibold leading-relaxed ${t.muted}`}>
                Launch the notch, type what you want, and Sidekick handles the browser work.
              </p>
            </div>
            <Sparkles className="mt-1 h-5 w-5 text-[#b7cf00]" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={launchSidekick} disabled={launching || !aiReady} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[11px] font-black transition disabled:opacity-35 ${t.primary}`}>
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Launch
            </button>
            <button onClick={hideSidekick} disabled={hiding || !sidekickActive} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-[11px] font-black transition disabled:opacity-35 ${t.ghost}`}>
              {hiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
              Hide
            </button>
          </div>

          {!aiReady && (
            <div className={`mt-3 rounded-2xl border border-[#dfff14]/40 bg-[#dfff14]/15 px-3 py-2 text-[10px] font-semibold leading-relaxed ${t.text}`}>
              Add an AI provider in settings before launching.
            </div>
          )}
        </div>

        <SidekickNotch theme={theme} active={sidekickActive} state={previewState} command={agentState.command} response={voiceState.lastResponse || agentState.result?.text} />

        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-[24px] border p-4 ${t.panel}`}>
            <div className={`mb-2 flex items-center gap-2 ${t.muted}`}>
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">Prompt</span>
            </div>
            <div className={`text-sm font-black ${t.text}`}>Text-first</div>
            <p className={`mt-2 text-[10px] font-semibold leading-relaxed ${t.muted}`}>
              {isWindowsDesktop ? "Windows + H works for dictation." : "Type prompts directly in the notch."}
            </p>
          </div>
          <div className={`rounded-[24px] border p-4 ${t.panel}`}>
            <div className={`mb-2 flex items-center gap-2 ${t.muted}`}>
              <Eye className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">Engine</span>
            </div>
            <div className={`text-sm font-black ${t.text}`}>{agentState.isRunning ? "Running" : "Ready"}</div>
            <p className={`mt-2 text-[10px] font-semibold leading-relaxed ${t.muted}`}>
              {agentState.currentAction || "Waiting for a task."}
            </p>
          </div>
        </div>

        <div className={`rounded-[24px] border p-4 ${t.panel}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${t.faint}`}>Recent activity</div>
            <button onClick={() => setShowSettings(true)} className={`text-[10px] font-black transition ${t.muted}`}>Settings</button>
          </div>
          <div className="space-y-2">
            {(agentState.logs || []).slice(0, 4).map((log, index) => (
              <div key={`${log.time}-${index}`} className={`rounded-2xl border px-3 py-2 ${t.soft}`}>
                <div className={`text-[11px] font-semibold ${t.text}`}>{log.message}</div>
                <div className={`mt-1 text-[9px] font-black uppercase tracking-[0.14em] ${t.faint}`}>{log.time}</div>
              </div>
            ))}
            {(!agentState.logs || agentState.logs.length === 0) && (
              <div className={`rounded-2xl border px-3 py-3 text-[10px] font-semibold ${t.soft} ${t.muted}`}>
                No recent tasks yet.
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
