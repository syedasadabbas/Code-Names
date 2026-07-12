"use client";

import { useState } from "react";
import clsx from "clsx";
import type { RoomView } from "@shared/protocol";
import type { RoomActions } from "@/hooks/useRoom";
import TurnTimer from "./TurnTimer";

export default function CluePanel({
  view,
  actions,
}: {
  view: RoomView;
  actions: RoomActions;
}) {
  const [word, setWord] = useState("");
  const [count, setCount] = useState(1);

  const you = view.you;
  const myTurn = you.team === view.currentTeam;
  const isCurrentSpymaster = you.isSpymaster && myTurn;
  const isCurrentOperative = myTurn && you.role === "operative" && you.team !== null;

  const teamColor = view.currentTeam === "red" ? "text-red-300" : "text-sky-300";

  function submitClue() {
    if (!word.trim()) return;
    actions.giveClue(word.trim(), count);
    setWord("");
    setCount(1);
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className={clsx("text-sm font-bold uppercase", teamColor)}>
          {view.currentTeam} team&apos;s turn
        </div>
        <TurnTimer deadline={view.turnDeadline} />
      </div>

      {view.turnPhase === "clue" && (
        <>
          {isCurrentSpymaster ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Give a one-word clue and how many cards it points to.
              </p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="flex-1 rounded bg-slate-900 px-3 py-2 uppercase tracking-wide outline-none ring-1 ring-slate-700 focus:ring-sky-500"
                  placeholder="CLUE"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitClue()}
                />
                <select
                  className="rounded bg-slate-900 px-2 py-2 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "∞" : n}
                    </option>
                  ))}
                </select>
                <button
                  onClick={submitClue}
                  className="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500"
                >
                  Give clue
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-300">
              Waiting for the <span className={teamColor}>{view.currentTeam}</span> spymaster to
              give a clue…
            </p>
          )}
        </>
      )}

      {view.turnPhase === "guess" && view.clue && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-center gap-3 rounded-lg bg-slate-900 py-4">
            <span className="text-3xl font-black uppercase tracking-wider">{view.clue.word}</span>
            <span className="text-3xl font-black text-amber-400">
              {view.clue.count === 0 ? "∞" : view.clue.count}
            </span>
          </div>
          <p className="text-center text-sm text-slate-400">
            Guesses remaining:{" "}
            <span className="font-semibold text-white">
              {view.clue.guessesRemaining === null ? "unlimited" : view.clue.guessesRemaining}
            </span>
          </p>
          {isCurrentOperative ? (
            <button
              onClick={actions.endTurn}
              disabled={view.clue.guessesMade < 1}
              className="w-full rounded bg-slate-700 py-2 font-semibold hover:bg-slate-600 disabled:opacity-40"
            >
              {view.clue.guessesMade < 1 ? "Make at least one guess" : "End turn"}
            </button>
          ) : (
            <p className="text-center text-slate-300">
              Waiting for the <span className={teamColor}>{view.currentTeam}</span> operatives to
              guess…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
