"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export default function TurnTimer({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);

  if (!deadline) return null;
  const remainingMs = Math.max(0, deadline - now);
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const urgent = totalSec <= 10;

  return (
    <div
      className={clsx(
        "rounded-md px-3 py-1 font-mono text-lg tabular-nums",
        urgent ? "bg-red-600 text-white animate-pulse" : "bg-slate-700 text-slate-100",
      )}
      aria-label="Turn timer"
    >
      {mm}:{ss.toString().padStart(2, "0")}
    </div>
  );
}
