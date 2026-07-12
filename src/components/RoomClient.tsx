"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useRoom } from "@/hooks/useRoom";
import { getPreferredName, setPreferredName } from "@/lib/authClient";
import Lobby from "./Lobby";
import GameBoard from "./GameBoard";
import CluePanel from "./CluePanel";
import Scoreboard from "./Scoreboard";
import Chat from "./Chat";
import Toasts from "./Toasts";
import SettingsModal from "./SettingsModal";
import RulesModal from "./RulesModal";
import Icon from "./Icon";

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { view, phase, connected, error, toasts, actions } = useRoom(code);
  const [settingsTab, setSettingsTab] = useState<"admin" | "player" | "preferences" | "accessibility" | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const leaveRoom = () => {
    actions.leave();
    router.push("/");
  };

  const copyLink = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (phase === "error") {
    return (
      <Centered>
        <p className="mb-4 text-red-400">{error ?? "Something went wrong."}</p>
        <Link href="/" className="rounded bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500">
          Back home
        </Link>
      </Centered>
    );
  }

  if (phase === "need-join") {
    return <JoinPrompt code={code} onJoin={actions.join} />;
  }

  if (!view) {
    return (
      <Centered>
        <p className="animate-pulse text-slate-400">Connecting to room {code}…</p>
      </Centered>
    );
  }

  const finished = view.phase === "finished";

  return (
    <main className="mx-auto min-h-full max-w-6xl px-3 py-4">
      <Toasts toasts={toasts} />

      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-black">
            <span className="text-agentRed">CODE</span>
            <span className="text-agentBlue">NAMES</span>
          </Link>
          <button
            onClick={() => setSettingsTab(view.you.isHost ? "admin" : "player")}
            className="flex items-center gap-1 rounded-full surface px-3 py-1 text-sm hover:brightness-110"
            title="Players / admin"
          >
            <Icon name="users" size={16} /> {view.players.length}
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded surface px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {view.variant === "pictures" ? "Pictures" : "Words"}
          </span>
          <button
            onClick={copyLink}
            title="Copy invite link"
            className="flex items-center gap-1 rounded surface-2 px-3 py-1 font-mono tracking-widest hover:brightness-110"
          >
            <span>{view.code}</span>
            <span className="flex items-center gap-1 text-xs">
              {copied ? <Icon name="check" size={14} /> : <Icon name="link" size={14} />}
            </span>
          </button>
          <span className={clsx("h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-red-500")} />
          <button
            onClick={() => setRulesOpen(true)}
            className="flex items-center gap-1.5 rounded-full surface px-3 py-1 hover:brightness-110"
          >
            <Icon name="rules" size={16} /> Rules
          </button>
          <button
            onClick={() => setSettingsTab("player")}
            className="flex items-center gap-1.5 rounded-full surface px-3 py-1 hover:brightness-110"
            title="Settings"
          >
            <Icon name="settings" size={16} /> Settings
          </button>
          <button
            onClick={leaveRoom}
            className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-500"
            title="Exit room"
          >
            <Icon name="exit" size={16} /> Exit
          </button>
        </div>
      </header>

      {settingsTab && (
        <SettingsModal
          view={view}
          actions={actions}
          initialTab={settingsTab}
          onClose={() => setSettingsTab(null)}
          onLeave={leaveRoom}
        />
      )}
      {rulesOpen && <RulesModal variant={view.variant} onClose={() => setRulesOpen(false)} />}

      {view.phase === "lobby" ? (
        <Lobby view={view} actions={actions} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Hidden state marker for end-to-end tests. */}
          <div
            data-testid="game-state"
            data-phase={view.phase}
            data-variant={view.variant}
            data-current-team={view.currentTeam ?? ""}
            data-turn-phase={view.turnPhase ?? ""}
            data-winner={view.winner ?? ""}
            hidden
          />
          <div className="space-y-4">
            {finished && <WinBanner view={view} onReturn={actions.returnToLobby} />}
            <Scoreboard view={view} />
            <GameBoard view={view} actions={actions} />
            {!finished && <CluePanel view={view} actions={actions} />}
          </div>

          <aside className="flex h-[70vh] flex-col gap-4 lg:h-auto">
            <PlayersMini view={view} />
            <div className="min-h-0 flex-1">
              <Chat view={view} actions={actions} />
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function WinBanner({
  view,
  onReturn,
}: {
  view: NonNullable<ReturnType<typeof useRoom>["view"]>;
  onReturn: () => void;
}) {
  const coop = view.variant === "coop";
  const humanWon = coop && view.winner === "blue";
  const humanLost = coop && view.winner === "red";

  let title: string;
  let detail: string;
  let good: boolean;

  if (coop) {
    good = humanWon;
    title = humanWon ? "MISSION ACCOMPLISHED!" : "MISSION FAILED";
    if (humanWon) {
      const left = view.score?.red.remaining ?? 0;
      detail = `You found all your agents with ${left} enemy agent${left === 1 ? "" : "s"} never contacted.`;
    } else {
      detail =
        view.winReason === "assassin-revealed"
          ? "You contacted the assassin."
          : "The simulated opponent contacted all of its agents first.";
    }
  } else {
    good = true;
    title = `${view.winner?.toUpperCase()} TEAM WINS!`;
    detail =
      view.winReason === "assassin-revealed"
        ? "The other team revealed the assassin."
        : "All agents were found.";
  }

  return (
    <div
      className={clsx(
        "rounded-xl p-4 text-center text-xl font-black",
        !coop && view.winner === "red" && "bg-agentRed/30 text-red-200",
        !coop && view.winner === "blue" && "bg-agentBlue/30 text-sky-200",
        coop && good && "bg-emerald-600/30 text-emerald-200",
        coop && !good && "bg-agentRed/30 text-red-200",
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <Icon name={good ? (coop ? "check" : "crown") : "skull"} size={24} />
        {title}
      </div>
      <div className="mt-1 text-sm font-normal text-muted">{detail}</div>
      <button
        onClick={onReturn}
        className="mt-3 rounded bg-emerald-600 px-4 py-2 text-base font-semibold text-white hover:bg-emerald-500"
      >
        Return to lobby / rematch
      </button>
    </div>
  );
}

function PlayersMini({ view }: { view: ReturnType<typeof useRoom>["view"] }) {
  if (!view) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm">
      <div className="mb-2 font-semibold text-slate-300">Players</div>
      <ul className="space-y-1">
        {view.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span
              className={clsx(
                "h-2 w-2 rounded-full",
                p.team === "red" && "bg-agentRed",
                p.team === "blue" && "bg-agentBlue",
                p.team === null && "bg-slate-500",
              )}
            />
            <span className={clsx(p.id === view.you.id && "font-bold")}>{p.name}</span>
            {p.role === "spymaster" && p.team && (
              <span className="text-xs text-amber-400">spymaster</span>
            )}
            {!p.connected && <span className="text-xs text-slate-500">(away)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function JoinPrompt({ code, onJoin }: { code: string; onJoin: (name: string) => void }) {
  const [name, setName] = useState(getPreferredName());
  return (
    <Centered>
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <h2 className="mb-4 text-center text-xl font-bold">
          Join room <span className="font-mono tracking-widest">{code}</span>
        </h2>
        <label className="mb-1 block text-sm text-slate-400">Your name</label>
        <input
          autoFocus
          className="mb-4 w-full rounded bg-slate-900 px-3 py-2 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          placeholder="Agent Nova"
          value={name}
          maxLength={20}
          onChange={(e) => {
            setName(e.target.value);
            setPreferredName(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && onJoin(name)}
        />
        <button
          onClick={() => onJoin(name)}
          className="w-full rounded-lg bg-sky-600 py-3 font-semibold hover:bg-sky-500"
        >
          Join
        </button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      {children}
    </main>
  );
}
