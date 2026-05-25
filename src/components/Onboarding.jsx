import React, { useState, useEffect, useRef } from "react";
import { 
  Cpu, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  Play,
  SkipForward,
  ExternalLink,
  AlertTriangle,
  Monitor,
  Terminal,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { 
  checkOllamaConnection, 
  checkModelInstalled,
  getInstallCommand,
  copyInstallCommand,
  getDownloadUrl,
  saveSetupState,
  loadSetupState,
  DEFAULT_MODEL
} from "../utils/ollama";

// Video tutorial URL (editable - replace with your own tutorial link)
const SETUP_VIDEO_URL = ""; // Set to your video URL, e.g., "https://youtube.com/watch?v=..."

// Platform detection
function getPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

// Get download link for current platform
function getPlatformDownloadUrl() {
  const platform = getPlatform();
  switch (platform) {
    case "windows": return "https://ollama.com/download/windows";
    case "macos": return "https://ollama.com/download/mac";
    default: return "https://ollama.com/download";
  }
}

// Get platform-specific instructions
function getPlatformInstructions(step) {
  const platform = getPlatform();
  
  const instructions = {
    windows: {
      openOllama: [
        "Click the Windows Start button (or press Windows key)",
        "Type \"Ollama\" in the search bar",
        "Click on the Ollama app to open it",
        "You should see an Ollama icon appear in your system tray (near the clock)"
      ],
      openTerminal: "Open PowerShell or Command Prompt",
      terminalName: "PowerShell",
      runCommand: "Paste the command and press Enter"
    },
    macos: {
      openOllama: [
        "Open Finder",
        "Go to Applications folder",
        "Find and double-click Ollama",
        "You should see the Ollama icon appear in your menu bar (top of screen)"
      ],
      openTerminal: "Open Terminal (Cmd+Space, type \"Terminal\", press Enter)",
      terminalName: "Terminal",
      runCommand: "Paste the command and press Return"
    },
    linux: {
      openOllama: [
        "Open a Terminal window",
        "Run: ollama serve",
        "Keep this terminal open"
      ],
      openTerminal: "Open a new Terminal window",
      terminalName: "Terminal",
      runCommand: "Paste the command and press Enter"
    }
  };
  
  return instructions[platform] || instructions.windows;
}

// Setup step constants
const STEPS = {
  WELCOME: "welcome",
  DOWNLOAD_OLLAMA: "download_ollama",
  OPEN_OLLAMA: "open_ollama",
  CHECK_OLLAMA: "check_ollama",
  INSTALL_MODEL: "install_model",
  CHECK_MODEL: "check_model",
  CONNECTED: "connected",
  FAILED: "failed",
  TROUBLESHOOT: "troubleshoot"
};

// Status states
const STATUS = {
  IDLE: "idle",
  CHECKING: "checking",
  CONNECTED: "connected",
  FAILED: "failed",
  INSTALLING: "installing"
};

export default function Onboarding({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [ollamaStatus, setOllamaStatus] = useState(STATUS.IDLE);
  const [modelStatus, setModelStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [troubleshootOption, setTroubleshootOption] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [ollamaOpened, setOllamaOpened] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  
  const platform = getPlatform();
  const instructions = getPlatformInstructions();
  const installCommand = getInstallCommand(DEFAULT_MODEL);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  // Load saved state
  useEffect(() => {
    async function loadState() {
      const state = await loadSetupState();
      if (state.ollamaSetupCompleted) {
        // Already completed, skip onboarding
        onComplete?.();
      }
    }
    loadState();
  }, [onComplete]);

  // Check Ollama connection
  const checkOllama = async (showMessages = true) => {
    if (showMessages) {
      setOllamaStatus(STATUS.CHECKING);
      setStatusMessage("Checking if Ollama is running...");
    }
    
    try {
      const result = await checkOllamaConnection();
      
      if (result.connected) {
        setOllamaStatus(STATUS.CONNECTED);
        if (showMessages) setStatusMessage("Ollama is running!");
        
        // Now check if model is installed
        checkModel();
      } else {
        setOllamaStatus(STATUS.FAILED);
        if (showMessages) setStatusMessage("Ollama is not running. Please open it and try again.");
      }
    } catch (err) {
      setOllamaStatus(STATUS.FAILED);
      if (showMessages) setStatusMessage("Could not connect to Ollama.");
    }
  };

  // Check model installation
  const checkModel = async (showMessages = true) => {
    if (showMessages) {
      setModelStatus(STATUS.CHECKING);
      setStatusMessage(`Checking if ${DEFAULT_MODEL} is installed...`);
    }
    
    try {
      const result = await checkModelInstalled(DEFAULT_MODEL);
      
      if (result.installed) {
        setModelStatus(STATUS.CONNECTED);
        if (showMessages) setStatusMessage(`Model ${DEFAULT_MODEL} is ready!`);
        
        // All done!
        setTimeout(() => {
          setCurrentStep(STEPS.CONNECTED);
          saveSetupState({ 
            ollamaSetupCompleted: true, 
            selectedModel: DEFAULT_MODEL,
            useLocalAI: true 
          });
        }, 1000);
      } else {
        setModelStatus(STATUS.FAILED);
        if (showMessages) {
          setStatusMessage(`Model ${DEFAULT_MODEL} is not installed.`);
          setCurrentStep(STEPS.INSTALL_MODEL);
        }
      }
    } catch (err) {
      setModelStatus(STATUS.FAILED);
      if (showMessages) setStatusMessage("Could not check model status.");
    }
  };

  // Start polling for Ollama
  const startPolling = () => {
    // Clear any existing interval
    if (pollingInterval) clearInterval(pollingInterval);
    
    const interval = setInterval(async () => {
      const result = await checkOllamaConnection();
      if (result.connected) {
        clearInterval(interval);
        setPollingInterval(null);
        checkOllama(true);
      }
    }, 3000);
    
    setPollingInterval(interval);
    
    // Stop after 60 seconds
    setTimeout(() => {
      if (pollingInterval) {
        clearInterval(interval);
        setPollingInterval(null);
      }
    }, 60000);
  };

  // Handle copy command
  const handleCopyCommand = async () => {
    const success = await copyInstallCommand(installCommand);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle retry
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    if (currentStep === STEPS.CHECK_OLLAMA) {
      checkOllama(true);
    } else if (currentStep === STEPS.CHECK_MODEL || currentStep === STEPS.INSTALL_MODEL) {
      checkModel(true);
    }
  };

  // Handle skip
  const handleSkip = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    saveSetupState({ ollamaSetupCompleted: false, useLocalAI: false });
    onSkip?.();
  };

  // Handle complete
  const handleComplete = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    onComplete?.();
  };

  // Handle troubleshoot option
  const handleTroubleshootOption = (option) => {
    setTroubleshootOption(option);
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: STEPS.DOWNLOAD_OLLAMA, label: "Download", icon: Download },
      { id: STEPS.OPEN_OLLAMA, label: "Install", icon: Cpu },
      { id: STEPS.INSTALL_MODEL, label: "Setup", icon: Terminal },
      { id: STEPS.CONNECTED, label: "Ready", icon: CheckCircle2 }
    ];
    
    const currentIdx = steps.findIndex(s => s.id === currentStep);
    
    return (
      <div className="flex items-center justify-between px-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                ${isActive ? 'bg-white text-black scale-110' : ''}
                ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                ${!isActive && !isCompleted ? 'bg-neutral-800 text-gray-500' : ''}
              `}>
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${isCompleted ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Welcome Step
  if (currentStep === STEPS.WELCOME) {
    return (
      <div className="w-[360px] h-[520px] bg-black text-white flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Cpu className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-black uppercase tracking-wider">Local AI Setup</h1>
            <p className="text-sm text-gray-400">
              Run AI locally on your computer with Ollama. 
              Your data stays private — nothing is sent to the cloud.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={() => setCurrentStep(STEPS.DOWNLOAD_OLLAMA)}
              className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleSkip}
              className="w-full py-3 px-4 bg-transparent border border-white/10 text-gray-400 font-medium rounded-xl hover:bg-white/5 active:scale-95 transition-all"
            >
              Skip — Use Cloud AI Instead
            </button>
          </div>

          {SETUP_VIDEO_URL && (
            <button
              onClick={() => setShowVideo(true)}
              className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mx-auto"
            >
              <Play className="w-3 h-3" />
              Watch Setup Guide
            </button>
          )}
        </div>

        {/* Video Modal */}
        {showVideo && SETUP_VIDEO_URL && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowVideo(false)}
                className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-lg hover:bg-black/70 z-10"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <iframe
                src={SETUP_VIDEO_URL}
                className="w-full h-full"
                title="Setup Guide"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Download Ollama Step
  if (currentStep === STEPS.DOWNLOAD_OLLAMA) {
    return (
      <div className="w-[360px] h-[520px] bg-black text-white flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] space-y-4">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Download Ollama</h2>
            <p className="text-sm text-gray-400">
              Ollama is a free app that runs AI models on your computer.
            </p>
          </div>

          {/* Platform-specific download */}
          <div className="p-4 bg-neutral-900 border border-white/[0.08] rounded-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Your System</p>
                <p className="text-sm font-medium capitalize">{platform === "unknown" ? "Your Computer" : platform}</p>
              </div>
            </div>

            <a
              href={getPlatformDownloadUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
            >
              <Download className="w-4 h-4" />
              Download Ollama
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* What to expect */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider">What happens next?</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">1.</span>
                <span>Click the download button above</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">2.</span>
                <span>Run the installer (OllamaSetup.exe on Windows, .dmg on Mac)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">3.</span>
                <span>Come back here and click "I've Installed Ollama"</span>
              </div>
            </div>
          </div>

          {/* Visual help */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <p className="text-xs text-gray-500 text-center">
              💡 Ollama is free and open source. The download comes from ollama.com
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] space-y-3">
          <button
            onClick={() => {
              setOllamaOpened(true);
              setCurrentStep(STEPS.OPEN_OLLAMA);
              startPolling();
            }}
            className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            I've Installed Ollama
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setCurrentStep(STEPS.WELCOME)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </button>
        </div>
      </div>
    );
  }

  // Open Ollama Step
  if (currentStep === STEPS.OPEN_OLLAMA) {
    return (
      <div className="w-[360px] h-[520px] bg-black text-white flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] space-y-4">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Open Ollama</h2>
            <p className="text-sm text-gray-400">
              After installing, you need to open the Ollama app so it can run in the background.
            </p>
          </div>

          {/* Status indicator */}
          <div className={`p-4 rounded-xl border ${
            ollamaStatus === STATUS.CONNECTED 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : ollamaStatus === STATUS.CHECKING
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-neutral-900 border-white/[0.08]'
          }`}>
            <div className="flex items-center gap-3">
              {ollamaStatus === STATUS.CONNECTED ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-400">Ollama is running!</span>
                </>
              ) : ollamaStatus === STATUS.CHECKING ? (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                  <span className="text-sm font-medium text-yellow-400">Checking...</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-500" />
                  <span className="text-sm font-medium text-gray-400">Waiting for Ollama...</span>
                </>
              )}
            </div>
            {statusMessage && ollamaStatus !== STATUS.CONNECTED && (
              <p className="text-xs text-gray-500 mt-2">{statusMessage}</p>
            )}
          </div>

          {/* Platform-specific instructions */}
          <div className="p-4 bg-neutral-900 border border-white/[0.08] rounded-xl space-y-4">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
              How to open Ollama on {platform === "unknown" ? "your computer" : platform}
            </h3>
            
            <div className="space-y-3">
              {instructions.openOllama.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-gray-300">{step}</p>
                </div>
              ))}
            </div>

            {/* What you should see */}
            <div className="mt-4 p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
              <p className="text-xs text-gray-400">
                <span className="font-bold text-white">You should see:</span> An Ollama icon appear in your 
                {platform === "windows" ? " system tray (near the clock)" : platform === "macos" ? " menu bar (top of screen)" : " taskbar"}.
              </p>
            </div>
          </div>

          {/* What if I don't see it */}
          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm text-yellow-400">
                <HelpCircle className="w-4 h-4" />
                I don't see the Ollama icon
                <ChevronDown className="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 space-y-2 text-xs text-gray-400">
                <p>• Try searching for "Ollama" in your Start Menu / Applications</p>
                <p>• Make sure you completed the installation (don't just download the file)</p>
                <p>• Try restarting your computer and opening Ollama again</p>
              </div>
            </details>
          </div>

          {/* Retry button */}
          {ollamaStatus === STATUS.FAILED && (
            <button
              onClick={handleRetry}
              className="w-full py-3 px-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-medium rounded-xl hover:bg-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry — Check Again
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] space-y-3">
          <button
            onClick={() => checkOllama(true)}
            disabled={ollamaStatus === STATUS.CHECKING}
            className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {ollamaStatus === STATUS.CHECKING ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                Check Connection
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowTroubleshoot(true)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            Having trouble?
          </button>
          
          <button
            onClick={() => setCurrentStep(STEPS.DOWNLOAD_OLLAMA)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </button>
        </div>

        {/* Troubleshoot Modal */}
        {showTroubleshoot && (
          <TroubleshootModal
            platform={platform}
            selectedOption={troubleshootOption}
            onSelectOption={handleTroubleshootOption}
            onRetry={handleRetry}
            onClose={() => {
              setShowTroubleshoot(false);
              setTroubleshootOption(null);
            }}
          />
        )}
      </div>
    );
  }

  // Install Model Step
  if (currentStep === STEPS.INSTALL_MODEL) {
    return (
      <div className="w-[360px] h-[520px] bg-black text-white flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] space-y-4">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Install AI Model</h2>
            <p className="text-sm text-gray-400">
              Ollama needs a language model to work. We'll install {DEFAULT_MODEL} — a fast, lightweight model.
            </p>
          </div>

          {/* Model status */}
          <div className={`p-4 rounded-xl border ${
            modelStatus === STATUS.CONNECTED 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : modelStatus === STATUS.CHECKING
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-neutral-900 border-white/[0.08]'
          }`}>
            <div className="flex items-center gap-3">
              {modelStatus === STATUS.CONNECTED ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-400">Model is ready!</span>
                </>
              ) : modelStatus === STATUS.CHECKING ? (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                  <span className="text-sm font-medium text-yellow-400">Checking model...</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-500" />
                  <span className="text-sm font-medium text-gray-400">Model not installed</span>
                </>
              )}
            </div>
            {statusMessage && modelStatus !== STATUS.CONNECTED && (
              <p className="text-xs text-gray-500 mt-2">{statusMessage}</p>
            )}
          </div>

          {/* Copy command */}
          <div className="p-4 bg-neutral-900 border border-white/[0.08] rounded-xl space-y-4">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider">Install the model</h3>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Open {instructions.terminalName} and paste this command:
              </p>
              
              <div className="relative">
                <code className="block w-full p-3 bg-black border border-white/[0.1] rounded-lg text-xs font-mono text-emerald-400 break-all pr-24">
                  {installCommand}
                </code>
                <button
                  onClick={handleCopyCommand}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded text-[10px] font-bold transition-all ${
                    copied 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-500">
                <Terminal className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <p>
                  {instructions.runCommand}. The model is about 2GB — it may take a few minutes to download.
                </p>
              </div>
            </div>
          </div>

          {/* What to expect during download */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl space-y-2">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">What to expect:</p>
            <div className="space-y-1.5 text-xs text-gray-400">
              <p>• You'll see a progress bar in the terminal</p>
              <p>• Wait until it says "success" or shows a prompt again</p>
              <p>• Don't close the terminal window until it's done</p>
            </div>
          </div>

          {/* Troubleshooting tips */}
          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm text-yellow-400">
                <HelpCircle className="w-4 h-4" />
                Having issues?
                <ChevronDown className="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 space-y-2 text-xs text-gray-400">
                <p>• Make sure Ollama is still running (check system tray/menu bar)</p>
                <p>• If the command fails, try closing and reopening your terminal</p>
                <p>• If download is slow, check your internet connection</p>
                <p>• If you get a "not found" error, make sure you typed the command correctly</p>
              </div>
            </details>
          </div>

          {/* Retry button */}
          {modelStatus === STATUS.FAILED && (
            <button
              onClick={handleRetry}
              disabled={modelStatus === STATUS.CHECKING}
              className="w-full py-3 px-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-medium rounded-xl hover:bg-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {modelStatus === STATUS.CHECKING ? "Checking..." : "Retry — Check Again"}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] space-y-3">
          <button
            onClick={() => checkModel(true)}
            disabled={modelStatus === STATUS.CHECKING || modelStatus === STATUS.CONNECTED}
            className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {modelStatus === STATUS.CHECKING ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : modelStatus === STATUS.CONNECTED ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Model Ready!
              </>
            ) : (
              <>
                Check Model
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowTroubleshoot(true)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            Need help?
          </button>
          
          <button
            onClick={() => setCurrentStep(STEPS.OPEN_OLLAMA)}
            className="flex items-center justify-center gap-1 w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </button>
        </div>

        {/* Troubleshoot Modal */}
        {showTroubleshoot && (
          <TroubleshootModal
            platform={platform}
            step="install_model"
            selectedOption={troubleshootOption}
            onSelectOption={handleTroubleshootOption}
            onRetry={handleRetry}
            onClose={() => {
              setShowTroubleshoot(false);
              setTroubleshootOption(null);
            }}
          />
        )}
      </div>
    );
  }

  // Connected / Success Step
  if (currentStep === STEPS.CONNECTED) {
    return (
      <div className="w-[360px] h-[520px] bg-black text-white flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-scale-in">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-black uppercase tracking-wider">Setup Complete!</h1>
            <p className="text-sm text-gray-400">
              Local AI is ready. Your data stays private — all processing happens on your computer.
            </p>
          </div>

          <div className="p-4 bg-neutral-900 border border-white/[0.08] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <span className="text-gray-300">Model: <span className="font-mono text-white">{DEFAULT_MODEL}</span></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-gray-300">Status: <span className="text-emerald-400">Connected</span></span>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={handleComplete}
              className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Start Using Sidekick
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] text-gray-600">
            You can always change AI settings later in the extension preferences.
          </p>
        </div>
      </div>
    );
  }

  // Failed Step (final fallback)
  if (currentStep === STEPS.FAILED) {
    return (
      <div className="w-[360px] h-[520px] bg-black text-white flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-black uppercase tracking-wider">Setup Incomplete</h1>
            <p className="text-sm text-gray-400">
              We couldn't complete the local AI setup. You can still use Sidekick with cloud-based AI.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={handleComplete}
              className="w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
              Continue with Basic Mode
            </button>
            
            <button
              onClick={() => {
                setRetryCount(0);
                setCurrentStep(STEPS.DOWNLOAD_OLLAMA);
              }}
              className="w-full py-3 px-4 bg-transparent border border-white/10 text-gray-400 font-medium rounded-xl hover:bg-white/5 active:scale-95 transition-all"
            >
              Try Setup Again
            </button>
            
            <button
              onClick={handleSkip}
              className="w-full py-2 text-xs text-gray-500 hover:text-white transition-colors"
            >
              Skip — Use Cloud AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Troubleshoot Modal Component
function TroubleshootModal({ platform, step, selectedOption, onSelectOption, onRetry, onClose }) {
  const options = [
    { id: "downloaded_nothing", label: "I downloaded Ollama but nothing happened" },
    { id: "cant_find_terminal", label: "I don't know where to paste the command" },
    { id: "taking_too_long", label: "The model is taking too long" },
    { id: "connection_failed", label: "It says connection failed" },
    { id: "model_not_found", label: "It says model not found" },
  ];

  const platformHelp = {
    windows: {
      title: "Windows Instructions",
      steps: [
        "Open the Start Menu (Windows key)",
        "Search for \"Ollama\" and click to open it",
        "Look for the Ollama icon in your system tray (bottom-right, near the clock)",
        "Open PowerShell (search for it in Start Menu)",
        "Paste the command: ollama run llama3.2:1b",
        "Press Enter and wait for the download to finish"
      ]
    },
    macos: {
      title: "macOS Instructions", 
      steps: [
        "Open Finder → Applications",
        "Double-click Ollama to open it",
        "Look for the Ollama icon in your menu bar (top of screen)",
        "Open Terminal (Cmd+Space, type \"Terminal\")",
        "Paste the command: ollama run llama3.2:1b",
        "Press Return and wait for the download to finish"
      ]
    },
    linux: {
      title: "Linux Instructions",
      steps: [
        "Open a Terminal window",
        "Run: ollama serve (keep this terminal open)",
        "Open another Terminal window",
        "Paste the command: ollama run llama3.2:1b",
        "Press Enter and wait for the download to finish"
      ]
    }
  };

  const optionDetails = {
    downloaded_nothing: (
      <div className="space-y-3">
        <p className="text-sm text-gray-300">
          After downloading, you need to run the installer:
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• <strong>Windows:</strong> Find "OllamaSetup.exe" in your Downloads folder and double-click it</p>
          <p>• <strong>Mac:</strong> Open the .dmg file from Downloads, then drag Ollama to Applications</p>
          <p>• <strong>Linux:</strong> Open Terminal and run: <code className="bg-black px-1 rounded">curl -fsSL https://ollama.com/install.sh | sh</code></p>
        </div>
      </div>
    ),
    cant_find_terminal: (
      <div className="space-y-3">
        <p className="text-sm text-gray-300">
          Here's how to open the terminal on your computer:
        </p>
        <div className="p-3 bg-black rounded-lg">
          <p className="text-xs font-mono text-emerald-400">
            {platform === "windows" && "Windows: Press Windows key, type \"PowerShell\", press Enter"}
            {platform === "macos" && "Mac: Press Cmd+Space, type \"Terminal\", press Enter"}
            {platform === "linux" && "Linux: Press Ctrl+Alt+T or search for \"Terminal\""}
          </p>
        </div>
      </div>
    ),
    taking_too_long: (
      <div className="space-y-3">
        <p className="text-sm text-gray-300">
          Model downloads can take time depending on your internet speed. Here's what to check:
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• The model is about 2GB — on slow internet it can take 10-20 minutes</p>
          <p>• Check if you see a progress bar in the terminal</p>
          <p>• Don't close the terminal window — let it finish</p>
          <p>• If it's stuck, press Ctrl+C and try again</p>
        </div>
      </div>
    ),
    connection_failed: (
      <div className="space-y-3">
        <p className="text-sm text-gray-300">
          This usually means Ollama isn't running. Try these steps:
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• Check if the Ollama icon is in your system tray / menu bar</p>
          <p>• If not, open the Ollama app from your Start Menu / Applications</p>
          <p>• If it's already open, try closing and reopening it</p>
          <p>• Restart your computer if nothing else works</p>
        </div>
      </div>
    ),
    model_not_found: (
      <div className="space-y-3">
        <p className="text-sm text-gray-300">
          This means the model hasn't been installed yet. Make sure you:
        </p>
        <div className="space-y-2 text-sm text-gray-400">
          <p>• Copied the exact command: <code className="bg-black px-1 rounded">ollama run llama3.2:1b</code></p>
          <p>• Pasted it in the terminal (not in a text file or browser)</p>
          <p>• Pressed Enter after pasting</p>
          <p>• Waited for the download to complete</p>
        </div>
      </div>
    )
  };

  const help = platformHelp[platform] || platformHelp.windows;

  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-sm bg-neutral-950 border border-white/10 rounded-2xl p-4 space-y-4 max-h-[480px] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">Having Trouble?</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => onSelectOption(option.id)}
              className={`w-full text-left p-3 rounded-lg text-sm transition-all ${
                selectedOption === option.id
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-white/[0.02] text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Option details */}
        {selectedOption && optionDetails[selectedOption] && (
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl animate-slide-up">
            {optionDetails[selectedOption]}
          </div>
        )}

        {/* Platform-specific help */}
        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
            {help.title}
          </h4>
          <div className="space-y-2">
            {help.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="text-emerald-500 font-bold flex-shrink-0">{idx + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={onRetry}
            className="w-full py-2.5 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all text-sm"
          >
            Try Again
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-transparent border border-white/10 text-gray-400 rounded-lg hover:bg-white/5 transition-all text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}