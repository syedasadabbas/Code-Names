"use client";

import type { RoomView } from "@shared/protocol";
import type { RoomActions } from "@/hooks/useRoom";
import { usePrefs } from "@/lib/prefs";
import CardTile from "./CardTile";

export default function GameBoard({
  view,
  actions,
}: {
  view: RoomView;
  actions: RoomActions;
}) {
  const prefs = usePrefs();
  const you = view.you;
  const canGuessNow =
    view.phase === "playing" &&
    view.turnPhase === "guess" &&
    you.role === "operative" &&
    you.team !== null &&
    you.team === view.currentTeam;

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {view.board.map((card, i) => (
        <CardTile
          key={i}
          card={card}
          index={i}
          spymaster={you.isSpymaster}
          canGuess={canGuessNow}
          colorblind={prefs.colorblind}
          showGuessHint={prefs.alwaysShowGuess}
          onGuess={() => actions.guess(i)}
        />
      ))}
    </div>
  );
}
