"use client";

// Client-side identity helpers.
// - Guests: a per-room { playerId, token } pair used to reclaim a seat on reload.
// - Accounts: a JWT (from /api/auth/*) plus a cached profile.

import type { Identity } from "@shared/protocol";

const TOKEN_KEY = "codenames:jwt";
const PROFILE_KEY = "codenames:profile";
const NAME_KEY = "codenames:name";

export interface Profile {
  userId: string;
  username: string;
  displayName: string;
}

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// --- account token ---
export function getToken(): string | null {
  return safeLocalStorage()?.getItem(TOKEN_KEY) ?? null;
}
export function setToken(token: string): void {
  safeLocalStorage()?.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  const ls = safeLocalStorage();
  ls?.removeItem(TOKEN_KEY);
  ls?.removeItem(PROFILE_KEY);
}

export function getProfile(): Profile | null {
  const raw = safeLocalStorage()?.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}
export function setProfile(p: Profile): void {
  safeLocalStorage()?.setItem(PROFILE_KEY, JSON.stringify(p));
}

// --- preferred display name (for guests) ---
export function getPreferredName(): string {
  return getProfile()?.displayName || safeLocalStorage()?.getItem(NAME_KEY) || "";
}
export function setPreferredName(name: string): void {
  safeLocalStorage()?.setItem(NAME_KEY, name);
}

// --- per-room guest identity ---
export function getIdentity(code: string): Identity | null {
  const raw = safeLocalStorage()?.getItem(`codenames:id:${code.toUpperCase()}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}
export function setIdentity(code: string, id: Identity): void {
  safeLocalStorage()?.setItem(`codenames:id:${code.toUpperCase()}`, JSON.stringify(id));
}
