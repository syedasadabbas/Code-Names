"use client";

// Synthesized sound effects via the Web Audio API. No audio files are bundled,
// which keeps the app offline-friendly, CSP-safe, and free of asset licensing.
// Each effect is a short composed tone; volume follows the user's preferences.

import { getPrefs } from "./prefs";

export type SoundName =
  | "select" // clicking a card
  | "turn" // a team's turn begins
  | "clue" // a clue was given
  | "message" // chat message received
  | "correct" // revealed your own agent
  | "wrong" // revealed a bystander/opponent (wrong)
  | "neutral" // revealed an innocent bystander
  | "assassin" // revealed the assassin / double agent — game over
  | "win" // your team won
  | "lose"; // your team lost

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers start the context suspended until a user gesture; resume best-effort.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Note {
  freq: number;
  start: number; // seconds offset
  dur: number;
  type?: OscillatorType;
  gain?: number; // relative 0..1 within the effect
}

const RECIPES: Record<SoundName, Note[]> = {
  select: [{ freq: 660, start: 0, dur: 0.05, type: "triangle", gain: 0.5 }],
  turn: [
    { freq: 523.25, start: 0, dur: 0.12, type: "sine" },
    { freq: 659.25, start: 0.1, dur: 0.16, type: "sine" },
  ],
  clue: [
    { freq: 587.33, start: 0, dur: 0.1, type: "triangle" },
    { freq: 880, start: 0.09, dur: 0.14, type: "triangle" },
  ],
  message: [{ freq: 880, start: 0, dur: 0.05, type: "sine", gain: 0.4 }],
  correct: [
    { freq: 523.25, start: 0, dur: 0.11, type: "sine" },
    { freq: 783.99, start: 0.1, dur: 0.18, type: "sine" },
  ],
  wrong: [
    { freq: 220, start: 0, dur: 0.16, type: "sawtooth", gain: 0.7 },
    { freq: 146.83, start: 0.14, dur: 0.22, type: "sawtooth", gain: 0.7 },
  ],
  neutral: [{ freq: 300, start: 0, dur: 0.16, type: "sine", gain: 0.6 }],
  assassin: [
    { freq: 130.81, start: 0, dur: 0.4, type: "sawtooth", gain: 0.9 },
    { freq: 92.5, start: 0.18, dur: 0.5, type: "sawtooth", gain: 0.9 },
    { freq: 61.74, start: 0.42, dur: 0.6, type: "square", gain: 0.7 },
  ],
  win: [
    { freq: 523.25, start: 0, dur: 0.12, type: "triangle" },
    { freq: 659.25, start: 0.11, dur: 0.12, type: "triangle" },
    { freq: 783.99, start: 0.22, dur: 0.12, type: "triangle" },
    { freq: 1046.5, start: 0.33, dur: 0.28, type: "triangle" },
  ],
  lose: [
    { freq: 392, start: 0, dur: 0.16, type: "sine" },
    { freq: 311.13, start: 0.15, dur: 0.18, type: "sine" },
    { freq: 233.08, start: 0.32, dur: 0.34, type: "sine" },
  ],
};

export function playSound(name: SoundName): void {
  const prefs = getPrefs();
  if (!prefs.soundEnabled || prefs.effectsVolume <= 0) return;
  const ac = audio();
  if (!ac) return;

  const master = prefs.effectsVolume; // 0..1
  const now = ac.currentTime;

  for (const note of RECIPES[name]) {
    const osc = ac.createOscillator();
    const gainNode = ac.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;

    const peak = master * (note.gain ?? 1) * 0.22; // keep well below clipping
    const t0 = now + note.start;
    const t1 = t0 + note.dur;
    // Short attack, exponential release for a soft, non-clicky envelope.
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(gainNode).connect(ac.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

/** Called from a user gesture to unlock audio on browsers that require it. */
export function primeAudio(): void {
  audio();
}
