"use client";

import { useState } from "react";
import clsx from "clsx";
import type { RoomView, Team } from "@shared/protocol";
import type { RoomActions } from "@/hooks/useRoom";
import { usePrefs, setPref } from "@/lib/prefs";
import Modal from "./Modal";
import Icon from "./Icon";

type Tab = "admin" | "player" | "preferences" | "accessibility";

export default function SettingsModal({
  view,
  actions,
  onClose,
  onLeave,
  initialTab = "player",
}: {
  view: RoomView;
  actions: RoomActions;
  onClose: () => void;
  onLeave: () => void;
  initialTab?: Tab;
}) {
  const isHost = view.you.isHost;
  const [tab, setTab] = useState<Tab>(initialTab === "admin" && !isHost ? "player" : initialTab);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "admin", label: "Admin", show: isHost },
    { id: "player", label: "Player", show: true },
    { id: "preferences", label: "Preferences", show: true },
    { id: "accessibility", label: "Accessibility", show: true },
  ];

  return (
    <Modal onClose={onClose} labelledBy="settings-title">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl surface-2 p-1">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  tab === t.id ? "bg-emerald-600 text-white" : "text-muted hover:opacity-80",
                )}
              >
                {t.label}
              </button>
            ))}
        </div>
        <button onClick={onClose} aria-label="Close" className="text-muted hover:opacity-80">
          ✕
        </button>
      </div>

      <h2 id="settings-title" className="sr-only">
        Settings
      </h2>

      {tab === "admin" && <AdminTab view={view} actions={actions} />}
      {tab === "player" && <PlayerTab view={view} actions={actions} onLeave={onLeave} />}
      {tab === "preferences" && <PreferencesTab />}
      {tab === "accessibility" && <AccessibilityTab />}
    </Modal>
  );
}

