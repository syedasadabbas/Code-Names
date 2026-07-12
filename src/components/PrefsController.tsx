"use client";

import { useEffect } from "react";
import { usePrefs, resolveTheme, motionReduced } from "@/lib/prefs";

/**
 * Applies user preferences (theme, text size, reduced motion) to the document
 * root as data-* attributes that globals.css keys off. Mounted once in the
 * root layout. Also reacts to OS-level changes when set to "system".
 */
export default function PrefsController() {
  const prefs = usePrefs();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolveTheme(prefs.theme);
      root.dataset.textsize = prefs.textSize;
      root.dataset.motion = motionReduced(prefs.reducedMotion) ? "reduce" : "full";
    };
    apply();

    const mqTheme = window.matchMedia("(prefers-color-scheme: light)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    mqTheme.addEventListener?.("change", apply);
    mqMotion.addEventListener?.("change", apply);
    return () => {
      mqTheme.removeEventListener?.("change", apply);
      mqMotion.removeEventListener?.("change", apply);
    };
  }, [prefs.theme, prefs.textSize, prefs.reducedMotion]);

  return null;
}
