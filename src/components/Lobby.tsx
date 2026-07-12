"use client";

import { useState } from "react";
import clsx from "clsx";
import type { GameVariant, PlayerView, RoomView, Team } from "@shared/protocol";
import { WORD_PACK_META } from "@shared/protocol";
import type { RoomActions } from "@/hooks/useRoom";

/**
 * Themed pre-game lobby: two team columns (blue / red), each split into
 * Operatives and Spymasters, with a central Game Settings panel. Inspired by the
 * classic Codenames online lobby layout, styled with our own theme.
 */
export default function Lobby({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const you = view.you;
  const coop = view.variant === "coop";
  const spectators = view.players.filter((p) => p.team === null);
  const meSpectator = you.team === null;

  return (
    <div className="space-y-5">
      {/* Spectators header */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Spectators 👁</h2>
          {!meSpectator && (
            <button
              data-testid="join-spectators"
              onClick={() => actions.setTeam(null)}
              className="rounded-full surface px-3 py-1 text-sm hover:brightness-110"
            >
              Join Spectators
            </button>
          )}
        </div>
        <div className="flex min-h-[2rem] flex-wrap justify-center gap-2">
          {spectators.map((p) => (
            <PlayerChip key={p.id} p={p} youId={you.id} tone="neutral" />
          ))}
        </div>
      </div>

      <div
        className={clsx(
          "grid gap-4",
          coop
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]",
        )}
      >
        <TeamColumn team="blue" view={view} actions={actions} coop={coop} />
        <GameSettings view={view} actions={actions} />
        {!coop && <TeamColumn team="red" view={view} actions={actions} coop={false} />}
      </div>

      {you.isHost ? (
        <button
          onClick={actions.start}
          className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-black tracking-wide shadow-lg hover:bg-emerald-500"
        >
          START GAME
        </button>
      ) : (
        <p className="text-center text-muted">Waiting for the host to start the game…</p>
      )}
      <p className="text-center text-xs text-muted">
        {coop
          ? "Your team needs at least one spymaster and one operative (2+ players)."
          : "Each team needs at least one spymaster and one operative (4+ players)."}
      </p>
    </div>
  );
}

function TeamColumn({
  team,
  view,
  actions,
  coop,
}: {
  team: Team;
  view: RoomView;
  actions: RoomActions;
  coop: boolean;
}) {
  const players = view.players.filter((p) => p.team === team);
  const spymasters = players.filter((p) => p.role === "spymaster");
  const operatives = players.filter((p) => p.role === "operative");
  const isBlue = team === "blue";
  const label = coop ? "YOUR TEAM" : isBlue ? "BLUE TEAM" : "RED TEAM";
  const locked = view.teamsLocked && !view.you.isHost;

  return (
    <div data-testid={`col-${team}`} className="space-y-3">
      <div
        className={clsx(
          "rounded-xl py-2 text-center text-sm font-black tracking-widest text-white shadow",
          isBlue ? "bg-agentBlue" : "bg-agentRed",
        )}
      >
        {label}
      </div>

      <RolePanel
        title="OPERATIVES"
        team={team}
        players={operatives}
        youId={view.you.id}
        locked={locked}
        onJoin={() => {
          actions.setTeam(team);
          actions.setRole("operative");
        }}
        testId={`join-${team}-operative`}
      />
      <RolePanel
        title="SPYMASTERS"
        team={team}
        players={spymasters}
        youId={view.you.id}
        locked={locked}
        onJoin={() => {
          actions.setTeam(team);
          actions.setRole("spymaster");
        }}
        testId={`join-${team}-spymaster`}
      />
    </div>
  );
}

function RolePanel({
  title,
  team,
  players,
  youId,
  locked,
  onJoin,
  testId,
}: {
  title: string;
  team: Team;
  players: PlayerView[];
  youId: string;
  locked: boolean;
  onJoin: () => void;
  testId: string;
}) {
  const isBlue = team === "blue";
  return (
    <div
      className={clsx(
        "surface-2 rounded-xl border-2 p-3",
        isBlue ? "border-agentBlue" : "border-agentRed",
      )}
    >
      <p
        className={clsx(
          "mb-2 rounded-md py-1 text-center text-xs font-bold tracking-widest text-white",
          isBlue ? "bg-agentBlue" : "bg-agentRed",
        )}
      >
        {title}
      </p>
      <ul className="mb-3 min-h-[2.5rem] space-y-1">
        {players.map((p) => (
          <PlayerChip key={p.id} p={p} youId={youId} tone={team} />
        ))}
      </ul>
      <button
        data-testid={testId}
        disabled={locked}
        onClick={onJoin}
        className={clsx(
          "w-full rounded-lg py-2 text-sm font-bold tracking-wide transition disabled:opacity-40",
          "bg-emerald-600 hover:bg-emerald-500",
        )}
      >
        JOIN TEAM
      </button>
    </div>
  );
}

function PlayerChip({
  p,
  youId,
  tone,
}: {
  p: PlayerView;
  youId: string;
  tone: Team | "neutral";
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm">
      <span
        className={clsx(
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          tone === "blue" && "bg-agentBlue text-white",
          tone === "red" && "bg-agentRed text-white",
          tone === "neutral" && "bg-slate-600 text-white",
        )}
      >
        {p.name.charAt(0).toUpperCase()}
      </span>
      <span className={clsx("truncate", p.id === youId && "font-bold")}>{p.name}</span>
      {p.isHost && <span title="Host" className="text-amber-400">👑</span>}
      <span
        className={clsx("ml-auto h-2 w-2 rounded-full", p.connected ? "bg-emerald-400" : "bg-slate-500")}
        title={p.connected ? "online" : "away"}
      />
    </li>
  );
}

function ShareRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="mb-4 flex items-center justify-center gap-2">
      <span className="rounded-lg surface-2 px-4 py-1.5 font-mono text-xl tracking-[0.35em]">{code}</span>
      <button
        onClick={copy}
        className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
      >
        {copied ? "✓ Copied" : "🔗 Copy invite link"}
      </button>
    </div>
  );
}

