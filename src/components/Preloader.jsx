import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Preloader – hand‑drawn sketch‑style loading overlay.
 * Accepts an optional `message` prop for status text.
 * Uses the same sketch utility classes defined in styles/index.css.
 */
export default function Preloader({ message = "Loading..." }) {
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
