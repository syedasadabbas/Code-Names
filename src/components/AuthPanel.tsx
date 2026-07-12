"use client";

import { useEffect, useState } from "react";
import {
  clearToken,
  getProfile,
  setProfile,
  setToken,
  setPreferredName,
  type Profile,
} from "@/lib/authClient";

/**
 * Optional account widget. Accounts let finished games be attributed to a player
 * so history is retained; guests can play without one.
 */
export default function AuthPanel() {
  const [profile, setLocalProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"login" | "register" | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLocalProfile(getProfile());
  }, []);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, displayName: displayName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setToken(data.token);
      setProfile(data.profile);
      setPreferredName(data.profile.displayName);
      setLocalProfile(data.profile);
      setMode(null);
      setUsername("");
      setPassword("");
      // Reload so the socket reconnects with the new auth token.
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearToken();
    setLocalProfile(null);
    window.location.reload();
  }

  if (profile) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">
          Signed in as <span className="font-semibold text-white">{profile.displayName}</span>
        </span>
        <a href="/history" className="text-sky-400 hover:underline">
          History
        </a>
        <button onClick={logout} className="text-muted hover:opacity-80">
          Sign out
        </button>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <span>Playing as guest.</span>
        <button onClick={() => setMode("login")} className="text-sky-400 hover:underline">
          Sign in
        </button>
        <button onClick={() => setMode("register")} className="text-sky-400 hover:underline">
          Create account
        </button>
      </div>
    );
  }

  return (
    <div className="surface w-full max-w-sm rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{mode === "register" ? "Create account" : "Sign in"}</h3>
        <button onClick={() => setMode(null)} className="text-muted hover:opacity-80">
          ✕
        </button>
      </div>
      <div className="space-y-2">
        <input
          className="w-full rounded bg-[var(--surface-2)] px-3 py-2 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {mode === "register" && (
          <input
            className="w-full rounded bg-[var(--surface-2)] px-3 py-2 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          type="password"
          className="w-full rounded bg-[var(--surface-2)] px-3 py-2 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          disabled={busy}
          onClick={submit}
          className="w-full rounded bg-sky-600 py-2 text-sm font-semibold hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
