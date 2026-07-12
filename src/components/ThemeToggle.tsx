"use client";

import { usePrefs, setPref, resolveTheme } from "@/lib/prefs";
import Icon from "./Icon";

/** Quick dark/light switch. Flips between explicit light and dark themes. */
export default function ThemeToggle({ className }: { className?: string }) {
  const prefs = usePrefs();
  const effective = resolveTheme(prefs.theme);
  const next = effective === "dark" ? "light" : "dark";

  return (
    <button
      onClick={() => setPref("theme", next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={className ?? "flex items-center justify-center rounded-full surface px-3 py-1.5 hover:brightness-110"}
    >
      <Icon name={effective === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}
