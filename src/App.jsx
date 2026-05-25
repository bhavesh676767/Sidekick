import React, { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Command parser — detects intent from typed text and returns an action object
// ---------------------------------------------------------------------------
function parseCommand(text) {
  const lower = text.toLowerCase().trim();
  if (!lower) return { action: "UNKNOWN" };

  // "youtube search <query>"
  if (lower.startsWith("youtube search ")) {
    const query = text.substring("youtube search ".length).trim();
    return {
      action: "OPEN_TAB",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      label: `YouTube search: ${query}`,
    };
  }

  // "open <site>"
  if (lower.startsWith("open ")) {
    const site = lower.substring("open ".length).trim();
    const knownSites = {
      youtube: "https://www.youtube.com",
      google: "https://www.google.com",
      twitter: "https://twitter.com",
      github: "https://github.com",
      reddit: "https://www.reddit.com",
      facebook: "https://www.facebook.com",
      instagram: "https://www.instagram.com",
      linkedin: "https://www.linkedin.com",
      amazon: "https://www.amazon.com",
      netflix: "https://www.netflix.com",
      wikipedia: "https://www.wikipedia.org",
      stackoverflow: "https://stackoverflow.com",
      chatgpt: "https://chat.openai.com",
    };
    const url = knownSites[site] || `https://${site.replace(/\s+/g, "")}.com`;
    return { action: "OPEN_TAB", url, label: `Open ${site}` };
  }

  // "search <query>"
  if (lower.startsWith("search ")) {
    const query = text.substring("search ".length).trim();
    return {
      action: "OPEN_TAB",
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      label: `Google search: ${query}`,
    };
  }

  // "summarize this page" / "summarize"
  if (lower.includes("summarize")) {
    return { action: "SUMMARIZE", label: "Summarize this page" };
  }

  // "scroll down"
  if (lower.includes("scroll down")) {
    return { action: "SCROLL", direction: "down", label: "Scroll down" };
  }

  // "scroll up"
  if (lower.includes("scroll up")) {
    return { action: "SCROLL", direction: "up", label: "Scroll up" };
  }

  // "click <text>"
  if (lower.startsWith("click ")) {
    const target = text.substring("click ".length).trim();
    return { action: "CLICK_TEXT", text: target, label: `Click "${target}"` };
  }

  // "type <text>"
  if (lower.startsWith("type ")) {
    const content = text.substring("type ".length).trim();
    return { action: "TYPE_TEXT", text: content, label: `Type "${content}"` };
  }

  return { action: "UNKNOWN", label: text };
}

// ---------------------------------------------------------------------------
// Local summarizer — basic extractive summary (no API)
// ---------------------------------------------------------------------------
function localSummarize(text) {
  if (!text || text.trim().length === 0) return "No page content found.";
  const sentences = text
    .replace(/\n+/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300);
  if (sentences.length === 0) return "Could not extract a summary from this page.";
  const picked = sentences.slice(0, 4).join(" ");
  return picked.length > 500 ? picked.substring(0, 497) + "..." : picked;
}

// ---------------------------------------------------------------------------
// Helpers for chrome API calls
// ---------------------------------------------------------------------------
const isExtension =
  typeof chrome !== "undefined" && typeof chrome.tabs !== "undefined";

function openTab(url) {
  if (!isExtension) {
    window.open(url, "_blank");
    return Promise.resolve("Tab opened (dev fallback)");
  }
  return new Promise((resolve) => {
    chrome.tabs.create({ url }, () => resolve("Tab opened"));
  });
}

function sendToActiveTab(message) {
  if (!isExtension) return Promise.resolve({ success: false, error: "Not in extension" });
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        resolve({ success: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: true });
        }
      });
    });
  });
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------
export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null); // { type: "success"|"error"|"info", text: string }
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]); // last 3 actions
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add an entry to the activity log (keep last 3)
  const addLog = (text) => {
    setLog((prev) => [{ text, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 3));
  };

  // Execute parsed command
  const executeCommand = async (cmd) => {
    switch (cmd.action) {
      case "OPEN_TAB": {
        await openTab(cmd.url);
        setResult({ type: "success", text: cmd.label });
        addLog(cmd.label);
        break;
      }
      case "SCROLL": {
        const res = await sendToActiveTab({ type: "SCROLL", direction: cmd.direction });
        if (res.success) {
          setResult({ type: "success", text: cmd.label });
        } else {
          setResult({ type: "error", text: res.error || "Could not scroll" });
        }
        addLog(cmd.label);
        break;
      }
      case "CLICK_TEXT": {
        const res = await sendToActiveTab({ type: "CLICK_TEXT", text: cmd.text });
        if (res.success) {
          setResult({ type: "success", text: `Clicked "${res.clicked || cmd.text}"` });
        } else {
          setResult({ type: "error", text: res.error || "Element not found" });
        }
        addLog(cmd.label);
        break;
      }
      case "TYPE_TEXT": {
        const res = await sendToActiveTab({ type: "TYPE_TEXT", text: cmd.text });
        if (res.success) {
          setResult({ type: "success", text: `Typed "${cmd.text}"` });
        } else {
          setResult({ type: "error", text: res.error || "No input field found" });
        }
        addLog(cmd.label);
        break;
      }
      case "SUMMARIZE": {
        const res = await sendToActiveTab({ type: "GET_PAGE_TEXT" });
        if (res.text) {
          const summary = localSummarize(res.text);
          setResult({ type: "info", text: summary });
        } else {
          setResult({ type: "error", text: res.error || "Could not read page text" });
        }
        addLog(cmd.label);
        break;
      }
      default:
        setResult({ type: "error", text: `Unknown command: "${input}"` });
        addLog(`Unknown: ${input}`);
    }
  };

  const handleRun = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    const cmd = parseCommand(trimmed);
    await executeCommand(cmd);
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleRun();
  };

  const handleChip = (text) => {
    setInput(text);
    setLoading(true);
    setResult(null);
    const cmd = parseCommand(text);
    executeCommand(cmd).then(() => setLoading(false));
  };

  // Result card background
  const resultBg =
    result?.type === "error"
      ? "bg-red-50 border-red-200"
      : result?.type === "info"
        ? "bg-gray-50 border-gray-200"
        : "bg-green-50 border-green-200";

  return (
    <div className="w-[360px] h-[520px] overflow-hidden bg-white text-black flex flex-col">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 shrink-0">
        <img
          src="sidekick_logo.png"
          alt="Sidekick"
          className="w-8 h-8 rounded-md object-contain"
        />
        <div className="leading-tight">
          <h1 className="text-sm font-bold tracking-tight">Sidekick</h1>
          <p className="text-[10px] text-gray-400 leading-none">Browser assistant</p>
        </div>
      </header>

      {/* ---- Scrollable body ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Command input + run */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sidekick to do something..."
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10
                       focus:bg-white transition-all"
          />
          <button
            onClick={handleRun}
            disabled={loading || !input.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-black rounded-xl
                       hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-40
                       disabled:cursor-not-allowed shrink-0"
          >
            {loading ? "..." : "Run"}
          </button>
        </div>

        {/* Quick action chips */}
        <div className="flex flex-wrap gap-1.5">
          {[
            "Open YouTube",
            "Search Google",
            "Summarize Page",
            "Scroll Down",
          ].map((label) => (
            <button
              key={label}
              onClick={() =>
                handleChip(
                  label === "Summarize Page" ? "summarize this page" : label.toLowerCase()
                )
              }
              className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700
                         rounded-full hover:bg-gray-200 active:scale-95 transition-all"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Result / output card */}
        {result && (
          <div
            className={`p-3 rounded-xl border text-sm leading-relaxed animate-slide-in ${resultBg}`}
          >
            <span className="font-semibold text-xs uppercase tracking-wide text-gray-500 block mb-1">
              {result.type === "error" ? "Error" : result.type === "info" ? "Summary" : "Done"}
            </span>
            {result.text}
          </div>
        )}

        {/* Activity log */}
        {log.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Recent
            </h2>
            <ul className="space-y-1">
              {log.map((entry, i) => (
                <li
                  key={i}
                  className="flex justify-between text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg"
                >
                  <span className="truncate mr-2">{entry.text}</span>
                  <span className="text-gray-300 shrink-0">{entry.time}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <footer className="text-center text-[10px] text-gray-400 py-2 border-t border-gray-100 shrink-0">
        Text mode &bull; Voice coming soon
      </footer>
    </div>
  );
}
