"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { getIdentity, setIdentity, getPreferredName } from "@/lib/authClient";
import { playSound, primeAudio } from "@/lib/sound";
import type {
  CreateJoinAck,
  GameVariant,
  PlayerRole,
  RoomView,
  RoomSettings,
  SimpleAck,
  Team,
} from "@shared/protocol";

export type RoomPhase = "connecting" | "need-join" | "joining" | "joined" | "error";

export interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  message: string;
}

export interface RoomActions {
  join: (name: string) => void;
  leave: () => void;
  setTeam: (team: Team | null) => void;
  setRole: (role: PlayerRole) => void;
  rename: (name: string) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  setVariant: (variant: GameVariant) => void;
  setWordPack: (packId: string) => void;
  resetTeams: () => void;
  randomizeTeams: () => void;
  lockTeams: (locked: boolean) => void;
  start: () => void;
  giveClue: (word: string, count: number) => void;
  guess: (cardIndex: number) => void;
  endTurn: () => void;
  returnToLobby: () => void;
  sendChat: (text: string) => void;
}

/** Detect notable transitions between two room views and play matching sounds. */
function playEventSounds(prev: RoomView, next: RoomView): void {
  const myTeam = next.you.team;

  // Card reveals.
  let revealHappened = false;
  let assassinRevealed = false;
  const revealedRoles: string[] = [];
  for (let i = 0; i < next.board.length; i++) {
    const before = prev.board[i];
    const after = next.board[i];
    if (after?.revealed && !before?.revealed) {
      revealHappened = true;
      if (after.role) revealedRoles.push(after.role);
      if (after.role === "assassin") assassinRevealed = true;
    }
  }
  if (assassinRevealed) {
    playSound("assassin");
  } else if (revealedRoles.length > 0) {
    // The guessing team was prev.currentTeam.
    const role = revealedRoles[0];
    if (role === prev.currentTeam) playSound("correct");
    else if (role === "neutral") playSound("neutral");
    else playSound("wrong");
  }

  // Clue given.
  if (prev.turnPhase === "clue" && next.turnPhase === "guess" && next.clue && !prev.clue) {
    playSound("clue");
  }

  // Turn change (only when it wasn't caused by a reveal we already sounded).
  if (
    next.phase === "playing" &&
    prev.currentTeam &&
    next.currentTeam &&
    prev.currentTeam !== next.currentTeam &&
    !revealHappened
  ) {
    playSound("turn");
  }

  // Game finished.
  if (prev.phase !== "finished" && next.phase === "finished") {
    if (next.winner && next.winner === myTeam) playSound("win");
    else playSound("lose");
  }

  // New chat message from someone else.
  if (next.chat.length > prev.chat.length) {
    const fresh = next.chat.slice(prev.chat.length);
    if (fresh.some((m) => !m.system && m.authorId !== next.you.id)) {
      playSound("message");
    }
  }
}

export function useRoom(code: string) {
  const [view, setView] = useState<RoomView | null>(null);
  const [phase, setPhase] = useState<RoomPhase>("connecting");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const prevView = useRef<RoomView | null>(null);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const tryRejoin = () => {
      const id = getIdentity(code);
      if (!id) {
        setPhase("need-join");
        return;
      }
      setPhase("joining");
      socket.emit(
        "room:rejoin",
        { code, playerId: id.playerId, token: id.token },
        (ack: CreateJoinAck) => {
          if (ack.ok) setPhase("joined");
          else setPhase("need-join");
        },
      );
    };

    const onConnect = () => {
      setConnected(true);
      tryRejoin();
    };
    const onDisconnect = () => setConnected(false);
    const onUpdate = (v: RoomView) => {
      const prev = prevView.current;
      if (prev && prev.code === v.code) {
        try {
          playEventSounds(prev, v);
        } catch {
          /* sound is best-effort */
        }
      }
      prevView.current = v;
      setView(v);
      setPhase("joined");
    };
    const onClosed = (p: { reason: string }) => {
      setError(p.reason || "The room was closed.");
      setPhase("error");
    };
    const onToast = (p: { kind: Toast["kind"]; message: string }) => pushToast(p.kind, p.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:update", onUpdate);
    socket.on("room:closed", onClosed);
    socket.on("toast", onToast);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:update", onUpdate);
      socket.off("room:closed", onClosed);
      socket.off("toast", onToast);
    };
  }, [code, pushToast]);

  const ack = useCallback(
    (a?: SimpleAck) => {
      if (a && !a.ok && a.error) pushToast("error", a.error);
    },
    [pushToast],
  );

  const actions: RoomActions = {
    join: (name: string) => {
      const socket = getSocket();
      setPhase("joining");
      socket.emit(
        "room:join",
        { code, name: name || getPreferredName() || "Anonymous" },
        (a: CreateJoinAck) => {
          if (a.ok && a.identity && a.code) {
            setIdentity(a.code, a.identity);
            setPhase("joined");
          } else {
            setError(a.error || "Could not join the room.");
            setPhase("error");
          }
        },
      );
    },
    leave: () => getSocket().emit("room:leave"),
    setTeam: (team) => {
      primeAudio();
      getSocket().emit("player:setTeam", { team }, ack);
    },
    setRole: (role) => getSocket().emit("player:setRole", { role }, ack),
    rename: (name) => getSocket().emit("player:rename", { name }, ack),
    updateSettings: (settings) => getSocket().emit("settings:update", settings, ack),
    setVariant: (variant) => getSocket().emit("room:setVariant", { variant }, ack),
    setWordPack: (packId) => getSocket().emit("room:setWordPack", { packId }, ack),
    resetTeams: () => getSocket().emit("teams:reset", ack),
    randomizeTeams: () => getSocket().emit("teams:randomize", ack),
    lockTeams: (locked) => getSocket().emit("teams:lock", { locked }, ack),
    start: () => {
      primeAudio();
      getSocket().emit("game:start", ack);
    },
    giveClue: (word, count) => {
      primeAudio();
      getSocket().emit("game:clue", { word, count }, ack);
    },
    guess: (cardIndex) => {
      primeAudio();
      playSound("select");
      getSocket().emit("game:guess", { cardIndex }, ack);
    },
    endTurn: () => getSocket().emit("game:endTurn", ack),
    returnToLobby: () => getSocket().emit("game:newGame", ack),
    sendChat: (text) => getSocket().emit("chat:send", { text }, ack),
  };

  return { view, phase, connected, error, toasts, actions };
}
