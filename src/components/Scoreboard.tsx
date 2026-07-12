"use client";

import clsx from "clsx";
import type { RoomView } from "@shared/protocol";

export default function Scoreboard({ view }: { view: RoomView }) {
  const score = view.score;
  if (!score) return null;

  if (view.variant === "coop") {
    return (
      <div className="flex items-center justify-center gap-4">
        <TeamPill label="YOUR AGENTS" remaining={score.blue.remaining} active color="blue" />
        <div className="text-muted">vs</div>
        <TeamPill label="ENEMY" remaining={score.red.remaining} active={false} color="red" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <TeamPill
        label="RED"
        remaining={score.red.remaining}
        active={view.currentTeam === "red"}
        color="red"
      />
      <div className="text-muted">vs</div>
      <TeamPill
        label="BLUE"
        remaining={score.blue.remaining}
        active={view.currentTeam === "blue"}
        color="blue"
      />
    </div>
  );
}

function TeamPill({
  label,
  remaining,
  active,
  color,
}: {
  label: string;
  remaining: number;
  active: boolean;
  color: "red" | "blue";
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-lg px-4 py-2 font-bold",
        color === "red" ? "bg-agentRed/20 text-red-300" : "bg-agentBlue/20 text-sky-300",
        active && "ring-2",
        active && color === "red" && "ring-agentRed",
        active && color === "blue" && "ring-agentBlue",
      )}
    >
      <span>{label}</span>
      <span className="text-2xl tabular-nums">{remaining}</span>
    </div>
  );
}