// --- small controls -------------------------------------------------------

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={clsx(
        "relative h-6 w-11 rounded-full transition",
        on ? "bg-emerald-500" : "bg-slate-600",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

// --- tabs -----------------------------------------------------------------

function AdminTab({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const inGame = view.phase === "playing";
  return (
    <div className="space-y-4">
      <div className="surface-2 rounded-xl p-4">
        <p className="mb-2 text-center font-semibold">Players in the room</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {view.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm"
            >
              <span
                className={clsx(
                  "h-2 w-2 rounded-full",
                  p.team === "red" && "bg-agentRed",
                  p.team === "blue" && "bg-agentBlue",
                  p.team === null && "bg-slate-500",
                )}
              />
              {p.name}
              {p.isHost && (
                <span className="text-amber-400">
                  <Icon name="crown" size={13} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Row label="Lock teams">
        <Toggle on={view.teamsLocked} onChange={(v) => actions.lockTeams(v)} />
      </Row>
      <div className="flex justify-center gap-2">
        <button
          disabled={inGame}
          onClick={actions.resetTeams}
          className="rounded-lg surface-2 px-4 py-2 text-sm hover:brightness-110 disabled:opacity-40"
        >
          Reset teams
        </button>
        <button
          disabled={inGame}
          onClick={actions.randomizeTeams}
          className="rounded-lg surface-2 px-4 py-2 text-sm hover:brightness-110 disabled:opacity-40"
        >
          Randomize teams
        </button>
      </div>
      {inGame && (
        <button
          onClick={actions.returnToLobby}
          className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold hover:bg-amber-500"
        >
          End game &amp; return to lobby
        </button>
      )}
    </div>
  );
}

function PlayerTab({
  view,
  actions,
  onLeave,
}: {
  view: RoomView;
  actions: RoomActions;
  onLeave: () => void;
}) {
  const [name, setName] = useState(view.players.find((p) => p.id === view.you.id)?.name ?? "");
  const inGame = view.phase === "playing";

  const assign = (team: Team | null, role: "operative" | "spymaster") => {
    actions.setTeam(team);
    if (team !== null) actions.setRole(role);
  };

  const roleBtn = (label: string, team: Team, role: "operative" | "spymaster", color: "blue" | "red") => (
    <button
      disabled={inGame}
      onClick={() => assign(team, role)}
      className={clsx(
        "rounded-lg py-2 text-sm font-semibold text-white transition disabled:opacity-40",
        color === "blue" ? "bg-agentBlue hover:brightness-110" : "bg-agentRed hover:brightness-110",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted">Nickname</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded bg-[var(--surface-2)] px-3 py-2 outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && actions.rename(name.trim())}
          />
          <button
            onClick={() => name.trim() && actions.rename(name.trim())}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500"
          >
            Save
          </button>
        </div>
      </div>

      <div className="surface-2 rounded-xl p-4">
        <p className="mb-3 text-center font-semibold">Assign role</p>
        <div className="grid grid-cols-2 gap-2">
          {roleBtn("Blue operatives", "blue", "operative", "blue")}
          {roleBtn("Red operatives", "red", "operative", "red")}
          {roleBtn("Blue spymasters", "blue", "spymaster", "blue")}
          {roleBtn("Red spymasters", "red", "spymaster", "red")}
        </div>
        <button
          disabled={inGame}
          onClick={() => assign(null, "operative")}
          className="mt-2 w-full rounded-lg surface px-3 py-2 text-sm hover:brightness-110 disabled:opacity-40"
        >
          Spectators
        </button>
        {inGame && <p className="mt-2 text-center text-xs text-muted">Roles are locked during a game.</p>}
      </div>

      <button
        onClick={onLeave}
        className="mx-auto block rounded-full bg-red-600 px-6 py-2 font-semibold text-white hover:bg-red-500"
      >
        Leave match
      </button>
    </div>
  );
}

function PreferencesTab() {
  const prefs = usePrefs();
  return (
    <div className="space-y-3">
      <Row label="Dark mode">
        <div className="flex gap-1 rounded-lg surface-2 p-1">
          {(["on", "off", "system"] as const).map((m) => {
            const value = m === "on" ? "dark" : m === "off" ? "light" : "system";
            const active = prefs.theme === value;
            return (
              <button
                key={m}
                onClick={() => setPref("theme", value)}
                className={clsx(
                  "rounded-md px-3 py-1 text-sm font-semibold capitalize",
                  active ? "bg-emerald-600 text-white" : "text-muted",
                )}
              >
                {m === "on" ? "On" : m === "off" ? "Off" : "System"}
              </button>
            );
          })}
        </div>
      </Row>

      <div className="surface-2 rounded-xl p-4">
        <p className="mb-2 text-center font-semibold">Sounds</p>
        <Row label="Sound effects">
          <Toggle on={prefs.soundEnabled} onChange={(v) => setPref("soundEnabled", v)} />
        </Row>
        <Row label="Effects volume">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.effectsVolume * 100)}
            onChange={(e) => setPref("effectsVolume", Number(e.target.value) / 100)}
            className="w-40"
          />
        </Row>
      </div>

      <Row label="Always show card guess button">
        <Toggle on={prefs.alwaysShowGuess} onChange={(v) => setPref("alwaysShowGuess", v)} />
      </Row>
    </div>
  );
}

function AccessibilityTab() {
  const prefs = usePrefs();
  return (
    <div className="space-y-3">
      <Row label="Text size">
        <div className="flex gap-1">
          {(["sm", "md", "lg"] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setPref("textSize", s)}
              className={clsx(
                "rounded-lg border px-3 py-1 font-bold",
                prefs.textSize === s ? "border-emerald-500 bg-emerald-600/20" : "border-[var(--border)]",
              )}
              style={{ fontSize: `${0.85 + i * 0.15}rem` }}
            >
              A
            </button>
          ))}
        </div>
      </Row>
      <Row label="Show colorblind assistive symbols on cards">
        <Toggle on={prefs.colorblind} onChange={(v) => setPref("colorblind", v)} />
      </Row>
      <div className="surface-2 rounded-xl p-4">
        <p className="mb-2 text-center font-semibold">Reduced motion</p>
        <Row label="Follow system setting">
          <Toggle
            on={prefs.reducedMotion === "system"}
            onChange={(v) => setPref("reducedMotion", v ? "system" : "off")}
          />
        </Row>
        {prefs.reducedMotion !== "system" && (
          <Row label="Disable gameplay animations">
            <Toggle
              on={prefs.reducedMotion === "on"}
              onChange={(v) => setPref("reducedMotion", v ? "on" : "off")}
            />
          </Row>
        )}
      </div>
    </div>
  );
}
