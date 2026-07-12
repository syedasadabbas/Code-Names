"use client";

// Client-side user preferences (persisted to localStorage) with a tiny pub/sub
// so React components and the sound engine can react to changes. These are
// per-browser and never sent to the server.

import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type TextSize = "sm" | "md" | "lg";
export type MotionMode = "system" | "on" | "off"; // on = reduced motion forced on

export interface Prefs {
  soundEnabled: boolean;
  musicVolume: number; // 0..1
  effectsVolume: number; // 0..1
  theme: ThemeMode;
  textSize: TextSize;
  colorblind: boolean;
  reducedMotion: MotionMode;
  alwaysShowGuess: boolean;
}

const DEFAULTS: Prefs = {
  soundEnabled: true,
  musicVolume: 0.0,
  effectsVolume: 0.6,
  theme: "dark",
  textSize: "md",
  colorblind: false,
  reducedMotion: "system",
  alwaysShowGuess: false,
};

const KEY = "codenames:prefs";
let current: Prefs = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  if (loaded) return current;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    current = DEFAULTS;
  }
  loaded = true;
  return current;
}

export function getPrefs(): Prefs {
  return load();
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  current = { ...load(), [key]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore quota/availability errors */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook returning the live prefs object. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, () => DEFAULTS);
}

/** Resolve the effective theme, accounting for the system preference. */
export function resolveTheme(theme: ThemeMode): "dark" | "light" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    return "dark";
  }
  return theme;
}

/** Whether motion should be reduced right now. */
export function motionReduced(mode: MotionMode): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}
