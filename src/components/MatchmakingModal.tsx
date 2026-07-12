"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

/**
 * Full-screen "searching for a match" overlay with an animated globe
 * (rotating meridians, a radar sweep, blinking location pings, and a gentle
 * zoom). Shown while Quick Match looks for players. Cancel backs out.
 */
export default function MatchmakingModal({
  variantLabel,
  onCancel,
}: {
  variantLabel: string;
  onCancel: () => void;
}) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const pings = [
    { x: 70, y: 78 },
    { x: 128, y: 66 },
    { x: 112, y: 120 },
    { x: 84, y: 134 },
    { x: 140, y: 104 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Searching for a match"
    >
      <div className="globe-zoom">
        <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-[0_0_24px_rgba(56,189,248,0.35)]">
          <defs>
            <clipPath id="globeClip">
              <circle cx="100" cy="100" r="80" />
            </clipPath>
            <radialGradient id="globeFill" cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#0b1220" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
          </defs>

          <circle cx="100" cy="100" r="80" fill="url(#globeFill)" stroke="#38bdf8" strokeWidth="1.5" />

          <g clipPath="url(#globeClip)" stroke="#38bdf8" strokeOpacity="0.5" fill="none" strokeWidth="1">
            {/* Rotating meridians + parallels */}
            <g className="globe-spin" style={{ transformOrigin: "100px 100px" }}>
              <ellipse cx="100" cy="100" rx="26" ry="80" />
              <ellipse cx="100" cy="100" rx="55" ry="80" />
              <ellipse cx="100" cy="100" rx="80" ry="80" />
              <line x1="20" y1="100" x2="180" y2="100" />
              <line x1="30" y1="65" x2="170" y2="65" />
              <line x1="30" y1="135" x2="170" y2="135" />
            </g>

            {/* Radar sweep */}
            <g className="globe-sweep" style={{ transformOrigin: "100px 100px" }}>
              <line x1="100" y1="100" x2="100" y2="24" stroke="#7dd3fc" strokeWidth="2" strokeOpacity="0.9" />
            </g>

            {/* Blinking connection pings */}
            {pings.map((p, i) => (
              <circle
                key={i}
                className="globe-ping"
                cx={p.x}
                cy={p.y}
                r="2"
                fill="#22d3ee"
                stroke="none"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </g>
        </svg>
      </div>

      <h2 className="mt-6 flex items-center gap-2 text-2xl font-black text-white">
        <Icon name="search" size={22} />
        Finding a match<span className="inline-block w-6 text-left">{".".repeat((secs % 3) + 1)}</span>
      </h2>
      <p className="mt-1 text-slate-300">Connecting you with players — {variantLabel}</p>
      <p className="mt-1 text-sm text-slate-500">{secs}s</p>

      <button
        onClick={onCancel}
        className="mt-8 flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 font-semibold text-white hover:bg-red-500"
      >
        <Icon name="close" size={18} />
        Cancel
      </button>
    </div>
  );
}
