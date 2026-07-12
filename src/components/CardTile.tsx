"use client";

import clsx from "clsx";
import type { CardView } from "@shared/protocol";

// Word-card colours (solid fill + text).
const revealedClasses: Record<string, string> = {
  red: "bg-agentRed text-white",
  blue: "bg-agentBlue text-white",
  neutral: "bg-bystander text-stone-900",
  assassin: "bg-assassin text-white ring-2 ring-red-500",
};

// Picture-card reveal overlay (semi-transparent so the image stays visible).
const imageOverlay: Record<string, string> = {
  red: "bg-agentRed/80",
  blue: "bg-agentBlue/80",
  neutral: "bg-bystander/80",
  assassin: "bg-assassin/85",
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

// Colorblind-assistive glyphs (one distinct shape per role).
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
          : "aspect-[5/3] px-1 text-center text-xs font-bold uppercase tracking-wide sm:text-sm md:text-base",
        !isImage &&
          (revealed ? revealedClasses[role ?? "neutral"] : "bg-stone-100 text-stone-900 shadow"),
        revealed && "animate-reveal",
        !revealed && spymaster && role && `ring-4 ${spymasterRing[role]}`,
        canGuess && !revealed && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        !canGuess && !revealed && "cursor-default",
      )}
    >
      {isImage && (
        // Local asset; next/image not needed. Fills the square tile.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image!}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {isImage && revealed && (
        <div
          className={clsx(
            "absolute inset-0 flex items-center justify-center",
            imageOverlay[role ?? "neutral"],
          )}
        >
          {role === "assassin" && <span className="text-3xl">💀</span>}
        </div>
      )}

      {isImage && !revealed && spymaster && role && (
        <span
          className={clsx(
            "absolute right-1 top-1 h-3.5 w-3.5 rounded-full border border-white/70",
            spymasterDot[role],
          )}
        />
      )}

      {!isImage && <span className={clsx(revealed && "opacity-90")}>{card.word}</span>}
      {!isImage && revealed && role === "assassin" && (
        <span className="absolute right-1 top-1 text-[10px]">💀</span>
      )}

      {showSymbol && (
        <span
          className="absolute left-1 top-1 rounded bg-black/40 px-1 text-xs font-bold leading-none text-white"
          aria-hidden
        >
          {roleSymbol[role!]}
        </span>
      )}

      {showGuessHint && canGuess && !revealed && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          Guess
        </span>
      )}
    </button>
  );
}
