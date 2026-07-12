"use client";

import clsx from "clsx";
import type { CardView } from "@shared/protocol";
import Icon, { type IconName } from "./Icon";

// The colored "agent tile" placed over a card when it's revealed.
const overlayBg: Record<string, string> = {
  red: "bg-agentRed text-white",
  blue: "bg-agentBlue text-white",
  neutral: "bg-bystander text-stone-900",
  assassin: "bg-assassin text-white ring-2 ring-red-500",
};

const spymasterRing: Record<string, string> = {
  red: "ring-agentRed",
  blue: "ring-agentBlue",
  neutral: "ring-stone-400",
  assassin: "ring-black",
};

const spymasterDot: Record<string, string> = {
  red: "bg-agentRed",
  blue: "bg-agentBlue",
  neutral: "bg-stone-300",
  assassin: "bg-black",
};

const roleIcon: Record<string, IconName> = {
  red: "agent",
  blue: "agent",
  neutral: "person",
  assassin: "skull",
};

// Colorblind-assistive glyphs (geometric shapes, one per role).
const roleSymbol: Record<string, string> = {
  red: "▲",
  blue: "●",
  neutral: "■",
  assassin: "✖",
};

export default function CardTile({
  card,
  index,
  canGuess,
  spymaster,
  colorblind = false,
  showGuessHint = false,
  onGuess,
}: {
  card: CardView;
  index: number;
  canGuess: boolean;
  spymaster: boolean;
  colorblind?: boolean;
  showGuessHint?: boolean;
  onGuess: () => void;
}) {
  const revealed = card.revealed;
  const role = card.role;
  const isImage = !!card.image;
  const showSymbol = colorblind && !!role && (revealed || spymaster);

  return (
    <button
      type="button"
      disabled={!canGuess || revealed}
      onClick={onGuess}
      aria-label={`${isImage ? `picture card ${index + 1}` : card.word}${
        revealed ? ` (revealed ${role})` : ""
      }`}
      data-testid="card"
      data-index={index}
      data-role={role ?? ""}
      data-revealed={revealed ? "true" : "false"}
      className={clsx(
        "relative flex items-center justify-center overflow-hidden rounded-lg transition select-none",
        isImage
          ? "aspect-square bg-stone-800"
          : "aspect-[5/3] bg-stone-100 px-0.5 text-center text-[9px] font-bold uppercase leading-tight tracking-tight text-stone-900 shadow sm:px-1 sm:text-sm sm:tracking-wide md:text-base",
        !revealed && spymaster && role && `ring-4 ${spymasterRing[role]}`,
        canGuess && !revealed && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        !canGuess && !revealed && "cursor-default",
      )}
    >
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image!} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {!isImage && !revealed && <span className="break-words">{card.word}</span>}

      {/* Spymaster key hint on an unrevealed picture card */}
      {isImage && !revealed && spymaster && role && (
        <span
          className={clsx(
            "absolute right-1 top-1 h-3.5 w-3.5 rounded-full border border-white/70",
            spymasterDot[role],
          )}
        />
      )}

      {/* Revealed: the agent tile "flies in" and is placed on the card */}
      {revealed && role && (
        <div
          className={clsx(
            "animate-agent absolute inset-0 flex flex-col items-center justify-center gap-1",
            overlayBg[role],
          )}
        >
          <Icon name={roleIcon[role]} size={isImage ? 28 : 22} className="opacity-90" />
          {!isImage && (
            <span className="break-words px-0.5 text-center text-[9px] font-bold uppercase leading-tight sm:text-xs">
              {card.word}
            </span>
          )}
        </div>
      )}

      {showSymbol && (
        <span
          className="absolute left-1 top-1 z-10 rounded bg-black/40 px-1 text-xs font-bold leading-none text-white"
          aria-hidden
        >
          {roleSymbol[role!]}
        </span>
      )}

      {showGuessHint && canGuess && !revealed && (
        <span className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          Guess
        </span>
      )}
    </button>
  );
}
