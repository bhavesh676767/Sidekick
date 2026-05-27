import React, { useEffect, useMemo, useState } from "react";
import {
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  Settings,
  Sparkles,
  Volume2,
  X
} from "lucide-react";

import SidekickNotch from "./notch/SidekickNotch";

const DEFAULT_VOICE_SETTINGS = {
  voiceEnabled: true,
  voiceMode: "manual",
  wakeWord: "sidekick",
  autoSpeak: true,
  preferredVoice: "",
  speechRate: 1,
  muted: false,
  memoryLearning: true
};

function ToggleRow({ label, hint, value, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-white">{label}</div>
        <div className="text-[9px] leading-relaxed text-white/45">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`flex h-6 w-10 items-center rounded-full transition-all disabled:opacity-40 ${
          value ? "bg-white" : "bg-white/15"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full transition-all ${
            value ? "translate-x-5 bg-black" : "translate-x-1 bg-white"
          }`}
        />
      </button>
    </div>
  );
}

function KeyCard({ label, value, saved, onChange, onSave, onDelete, placeholder }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</span>
        {saved && <span className="text-[9px] text-emerald-300">Saved</span>}
      </div>
      {saved ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-white/6 bg-black/50 px-3 py-2 text-[10px] tracking-[0.25em] text-white/30">
            ••••••••••••••••
          </div>
          <button onClick={onDelete} className="rounded-xl bg-white/6 px-3 py-2 text-[10px] text-white/75 transition hover:bg-white/10">
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
            className="min-w-0 flex-1 rounded-xl border border-white/8 bg-black/50 px-3 py-2 text-[11px] text-white outline-none transition placeholder:text-white/20 focus:border-white/25"
          />
          <button onClick={onSave} disabled={!value.trim()} className="rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-30">
            Save
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [sidekickActive, setSidekickActive] = useState(false);
  const [agentState, setAgentState] = useState({
    command: "",
    isRunning: false,
    currentAction: "Idle",
    result: null,
    logs: []
  });
  const [voiceState, setVoiceState] = useState({
    mode: "idle",
    lastResponse: "",
    transcript: "",
    error: null
  });
  const [voiceSettings, setVoiceSettings] = useState(DEFAULT_VOICE_SETTINGS);
  const [aiMode, setAiMode] = useState("api");
  const [providerPriority, setProviderPriority] = useState(["gemini", "openrouter", "groq", "openai", "claude"]);
  const [apiKeys, setApiKeys] = useState({ gemini: "", openrouter: "", groq: "", claude: "", openai: "" });
  const [testedKeys, setTestedKeys] = useState({ gemini: false, openrouter: false, groq: false, claude: false, openai: false });
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://127.0.0.1:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:3b");
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [testingOllama, setTestingOllama] = useState(false);

  const hasApiKey = providerPriority.some((provider) => apiKeys[provider] && testedKeys[provider]);
  const aiReady = aiMode === "ollama" ? Boolean(ollamaStatus?.connected) : hasApiKey;
  const statusTone = sidekickActive ? "text-emerald-300" : "text-white/45";

  useEffect(() => {
    async function load() {
      const stored = await chrome.storage.local.get([
        "aiMode",
        "providerPriority",
        "apiKeys",
        "ollamaBaseUrl",
        "ollamaModel",
        "voiceSettings"
      ]);
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
      if (stored.voiceSettings) setVoiceSettings((prev) => ({ ...prev, ...stored.voiceSettings }));

      chrome.runtime.sendMessage({ action: "GET_SIDEKICK_STATUS" }, (response) => {
        if (response?.success) {
          setSidekickActive(Boolean(response.active));
          setAgentState(response.state || {});
          setVoiceState(response.voiceState || {});
        }
        setBooting(false);
      });

      if ((stored.aiMode || aiMode) === "ollama") {
        chrome.runtime.sendMessage({ action: "CHECK_OLLAMA" }, (resp) => {
          setOllamaStatus(resp?.connected ? { connected: true, models: resp.models || [] } : { connected: false, error: resp?.error || "Offline" });
        });
      }
    }

    load();
  }, []);

  useEffect(() => {
    const listener = (message) => {
      if (message.action === "STATE_UPDATED") {
        setAgentState(message.state);
      } else if (message.action === "VOICE_STATE_UPDATED") {
        setVoiceState(message.voiceState);
      } else if (message.action === "SIDEKICK_ENABLED") {
        setSidekickActive(Boolean(message.enabled));
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const previewState = useMemo(() => {
    if (voiceState?.error) return "error";
    if (voiceState?.mode === "speaking") return "speaking";
    if (voiceState?.mode === "listening") return "listening";
    if (agentState?.isRunning) return "processing";
    return "idle";
  }, [agentState?.isRunning, voiceState?.error, voiceState?.mode]);

  const launchSidekick = async () => {
    setLaunching(true);
    chrome.runtime.sendMessage({ action: "INJECT_NOTCH" }, (response) => {
      setLaunching(false);
      if (response?.success) setSidekickActive(true);
    });
  };

  const hideSidekick = async () => {
    setHiding(true);
    chrome.runtime.sendMessage({ action: "REMOVE_NOTCH" }, (response) => {
      setHiding(false);
      if (response?.success) setSidekickActive(false);
    });
  };

  const saveKey = async (provider, value) => {
    if (!value.trim()) return;
    chrome.runtime.sendMessage({ action: "TEST_API_KEY", provider, apiKey: value.trim() }, async (res) => {
      if (!res?.success) return;
      const stored = await chrome.storage.local.get("apiKeys");
      const next = { ...(stored.apiKeys || {}), [provider]: value.trim() };
      await chrome.storage.local.set({ apiKeys: next });
      setApiKeys((prev) => ({ ...prev, [provider]: value.trim() }));
      setTestedKeys((prev) => ({ ...prev, [provider]: true }));
    });
  };

  const deleteKey = async (provider) => {
    const stored = await chrome.storage.local.get("apiKeys");
    const next = { ...(stored.apiKeys || {}) };
    delete next[provider];
    await chrome.storage.local.set({ apiKeys: next });
    setApiKeys((prev) => ({ ...prev, [provider]: "" }));
    setTestedKeys((prev) => ({ ...prev, [provider]: false }));
  };

  const saveVoiceSetting = async (key, value) => {
    const next = { ...voiceSettings, [key]: value };
    if (key === "voiceMode") {
      next.voiceEnabled = value !== "text";
    }
    setVoiceSettings(next);
    await chrome.storage.local.set({
      voiceSettings: next,
      voiceEnabled: next.voiceEnabled,
      voiceMode: next.voiceMode,
      wakeWord: next.wakeWord,
      autoSpeak: next.autoSpeak,
      speechRate: next.speechRate
    });
    chrome.runtime.sendMessage({
      action: "SAVE_VOICE_PREFERENCES",
      preferences: {
        voiceEnabled: next.voiceEnabled,
        voiceMode: next.voiceMode,
        wakeWord: next.wakeWord,
        autoSpeak: next.autoSpeak,
        speechRate: next.speechRate
      }
    });
    chrome.runtime.sendMessage({
      action: "UPDATE_VOICE_SETTINGS",
      preferences: {
        prefersVoiceReplies: next.autoSpeak && !next.muted,
        memoryLearning: next.memoryLearning
      }
    });
  };

  const updateProviderPref = async (slot, newProvider) => {
    const current = [...providerPriority];
    const existingSlot = current.indexOf(newProvider);
    if (existingSlot !== -1 && existingSlot !== slot) {
      current[existingSlot] = current[slot];
    }
    current[slot] = newProvider;
    setProviderPriority(current);
    await chrome.storage.local.set({ providerPriority: current });
  };

  const saveProviderMode = async (mode = aiMode) => {
    setAiMode(mode);
    await chrome.storage.local.set({ aiMode: mode, ollamaBaseUrl, ollamaModel, providerPriority });
    if (mode === "ollama") {
      testOllamaConnection();
    }
  };

  const testOllamaConnection = async () => {
    setTestingOllama(true);
    await chrome.storage.local.set({ ollamaBaseUrl, ollamaModel });
    chrome.runtime.sendMessage({ action: "CHECK_OLLAMA" }, (resp) => {
      setTestingOllama(false);
      setOllamaStatus(resp?.connected ? { connected: true, models: resp.models || [] } : { connected: false, error: resp?.error || "Offline" });
    });
  };

  if (booting) {
    return (
      <div className="flex h-[520px] w-[360px] items-center justify-center bg-black text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-white/70" />
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Launching Sidekick</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[520px] w-[360px] flex-col overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_58%)] pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-4 pb-3 pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/42">Sidekick</div>
          <div className="mt-1 text-lg font-semibold">Floating notch mode</div>
        </div>
        <button onClick={() => setShowSettings(true)} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white">
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-[10px] uppercase tracking-[0.22em] ${statusTone}`}>
                {sidekickActive ? "Active on pages" : "Not active"}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/72">
                Launch once, then use Sidekick directly inside webpages. Tasks keep running in the background.
              </p>
            </div>
            <div className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.18em] ${sidekickActive ? "bg-emerald-400/12 text-emerald-300" : "bg-white/6 text-white/40"}`}>
              {sidekickActive ? "Live" : "Off"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={launchSidekick}
              disabled={launching || !aiReady}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-[11px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-35"
            >
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Launch Sidekick
            </button>
            <button
              onClick={hideSidekick}
              disabled={hiding || !sidekickActive}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] text-white transition hover:bg-white/[0.08] disabled:opacity-35"
            >
              {hiding ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
              Hide Sidekick
            </button>
          </div>

          {!aiReady && (
            <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/8 px-3 py-2 text-[10px] leading-relaxed text-amber-100/90">
              Configure an AI provider in settings before launching the notch.
            </div>
          )}
        </div>

        <SidekickNotch
          active={sidekickActive}
          state={previewState}
          command={agentState.command}
          response={voiceState.lastResponse || agentState.result?.text}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              <Mic className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Voice</span>
            </div>
            <div className="text-sm font-medium capitalize">{voiceState.mode || "idle"}</div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/42">
              {voiceState.transcript || voiceState.error || "Live mic and speech happen inside the notch."}
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              <Eye className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-[0.2em]">Task engine</span>
            </div>
            <div className="text-sm font-medium">{agentState.isRunning ? "Running" : "Ready"}</div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/42">
              {agentState.currentAction || "Background worker is ready."}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/50">Recent activity</div>
            <button onClick={() => setShowSettings(true)} className="text-[10px] text-white/50 transition hover:text-white">Settings</button>
          </div>
          <div className="space-y-2">
            {(agentState.logs || []).slice(0, 4).map((log, index) => (
              <div key={`${log.time}-${index}`} className="rounded-2xl border border-white/6 bg-black/40 px-3 py-2">
                <div className="text-[11px] text-white/76">{log.message}</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/28">{log.time}</div>
              </div>
            ))}
            {(!agentState.logs || agentState.logs.length === 0) && (
              <div className="rounded-2xl border border-white/6 bg-black/30 px-3 py-3 text-[10px] text-white/40">
                No recent tasks yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full rounded-[28px] border border-white/10 bg-[#0a0a0a] p-4 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Settings</div>
                <div className="mt-1 text-sm font-semibold">Popup control + engine setup</div>
              </div>
              <button onClick={() => setShowSettings(false)} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45">AI mode</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => saveProviderMode("api")} className={`rounded-2xl px-3 py-2 text-[11px] transition ${aiMode === "api" ? "bg-white text-black" : "bg-white/[0.04] text-white/72"}`}>Cloud API</button>
                  <button onClick={() => saveProviderMode("ollama")} className={`rounded-2xl px-3 py-2 text-[11px] transition ${aiMode === "ollama" ? "bg-white text-black" : "bg-white/[0.04] text-white/72"}`}>Local AI</button>
                </div>
              </div>

              {aiMode === "ollama" && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/45">
                    <Cpu className="h-3.5 w-3.5" />
                    Ollama
                  </div>
                  <input value={ollamaBaseUrl} onChange={(e) => setOllamaBaseUrl(e.target.value)} className="w-full rounded-xl border border-white/8 bg-black/50 px-3 py-2 text-[11px] text-white outline-none" />
                  <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className="w-full rounded-xl border border-white/8 bg-black/50 px-3 py-2 text-[11px] text-white outline-none" />
                  <button onClick={testOllamaConnection} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-black">
                    {testingOllama ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                    Test connection
                  </button>
                  {ollamaStatus && <div className="text-[10px] text-white/55">{ollamaStatus.connected ? "Connected" : ollamaStatus.error}</div>}
                </div>
              )}

              {aiMode === "api" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45">Provider order</div>
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4].map((slot) => (
                        <select
                          key={slot}
                          value={providerPriority[slot] || ""}
                          onChange={(e) => updateProviderPref(slot, e.target.value)}
                          className="w-full rounded-xl border border-white/8 bg-black/50 px-3 py-2 text-[11px] text-white outline-none"
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

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45">Voice mode</div>
                <select
                  value={voiceSettings.voiceMode}
                  onChange={(e) => saveVoiceSetting("voiceMode", e.target.value)}
                  className="w-full rounded-xl border border-white/8 bg-black/50 px-3 py-2 text-[11px] text-white outline-none"
                >
                  <option value="text">Text mode</option>
                  <option value="manual">Manual mic</option>
                  <option value="wake_word">Wake word</option>
                </select>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45">Wake word</div>
                <input
                  value={voiceSettings.wakeWord}
                  onChange={(e) => saveVoiceSetting("wakeWord", e.target.value || "sidekick")}
                  className="w-full rounded-xl border border-white/8 bg-black/50 px-3 py-2 text-[11px] text-white outline-none"
                />
              </div>

              <ToggleRow label="Voice enabled" hint="Allow the notch microphone UI." value={voiceSettings.voiceEnabled} onChange={(value) => saveVoiceSetting("voiceEnabled", value)} />
              <ToggleRow label="Auto speak replies" hint="Let the notch read back short responses." value={voiceSettings.autoSpeak} onChange={(value) => saveVoiceSetting("autoSpeak", value)} />
              <ToggleRow label="Memory learning" hint="Store lightweight learned preferences locally." value={voiceSettings.memoryLearning} onChange={(value) => saveVoiceSetting("memoryLearning", value)} />

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/45">
                  <Volume2 className="h-3.5 w-3.5" />
                  Speech rate
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={voiceSettings.speechRate}
                  onChange={(e) => saveVoiceSetting("speechRate", Number(e.target.value))}
                  className="w-full accent-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance("Sidekick speaker check."))}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] text-white/75 transition hover:bg-white/[0.08]"
                >
                  Test speaker
                </button>
                <button
                  onClick={launchSidekick}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] text-white/75 transition hover:bg-white/[0.08]"
                >
                  Test microphone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
