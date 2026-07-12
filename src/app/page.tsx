"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { getPreferredName, setPreferredName, setIdentity } from "@/lib/authClient";
import type { CreateJoinAck, GameVariant, Identity } from "@shared/protocol";
import AuthPanel from "@/components/AuthPanel";
import RulesModal from "@/components/RulesModal";
import MatchmakingModal from "@/components/MatchmakingModal";
import SocialDock from "@/components/SocialDock";
import ThemeToggle from "@/components/ThemeToggle";
import Icon, { type IconName } from "@/components/Icon";

// Public Android APK (EAS cloud build). Override per release with NEXT_PUBLIC_APK_URL;
// the default points at the current published build so the download works out of the box.
const APK_URL =
  process.env.NEXT_PUBLIC_APK_URL ||
  "https://expo.dev/artifacts/eas/WqmHzftpkBUnw8dv8ipb1BZ8xU77mUgkH4x1s6nkZOU.apk";

const VARIANT_LABEL: Record<string, string> = {
  any: "Any game",
  classic: "Words",
  pictures: "Pictures",
  coop: "Co-op",
};

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [matchVariant, setMatchVariant] = useState<GameVariant | "any">("any");
  const [stats, setStats] = useState<{ openRooms: number; players: number } | null>(null);
  const [matching, setMatching] = useState(false);

  const cancelled = useRef(false);

  useEffect(() => {
    setName(getPreferredName());
  }, []);

  // While searching, a match is formed asynchronously (when a second player is
  // also waiting, or a public room opens). Navigate when the server pairs us.
  useEffect(() => {
    if (!matching) return;
    const s = getSocket();
    const onFound = (data: { code: string; identity: Identity }) => {
      if (cancelled.current) return;
      setIdentity(data.code, data.identity);
      router.push(`/room/${data.code}`);
    };
    s.on("match:found", onFound);
    return () => {
      s.off("match:found", onFound);
    };
  }, [matching, router]);

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

  function remember(n: string) {
    setName(n);
    setPreferredName(n);
  }

  function go(ack: CreateJoinAck) {
    if (ack.ok && ack.code && ack.identity) {
      setIdentity(ack.code, ack.identity);
      router.push(`/room/${ack.code}`);
    } else {
      setErr(ack.error || "Something went wrong.");
    }
  }

  function createRoom(variant: GameVariant) {
    setBusy(true);
    setErr(null);
    getSocket().emit("room:create", { name: name || "Anonymous", variant }, (ack: CreateJoinAck) => {
      setBusy(false);
      go(ack);
    });
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
      go(ack);
    });
  }

  function findMatch() {
    setErr(null);
    cancelled.current = false;
    setMatching(true);
    getSocket().emit(
      "match:find",
      { name: name || "Anonymous", variant: matchVariant },
      (ack: CreateJoinAck) => {
        if (cancelled.current) {
          if (ack.ok && ack.code) getSocket().emit("room:leave");
          return;
        }
        if (ack.ok && ack.code && ack.identity) {
          // Joined an already-open public room.
          setIdentity(ack.code, ack.identity);
          router.push(`/room/${ack.code}`);
        } else if (!ack.ok) {
          setMatching(false);
          setErr(ack.error || "Could not find a match.");
        }
        // else: still searching — the match:found listener navigates when paired.
      },
    );
  }

  function cancelMatch() {
    cancelled.current = true;
    getSocket().emit("match:cancel");
    setMatching(false);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6">
      {rulesOpen && <RulesModal variant="classic" onClose={() => setRulesOpen(false)} />}
      {matching && (
        <MatchmakingModal variantLabel={VARIANT_LABEL[matchVariant]} onCancel={cancelMatch} />
      )}
      <SocialDock />

      <header className="mb-10 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-[0.2em]">
          <span className="text-agentRed">CODE</span>
          <span className="text-agentBlue">NAMES</span>
        </h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setRulesOpen(true)}
            className="flex items-center gap-1.5 rounded-full surface px-3 py-1.5 text-sm font-semibold hover:brightness-110"
          >
            <Icon name="rules" size={16} />
            Rules
          </button>
          <AuthPanel />
        </div>
      </header>

      <section className="mb-8 text-center">
        <h2 className="mb-3 text-4xl font-black tracking-tight sm:text-5xl">
          The word game of <span className="text-agentRed">secret</span>{" "}
          <span className="text-agentBlue">agents</span>
        </h2>
        <p className="mx-auto max-w-xl text-muted">
          Give clever one-word clues, uncover your agents, and avoid the assassin. Real-time and
          online — play with friends or match with strangers.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-1.5">
          <label className="text-sm text-muted">Your codename</label>
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
      <section className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] surface">
        <div className="flex flex-col items-center justify-between gap-4 p-5 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <Icon name="bolt" size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold">Quick Match</h3>
              <p className="text-sm text-muted">Get matched into an open public room instantly.</p>
              <p className="mt-0.5 text-xs text-muted" data-testid="match-stats">
                {stats
                  ? `${stats.openRooms} open room${stats.openRooms === 1 ? "" : "s"} · ${stats.players} waiting`
                  : " "}
              </p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <select
              data-testid="match-variant"
              value={matchVariant}
              onChange={(e) => setMatchVariant(e.target.value as GameVariant | "any")}
              className="rounded-lg surface-2 px-3 py-2 text-sm font-semibold outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
            >
              <option value="any">Any game</option>
              <option value="classic">Words</option>
              <option value="pictures">Pictures</option>
              <option value="coop">Co-op</option>
            </select>
            <button
              data-testid="find-match"
              disabled={matching}
              onClick={findMatch}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-2 font-bold text-white transition hover:bg-sky-500 disabled:opacity-60 sm:flex-none"
            >
              <Icon name="search" size={18} />
              Find a match
            </button>
          </div>
        </div>
      </section>

      <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">
        Or start your own
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <GameCard
          title="Words"
          subtitle="Classic Codenames"
          meta="25 words · 5×5 · 4+ players"
          icon="text"
          accent="bg-gradient-to-r from-agentRed to-agentBlue"
          tint="text-slate-200"
          testId="create-classic"
          busy={busy}
          onClick={() => createRoom("classic")}
        />
        <GameCard
          title="Pictures"
          subtitle="Codenames: Pictures"
          meta="20 images · 5×4 · 4+ players"
          icon="image"
          accent="bg-teal-500"
          tint="text-teal-300"
          testId="create-pictures"
          busy={busy}
          onClick={() => createRoom("pictures")}
        />
        <GameCard
          title="Co-op"
          subtitle="Team vs. simulated rival"
          meta="Words · 5×5 · 2+ players"
          icon="coop"
          accent="bg-indigo-500"
          tint="text-indigo-300"
          testId="create-coop"
          busy={busy}
          onClick={() => createRoom("coop")}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Join a room */}
        <section className="surface rounded-2xl p-6">
          <h3 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <Icon name="link" size={18} /> Join a room
          </h3>
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
              className="rounded-lg bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
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
          <h3 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <Icon name="rules" size={18} /> How to play
          </h3>
          <p className="text-sm text-muted">
            New here? Learn the roles, clues, and how to win in a couple of minutes.
          </p>
          <span className="mt-4 inline-block font-semibold text-sky-400">Read the rules →</span>
        </button>
      </div>

      {err && <p className="mt-6 text-center text-red-400">{err}</p>}

      {APK_URL && (
        <div className="mt-4 flex justify-center">
          <a
            href={APK_URL}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] surface px-4 py-2 text-sm font-semibold hover:brightness-110"
          >
            <Icon name="download" size={16} /> Get the Android app (APK)
          </a>
        </div>
      )}

      <footer className="mt-auto space-y-2 pt-10 text-center text-xs text-muted">
        <p>
          Built by{" "}
          <a
            href="https://decodrs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sky-400 hover:underline"
          >
            Decodrs
          </a>
        </p>
        <p>
          A fan-made online implementation of Codenames &amp; Codenames: Pictures (designed by Vlaada
          Chvátil, published by Czech Games Edition). For private play with friends.
        </p>
      </footer>
    </main>
  );
}

function GameCard({
  title,
  subtitle,
  meta,
  icon,
  accent,
  tint,
  testId,
  busy,
  onClick,
}: {
  title: string;
  subtitle: string;
  meta: string;
  icon: IconName;
  accent: string;
  tint: string;
  testId: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <section className="surface flex flex-col overflow-hidden rounded-2xl">
      <div className={`h-1.5 w-full ${accent}`} />
      <div className="flex flex-1 flex-col p-5">
        <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${tint}`}>
          <Icon name={icon} size={22} />
        </span>
        <h3 className="text-xl font-black">{title}</h3>
        <p className="text-sm text-muted">{subtitle}</p>
        <p className="mt-1 text-xs text-muted">{meta}</p>
        <button
          data-testid={testId}
          disabled={busy}
          onClick={onClick}
          className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-slate-700 py-2.5 font-semibold text-white transition hover:bg-slate-600 disabled:opacity-60"
        >
          <Icon name="play" size={16} /> Create
        </button>
      </div>
    </section>
  );
}
