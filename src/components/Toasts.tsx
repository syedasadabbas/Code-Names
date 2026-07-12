"use client";

import clsx from "clsx";
import type { Toast } from "@/hooks/useRoom";

export default function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-medium shadow-lg",
            t.kind === "error" && "bg-red-600 text-white",
            t.kind === "success" && "bg-emerald-600 text-white",
            t.kind === "info" && "bg-slate-700 text-white",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
