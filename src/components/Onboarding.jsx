import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  HelpCircle, 
  Sparkles, 
  Key, 
  Layers, 
  Trash2,
  Lock
} from "lucide-react";

// PreloaderSplash Component for loading states
function Preloader({ message = "Verifying connection..." }) {
  return (
    <div className="w-[360px] h-[520px] bg-black text-white flex flex-col items-center justify-center animate-fade-in p-6">
      <div className="relative mb-6">
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
        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
        {message}
      </p>
    </div>
  );
}

export default function Onboarding({ onComplete, onSkip }) {
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing Setup...");

  // Support 5 slots of priority for fallbacks
  const [providerPriority, setProviderPriority] = useState(["gemini", "openai", "claude", "openrouter", "groq"]);
  const [apiKeys, setApiKeys] = useState({
    gemini: "",
    openai: "",
    claude: "",
    openrouter: "",
    groq: "",
    deepseek: "",
    mistral: "",
    perplexity: "",
    cohere: ""
  });
  const [testedKeys, setTestedKeys] = useState({
    gemini: false,
    openai: false,
    claude: false,
    openrouter: false,
    groq: false,
    deepseek: false,
    mistral: false,
    perplexity: false,
    cohere: false
  });
  const [testErrors, setTestErrors] = useState({});
  const [showHelpDrawer, setShowHelpDrawer] = useState(false);

  // Load saved credentials on startup
  useEffect(() => {
    async function loadState() {
      setLoading(true);
      setLoadingMessage("Loading credentials...");
      try {
        const stored = await chrome.storage.local.get(["providerPriority", "apiKeys", "onboarding"]);
        
        if (stored.providerPriority) setProviderPriority(stored.providerPriority);
        if (stored.apiKeys) {
          setApiKeys(prev => ({ ...prev, ...stored.apiKeys }));
          const verified = {};
          Object.keys(stored.apiKeys).forEach(k => {
            if (stored.apiKeys[k]) verified[k] = true;
          });
          setTestedKeys(prev => ({ ...prev, ...verified }));
        }

        const onboarding = stored.onboarding || {};
        if (onboarding.completed) {
          onComplete();
          return;
        }
      } catch (err) {
        console.error("Failed to load onboarding", err);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, []);

  const handlePriorityChange = (slotIdx, value) => {
    const updated = [...providerPriority];
    const prevVal = updated[slotIdx];
    const dupIdx = updated.indexOf(value);
    
    if (dupIdx !== -1) {
      updated[dupIdx] = prevVal; // swap slots
    }
    updated[slotIdx] = value;
    setProviderPriority(updated);
  };

  const handleTestAndSaveKey = async (provider) => {
    const key = apiKeys[provider]?.trim();
    if (!key) return;

    setLoading(true);
    setLoadingMessage(`Verifying ${capitalize(provider)} key...`);
    setTestErrors(prev => ({ ...prev, [provider]: null }));

    try {
      chrome.runtime.sendMessage({ action: "TEST_API_KEY", provider, apiKey: key }, async (response) => {
        setLoading(false);
        if (response && response.success) {
          setTestedKeys(prev => ({ ...prev, [provider]: true }));
          const stored = await chrome.storage.local.get("apiKeys");
          const updatedKeys = { ...(stored.apiKeys || {}), [provider]: key };
          await chrome.storage.local.set({ apiKeys: updatedKeys });
          setApiKeys(prev => ({ ...prev, [provider]: key }));
        } else {
          setTestedKeys(prev => ({ ...prev, [provider]: false }));
          setTestErrors(prev => ({ ...prev, [provider]: "Testing failed. Check key spelling." }));
        }
      });
    } catch (err) {
      setLoading(false);
      setTestErrors(prev => ({ ...prev, [provider]: "Connection error during validation." }));
    }
  };

  const handleDeleteKey = async (provider) => {
    const stored = await chrome.storage.local.get("apiKeys");
    const updatedKeys = { ...(stored.apiKeys || {}) };
    delete updatedKeys[provider];
    await chrome.storage.local.set({ apiKeys: updatedKeys });

    setApiKeys(prev => ({ ...prev, [provider]: "" }));
    setTestedKeys(prev => ({ ...prev, [provider]: false }));
  };

  const handleCompleteSetup = async () => {
    const verifiedProviders = providerPriority.filter(provider => apiKeys[provider] && testedKeys[provider]);
    if (verifiedProviders.length === 0) {
      alert("Please verify at least one API key to complete setup.");
      return;
    }

    setLoading(true);
    setLoadingMessage("Completing setup...");
    try {
      await chrome.storage.local.set({
        aiMode: "api",
        providerPriority,
        onboarding: {
          started: true,
          completed: true,
          currentStep: "complete",
          selectedMode: "api",
          updatedAt: Date.now()
        }
      });
      setLoading(false);
      onComplete();
    } catch (e) {
      setLoading(false);
    }
  };

  const maskKey = (key) => {
    if (!key || key.length < 8) return "••••••••••••";
    return `${key.substring(0, 4)}••••••${key.slice(-4)}`;
  };

  const capitalize = (str) => {
    if (!str) return "";
    if (str === "openai") return "OpenAI";
    if (str === "openrouter") return "OpenRouter";
    if (str === "deepseek") return "DeepSeek";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (loading) {
    return <Preloader message={loadingMessage} />;
  }

  const primary = providerPriority[0];
  const uniqueSelected = Array.from(new Set(providerPriority));
  const verifiedProviders = uniqueSelected.filter(provider => apiKeys[provider] && testedKeys[provider]);
  const hasAnyConfigured = verifiedProviders.length > 0;
  const connectedProvider = verifiedProviders[0];

  return (
    <div className="w-[360px] h-[520px] bg-black text-white flex flex-col p-4 animate-fade-in relative">
      <header className="flex flex-col pb-2.5 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-emerald-500/10 rounded text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xs font-black uppercase tracking-wider text-gray-200">Sidekick Setup</h1>
          </div>
          <button 
            onClick={() => setShowHelpDrawer(true)}
            className="p-1 text-gray-500 hover:text-white transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-gray-400 mt-1 font-mono leading-relaxed">
          Configure API credentials to activate secure sandboxed browser loops. Keys stay stored locally.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-0.5">
        {/* Priority Slots (Choices 1 to 5) */}
        <div className="p-3 bg-neutral-900 border border-white/[0.05] rounded-xl space-y-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest font-bold block">Provider Order</span>
          </div>
          <p className="text-[8px] text-gray-500 leading-relaxed font-mono">
            Add one key to start. Extra keys are optional backups.
          </p>
          
          <div className="space-y-1.5 pt-1">
            {[0, 1, 2, 3, 4].map((slot) => (
              <div key={slot} className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-gray-500 w-12 shrink-0">Choice {slot + 1}:</span>
                <select
                  value={providerPriority[slot] || ""}
                  onChange={(e) => handlePriorityChange(slot, e.target.value)}
                  className="flex-1 bg-black border border-white/[0.1] rounded-lg px-2 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="groq">Groq</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="mistral">Mistral</option>
                  <option value="perplexity">Perplexity</option>
                  <option value="cohere">Cohere</option>
                </select>
                <span className={`text-[8px] font-mono px-1 rounded ${
                  testedKeys[providerPriority[slot]] ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {testedKeys[providerPriority[slot]] ? "● active" : "○ unset"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Key Input Cards for Selected Priority slots */}
        <div className="space-y-2.5">
          {uniqueSelected.map((prov) => (
            <div key={prov} className="p-3 bg-neutral-900 border border-white/[0.05] rounded-xl space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] font-bold font-mono text-gray-200 uppercase tracking-wide">
                    {capitalize(prov)} API Key
                    {prov !== primary && <span className="text-gray-500 normal-case tracking-normal"> optional</span>}
                  </span>
                </div>
                {testedKeys[prov] && (
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.25 rounded font-mono font-bold">Verified</span>
                )}
              </div>

              {testedKeys[prov] ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black border border-white/[0.05] rounded-lg px-2.5 py-1 text-[10px] font-mono text-gray-500 tracking-widest">
                    {maskKey(apiKeys[prov])}
                  </div>
                  <button
                    onClick={() => handleDeleteKey(prov)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                    title="Delete Key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKeys[prov] || ""}
                    onChange={(e) => setApiKeys({ ...apiKeys, [prov]: e.target.value })}
                    placeholder={`Enter ${capitalize(prov)} key`}
                    className="flex-1 bg-black border border-white/[0.1] rounded-lg px-2.5 py-1 text-[10px] font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 min-w-0"
                  />
                  <button
                    onClick={() => handleTestAndSaveKey(prov)}
                    disabled={!apiKeys[prov]?.trim()}
                    className="px-2.5 py-1 text-[9px] font-mono bg-white text-black hover:bg-gray-200 active:scale-95 disabled:opacity-30 rounded-lg transition-all shrink-0 font-bold"
                  >
                    Verify
                  </button>
                </div>
              )}

              {testErrors[prov] && (
                <span className="text-[8px] text-red-400 block font-mono leading-tight">{testErrors[prov]}</span>
              )}
            </div>
          ))}
        </div>

        {/* Connection status and optional backup suggestion */}
        {hasAnyConfigured && (
          <div className="p-3 bg-emerald-950/10 border border-emerald-500/20 rounded-xl space-y-1">
            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest font-bold block">Ready</span>
            <div className="space-y-0.5 text-[9px] font-mono">
              <p className="text-emerald-400">{capitalize(connectedProvider)} connected. You can start with this key.</p>
              {providerPriority.filter(prov => prov !== connectedProvider).map((prov, i) => (
                testedKeys[prov] && (
                  <p key={i} className="text-gray-400">{capitalize(prov)} backup ready</p>
                )
              ))}
              {verifiedProviders.length === 1 && (
                <p className="text-gray-500 leading-relaxed">
                  Adding another key later can help Sidekick switch providers if this one hits a limit.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.08] pt-3 flex gap-2 shrink-0">
        <button
          onClick={onSkip}
          className="flex-1 py-2 text-[10px] font-mono text-gray-500 hover:text-white border border-white/5 rounded-xl transition-all"
        >
          Skip Setup
        </button>
        
        <button
          onClick={handleCompleteSetup}
          disabled={!hasAnyConfigured}
          className="flex-1 py-2 text-[10px] font-mono bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-30 rounded-xl transition-all flex items-center justify-center gap-1.5"
        >
          Activate Sidekick <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dynamic Help drawer */}
      {showHelpDrawer && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-neutral-950 border-t border-white/10 rounded-t-2xl p-4 space-y-3.5 max-h-[360px] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Sandboxed Keys
              </h4>
              <button onClick={() => setShowHelpDrawer(false)} className="text-xs text-gray-500 hover:text-white">Close</button>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed font-mono">
              Sidekick stores API keys strictly inside chrome.storage.local on your computer. 
              <br/><br/>
              They are never transmitted to outside servers, trackers, or telemetry networks. Sidekick uses them exclusively to send browser action commands to the LLMs.
              <br/><br/>
              <strong>Backup Fallbacks:</strong> If choice 1 (e.g. Gemini) runs out of rate limits or fails due to network spikes, Sidekick will seamlessly slide down your priority list, using Choice 2 or 3 as backup.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
