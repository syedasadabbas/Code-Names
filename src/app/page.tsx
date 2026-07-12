"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { getPreferredName, setPreferredName, setIdentity } from "@/lib/authClient";
import type { CreateJoinAck, GameVariant } from "@shared/protocol";
import AuthPanel from "@/components/AuthPanel";
import RulesModal from "@/components/RulesModal";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [matchVariant, setMatchVariant] = useState<GameVariant | "any">("any");
  const [stats, setStats] = useState<{ openRooms: number; players: number } | null>(null);

  useEffect(() => {
    setName(getPreferredName());
  }, []);

  useEffect(() => {
    const s = getSocket();
    const load = () => s.emit("match:stats", (r) => setStats(r));
    if (s.connected) load();
    s.on("connect", load);
    const t = setInterval(load, 5000);
    return () => {
      clearInterval(t);
      s.off("connect", load);
    };
  }, []);

  function findMatch() {
    setBusy(true);
    setErr(null);
    getSocket().emit(
      "match:find",
      { name: name || "Anonymous", variant: matchVariant },
      (ack: CreateJoinAck) => {
        setBusy(false);
        if (ack.ok && ack.code && ack.identity) {
          setIdentity(ack.code, ack.identity);
          router.push(`/room/${ack.code}`);
        } else {
          setErr(ack.error || "Could not find a match.");
        }
      },
    );
  }

  function remember(n: string) {
    setName(n);
    setPreferredName(n);
  }

  function createRoom(variant: GameVariant) {
    setBusy(true);
    setErr(null);
    getSocket().emit(
      "room:create",
      { name: name || "Anonymous", variant },
      (ack: CreateJoinAck) => {
        setBusy(false);
        if (ack.ok && ack.code && ack.identity) {
          setIdentity(ack.code, ack.identity);
          router.push(`/room/${ack.code}`);
        } else {
          setErr(ack.error || "Could not create room.");
        }
      },
    );
  }

  function joinRoom() {
    const c = code.trim().toUpperCase();
    if (c.length < 3) {
      setErr("Enter a valid room code.");
      return;
    }
    setBusy(true);
    setErr(null);
    getSocket().emit("room:join", { code: c, name: name || "Anonymous" }, (ack: CreateJoinAck) => {
      setBusy(false);
      if (ack.ok && ack.code && ack.identity) {
        setIdentity(ack.code, ack.identity);
        router.push(`/room/${ack.code}`);
      } else {
        setErr(ack.error || "Could not join room.");
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6">
      {rulesOpen && <RulesModal variant="classic" onClose={() => setRulesOpen(false)} />}

      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-agentRed">CODE</span>
          <span className="text-agentBlue">NAMES</span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRulesOpen(true)}
            className="rounded-full surface px-3 py-1.5 text-sm font-semibold hover:brightness-110"
          >
            📖 Rules
          </button>
          <AuthPanel />
        </div>
      </header>

      <section className="mb-8 text-center">
        <h2 className="mb-2 text-4xl font-black">Play Codenames online</h2>
        <p className="mx-auto max-w-xl text-muted">
          Give clever one-word clues, find your agents, avoid the assassin. Real-time, multi-room,
          with friends. Choose a game to start.
        </p>
        <div className="mx-auto mt-5 flex max-w-sm flex-col items-center gap-1">
          <label className="text-sm text-muted">Your name</label>
          <input
            className="w-full rounded-lg surface-2 px-3 py-2 text-center outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
            placeholder="e.g. Agent Nova"
            value={name}
            maxLength={20}
            onChange={(e) => remember(e.target.value)}
          />
        </div>
      </section>

      {/* Quick Match */}
      <section className="mb-6 flex flex-col items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#4338ca] to-[#0d9488] p-5 text-white sm:flex-row">
        <div>
          <h3 className="text-xl font-black">⚡ Quick Match</h3>
          <p className="text-sm text-white/80">
            Jump into an open public room — or start one and wait for players.
          </p>
          <p className="mt-1 text-xs text-white/70" data-testid="match-stats">
            {stats ? `${stats.openRooms} open room${stats.openRooms === 1 ? "" : "s"} · ${stats.players} waiting` : "…"}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <select
            data-testid="match-variant"
            value={matchVariant}
            onChange={(e) => setMatchVariant(e.target.value as GameVariant | "any")}
            className="rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
          >
            <option value="any">Any game</option>
            <option value="classic">Words</option>
            <option value="pictures">Pictures</option>
            <option value="coop">Co-op</option>
          </select>
          <button
            data-testid="find-match"
            disabled={busy}
            onClick={findMatch}
            className="flex-1 rounded-lg bg-white px-6 py-2 font-bold text-slate-900 transition hover:bg-white/90 disabled:opacity-60 sm:flex-none"
          >
            Find a match
          </button>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <GameCard
          title="CODENAMES"
          subtitle="The classic word game"
          meta="25 words · 5×5 · 4+ players"
          gradient="from-[#c0392b] via-[#7b2d8e] to-[#2471a3]"
          icon="🔤"
          cta="Create word game"
          busy={busy}
          onClick={() => createRoom("classic")}
        />
        <GameCard
          title="PICTURES"
          subtitle="Codenames: Pictures"
          meta="20 images · 5×4 · 4+ players"
          gradient="from-[#0f766e] via-[#0d9488] to-[#059669]"
          icon="🖼️"
          cta="Create picture game"
          busy={busy}
          onClick={() => createRoom("pictures")}
        />
        <GameCard
          title="CO-OP"
          subtitle="Team up vs a simulated opponent"
          meta="Words · 5×5 · 2+ players"
          gradient="from-[#7c3aed] via-[#6d28d9] to-[#4338ca]"
          icon="🤝"
          cta="Create co-op game"
          busy={busy}
          onClick={() => createRoom("coop")}
        />

        {/* Join a room */}
        <section className="surface rounded-2xl p-6">
          <h3 className="mb-1 text-xl font-bold">Join a room</h3>
          <p className="mb-4 text-sm text-muted">Got a 4-letter code from a friend?</p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg surface-2 px-3 py-2 font-mono text-lg uppercase tracking-widest outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
              placeholder="ABCD"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            />
            <button
              disabled={busy}
              onClick={joinRoom}
              className="rounded-lg bg-sky-600 px-5 font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </section>

        {/* How to play */}
        <button
          onClick={() => setRulesOpen(true)}
          className="surface rounded-2xl p-6 text-left transition hover:brightness-110"
        >
          <h3 className="mb-1 text-xl font-bold">📖 How to play</h3>
          <p className="text-sm text-muted">
            New here? Learn the roles, clues, and how to win in a couple of minutes.
          </p>
          <span className="mt-4 inline-block font-semibold text-sky-500">Read the rules →</span>
        </button>
      </div>

      {err && <p className="mt-6 text-center text-red-400">{err}</p>}

      <footer className="mt-auto pt-10 text-center text-xs text-muted">
        A fan-made online implementation of Codenames &amp; Codenames: Pictures (designed by Vlaada
        Chvátil, published by Czech Games Edition). For private play with friends.
      </footer>
    </main>
  );
}

function GameCard({
  title,
  subtitle,
  meta,
  gradient,
  icon,
  cta,
  busy,
  onClick,
}: {
  title: string;
  subtitle: string;
  meta: string;
  gradient: string;
  icon: string;
  cta: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg`}
    >
      <div className="absolute -right-4 -top-3 text-7xl opacity-20 select-none">{icon}</div>
      <h3 className="text-2xl font-black tracking-tight">{title}</h3>
      <p className="text-white/90">{subtitle}</p>
      <p className="mt-1 text-sm text-white/70">{meta}</p>
      <button
        disabled={busy}
        onClick={onClick}
        className="mt-5 w-full rounded-lg bg-white/95 py-3 font-bold text-slate-900 transition hover:bg-white disabled:opacity-60"
      >
        {cta}
      </button>
    </section>
  );
}