function GameSettings({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const isHost = view.you.isHost;
  const [timer, setTimer] = useState<number | "">(view.settings.turnSeconds ?? "");

  const variantTile = (variant: GameVariant, title: string, sub: string) => {
    const active = view.variant === variant;
    return (
      <button
        data-testid={`lobby-variant-${variant}`}
        disabled={!isHost}
        onClick={() => actions.setVariant(variant)}
        className={clsx(
          "flex-1 rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-default",
          active ? "border-emerald-500 bg-emerald-600/20" : "border-[var(--border)] surface-2 hover:brightness-110",
        )}
      >
        <span className="block text-lg font-black">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </button>
    );
  };

  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="mb-3 text-center text-lg font-bold tracking-wide">GAME SETTINGS</h2>

      <ShareRow code={view.code} />


      <div className="mb-4 grid grid-cols-3 gap-2">
        {variantTile("classic", "CLASSIC", "Words · 4+")}
        {variantTile("pictures", "PICTURES", "Images · 4+")}
        {variantTile("coop", "CO-OP", "Words · 2+")}
      </div>

      {view.variant !== "pictures" && (
        <div className="mb-4 flex items-center gap-3 rounded-xl surface-2 p-3">
          <span className="text-2xl">📚</span>
          <div className="flex-1">
            <p className="text-sm font-bold">WORD PACK</p>
            <p className="text-xs text-muted">Topic &amp; difficulty of the codenames</p>
          </div>
          <select
            disabled={!isHost}
            value={view.wordPack}
            onChange={(e) => actions.setWordPack(e.target.value)}
            className="rounded bg-[var(--surface-2)] px-2 py-1 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500 disabled:opacity-60"
          >
            {WORD_PACK_META.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.difficulty}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 rounded-xl surface-2 p-3">
        <span className="text-2xl">⏱️</span>
        <div className="flex-1">
          <p className="text-sm font-bold">TIMER</p>
          <p className="text-xs text-muted">
            {view.settings.turnSeconds ? `${view.settings.turnSeconds}s per turn` : "Off"}
          </p>
        </div>
        {isHost && (
          <input
            type="number"
            min={15}
            max={600}
            placeholder="off"
            className="w-20 rounded bg-[var(--surface-2)] px-2 py-1 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
            value={timer}
            onChange={(e) => setTimer(e.target.value === "" ? "" : Number(e.target.value))}
            onBlur={() =>
              actions.updateSettings({ turnSeconds: timer === "" ? null : Number(timer) })
            }
          />
        )}
      </div>

      {isHost && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={actions.resetTeams}
            className="rounded-lg surface-2 px-4 py-2 text-sm hover:brightness-110"
          >
            Reset teams
          </button>
          <button
            onClick={actions.randomizeTeams}
            className="rounded-lg surface-2 px-4 py-2 text-sm hover:brightness-110"
          >
            Randomize teams
          </button>
        </div>
      )}
      {!isHost && (
        <p className="text-center text-xs text-muted">Only the host can change these settings.</p>
      )}
    </div>
  );
}
