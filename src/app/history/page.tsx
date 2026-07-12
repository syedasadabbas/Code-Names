"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken, getProfile } from "@/lib/authClient";

interface Entry {
  id: string;
  roomCode: string;
  winner: string | null;
  winReason: string | null;
  finishedAt: string;
  team: string | null;
  won: boolean;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Sign in to view your game history.");
      return;
    }
    fetch("/api/history", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setEntries(d.history);
      })
      .catch(() => setError("Failed to load history."));
  }, []);

  const profile = getProfile();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Game history</h1>
        <Link href="/" className="text-sky-400 hover:underline">
          ← Home
        </Link>
      </div>
      {profile && <p className="mb-4 text-slate-400">{profile.displayName}</p>}

      {error && <p className="text-red-400">{error}</p>}
      {!error && !entries && <p className="animate-pulse text-slate-400">Loading…</p>}
      {entries && entries.length === 0 && (
        <p className="text-slate-400">No finished games yet. Go play one!</p>
      )}
      {entries && entries.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2">Date</th>
              <th>Room</th>
              <th>Your team</th>
              <th>Winner</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id + e.finishedAt} className="border-t border-slate-800">
                <td className="py-2">{new Date(e.finishedAt).toLocaleString()}</td>
                <td className="font-mono">{e.roomCode}</td>
                <td className="uppercase">{e.team ?? "—"}</td>
                <td className="uppercase">{e.winner ?? "—"}</td>
                <td className={e.won ? "font-semibold text-emerald-400" : "text-slate-400"}>
                  {e.won ? "Won" : "Lost"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
