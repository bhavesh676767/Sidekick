import React, { useState } from "react";
import { X, Loader2, Minus, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import "./notch.css";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function badgeClass(state) {
  if (state === "processing") return "badge-working";
  if (state === "done") return "badge-done";
  return "badge-idle";
}

function badgeLabel(state) {
  if (state === "processing") return "Working…";
  if (state === "done") return "Done!";
  return "Ready";
}

// ── Logo / icon inside the pill ──────────────────────────────────────────────

function PillLogo({ state }) {
  if (state === "processing") {
    return <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#11120a" }} />;
  }
  return (
    <img
      src="/sidekick_logo.png"
      alt="Sidekick"
      className="sidekick-preview-logo-img"
    />
  );
}

// ── Main notch component ─────────────────────────────────────────────────────

export default function SidekickNotch({
  theme = "light",
  state = "idle",
  active = false,
  command = "",
  response = "",
  onClose,
  onMinimize,
  onSubmit,
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [quickInput, setQuickInput] = useState("");

  const summary =
    response ||
    command ||
    "Ask me to research, compare, fill, write, or browse — right here on the page!";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onSubmit?.(quickInput.trim());
    setQuickInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`sidekick-notch-preview sidekick-notch-preview-${theme}`}>

      {/* ── PILL — always visible compact bar ─────────────────────────────── */}
      <div
        className="sidekick-preview-pill"
        role="button"
        aria-label="Toggle Sidekick panel"
        tabIndex={0}
        onClick={() => setPanelOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setPanelOpen((v) => !v)}
      >
        {/* Logo bubble */}
        <span className="sidekick-preview-logo">
          <PillLogo state={state} />
        </span>

        {/* Time + subtitle copy */}
        <span className="sidekick-preview-copy">
          <strong>{formatTime()}</strong>
          <span>
            {state === "processing"
              ? "Running your task…"
              : active
              ? "Live on this page"
              : "Sidekick · click to open"}
          </span>
        </span>

        {/* Status badge */}
        <span className={`sidekick-preview-badge ${badgeClass(state)}`}>
          {badgeLabel(state)}
        </span>

        {/* Panel toggle chevron */}
        <span
          className="sidekick-preview-close"
          role="button"
          aria-label={panelOpen ? "Collapse panel" : "Expand panel"}
          onClick={(e) => {
            e.stopPropagation();
            setPanelOpen((v) => !v);
          }}
          title={panelOpen ? "Collapse" : "Expand"}
        >
          {panelOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>

        {/* Close / remove notch */}
        {onClose && (
          <span
            className="sidekick-preview-close"
            role="button"
            aria-label="Close Sidekick"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Remove notch"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {/* ── PANEL — expanded notch box ─────────────────────────────────────── */}
      {panelOpen && (
        <div className="sidekick-preview-panel">

          {/* ① Top row: label + status + minimize */}
          <div className="sidekick-preview-panel-top">
            <div className="sidekick-panel-status-row">
              <span className={`sidekick-status-dot ${state === "processing" ? "dot-working" : "dot-idle"}`} />
              <span className="panel-label">Sidekick</span>
            </div>
            <button
              type="button"
              className="panel-minimize"
              onClick={() => setPanelOpen(false)}
              aria-label="Minimize panel"
            >
              <Minus className="inline h-3 w-3 mr-0.5" />
              Hide
            </button>
          </div>

          {/* ── dashed divider ─ */}
          <hr className="sidekick-panel-divider" />

          {/* ② Quick-Ask Input — THE main action, highest priority */}
          <form onSubmit={handleSubmit}>
            <div className="sidekick-preview-input">
              <Sparkles
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ opacity: 0.45 }}
              />
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sidekick anything…"
                aria-label="Quick command for Sidekick"
                className="input-placeholder"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  flex: 1,
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: "11.5px",
                  opacity: quickInput ? 1 : 0.5,
                }}
              />
              <button
                type="submit"
                className="input-go-btn"
                disabled={!quickInput.trim()}
                aria-label="Submit command"
              >
                Go! ✦
              </button>
            </div>
          </form>

          {/* ③ Summary / context — what Sidekick is doing or last response */}
          <div className="sidekick-preview-summary">
            {state === "processing" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ flexShrink: 0 }} />
                {command || "Running your task…"}
              </span>
            ) : (
              summary
            )}
          </div>

        </div>
      )}
    </div>
  );
}
