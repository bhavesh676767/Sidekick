import React from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import "./notch.css";

function PreviewIcon({ state }) {
  if (state === "processing") return <Loader2 className="h-4 w-4 animate-spin" />;
  if (state === "error") return <AlertTriangle className="h-4 w-4" />;
  return <img src="/sidekick_logo.png" alt="" className="h-7 w-7 rounded-full object-cover" />;
}

export default function SidekickNotch({ theme = "light", state = "idle", active = false, command = "", response = "" }) {
  const body = command || response || "Prompt Sidekick from the page and let it handle the boring browser stuff.";
  const label = active ? "Notch is live" : "Ready to launch";

  return (
    <div className={`sidekick-notch-preview sidekick-notch-preview-${theme} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="sidekick-notch-kicker">{label}</p>
          <h3 className="mt-2 text-lg font-black">Page buddy</h3>
          <p className="mt-2 max-w-[218px] text-[11px] font-semibold leading-relaxed">
            {body}
          </p>
        </div>
        <div className="sidekick-notch-state">
          {state}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[10px] font-black">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Prompt based</span>
      </div>

      <div className="sidekick-notch-chip">
        <PreviewIcon state={state} />
      </div>
    </div>
  );
}
