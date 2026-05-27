import React from "react";
import { Loader2, Mic, Volume2, AlertTriangle } from "lucide-react";

import "./notch.css";

function PreviewIcon({ state }) {
  if (state === "listening" || state === "speaking") {
    return (
      <span className="sidekick-notch-wave" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    );
  }

  if (state === "processing") {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  if (state === "error") {
    return <AlertTriangle className="w-4 h-4" />;
  }

  return <Mic className="w-4 h-4" />;
}

export default function SidekickNotch({ state = "idle", active = false, command = "", response = "" }) {
  const eyebrow = active ? "Floating notch active" : "Launch to inject into pages";
  const body = command || response || "Voice and commands live on the page, not inside the popup.";

  return (
    <div className="sidekick-notch-preview p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.24em] text-white/45">{eyebrow}</p>
          <h3 className="mt-2 text-sm font-semibold text-white">Sidekick Notch</h3>
          <p className="mt-2 max-w-[210px] text-[11px] leading-relaxed text-white/72">
            {body}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/60">
          {state}
        </div>
      </div>

      <div className="absolute left-4 bottom-4 flex items-center gap-2 text-[10px] text-white/52">
        <Volume2 className="w-3.5 h-3.5" />
        <span>Persistent across tabs</span>
      </div>

      <div className="sidekick-notch-chip">
        <PreviewIcon state={state} />
      </div>
    </div>
  );
}
