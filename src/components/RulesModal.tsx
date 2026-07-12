"use client";

import { useState } from "react";
import clsx from "clsx";
import type { GameVariant } from "@shared/protocol";
import Modal from "./Modal";

const SECTIONS = [
  {
    title: "Setup and roles",
    body: [
      "Players split into two teams: Blue and Red.",
      "Each team has at least one Spymaster and one Operative.",
      "Classic shows a 5×5 grid of 25 codename cards; Pictures shows a 5×4 grid of 20 picture cards.",
    ],
  },
  {
    title: "Spymasters — giving clues",
    body: [
      "Only the spymasters see the key card (who each card belongs to).",
      "On your turn, give a one-word clue and a number.",
      "The clue relates to cards your team should guess; the number says how many.",
    ],
  },
  {
    title: "Valid clues",
    body: [
      "The clue must be a single word.",
      "It cannot be, contain, or be contained by a word currently on the board.",
    ],
  },
  {
    title: "Special clue numbers",
    body: [
      "0 (∞) means unlimited guesses this turn.",
      "Otherwise, operatives may make exactly that many guesses.",
    ],
  },
  {
    title: "Operatives — guessing & end of turn",
    body: [
      "Tap a card to reveal who it belongs to.",
      "Correct (your agent): keep guessing, or end the turn.",
      "Bystander or enemy agent: your turn ends immediately.",
      "You must make at least one guess before ending your turn.",
    ],
  },
  {
    title: "Winning and losing",
    body: [
      "First team to reveal all their agents wins.",
      "Reveal the assassin and your team loses instantly.",
    ],
  },
];

export default function RulesModal({ onClose, variant }: { onClose: () => void; variant: GameVariant }) {
  const [open, setOpen] = useState(0);
  return (
    <Modal onClose={onClose} labelledBy="rules-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="rules-title" className="text-xl font-bold">
          How to play — {variant === "pictures" ? "Codenames: Pictures" : "Codenames"}
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-muted hover:opacity-80">
          ✕
        </button>
      </div>
      <p className="mb-4 text-sm text-muted">
        A game of word association and teamwork for two teams — <span className="text-sky-400">Blue</span> and{" "}
        <span className="text-red-400">Red</span>. Guess your own cards before the other team, and never touch
        the assassin.
      </p>
      <div className="space-y-2">
        {SECTIONS.map((s, i) => (
          <div key={s.title} className="surface-2 rounded-lg">
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold"
            >
              {s.title}
              <span className={clsx("transition", open === i && "rotate-90")}>›</span>
            </button>
            {open === i && (
              <ul className="list-disc space-y-1 px-8 pb-4 text-sm text-muted">
                {s.body.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
