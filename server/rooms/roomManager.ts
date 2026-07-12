// In-memory room registry and per-viewer state serialization.
// Rooms live only in process memory (local-first). Completed games are the only
// thing persisted (see server/db). Uses relative imports because the server is
// executed with tsx, which does not resolve tsconfig path aliases.

import { customAlphabet } from "nanoid";
import type { GameState } from "../game/types.js";
import { getScore, maxGuessesFor, VARIANTS } from "../game/engine.js";
import type {
  CardRole,
  CardView,
  ChatMessage,
  ClueView,
  GameVariant,
  PlayerRole,
  PlayerView,
  RoomSettings,
  RoomView,
  Team,
} from "../../shared/protocol.js";

// Room codes: unambiguous uppercase alphabet (no O/0, I/1, etc.).
const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = customAlphabet(codeAlphabet, 4);
const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

export interface Player {
  id: string;
  /** Secret used by the client to reclaim this identity on reconnect. */
  token: string;
  name: string;
  team: Team | null;
  role: PlayerRole;
  connected: boolean;
  socketId: string | null;
  lastSeen: number;
  /** Set for registered accounts; null for guests. */
  userId: string | null;
}

export interface Room {
  code: string;
  variant: GameVariant;
  wordPack: string;
  teamsLocked: boolean;
  hostId: string;
  players: Map<string, Player>;
  /** Insertion order for stable rendering. */
  order: string[];
  game: GameState | null;
  settings: RoomSettings;
  chat: ChatMessage[];
  createdAt: number;
  /** Server epoch-ms deadline for the current turn, or null. */
  turnDeadline: number | null;
  turnTimer: NodeJS.Timeout | null;
  /** Guards against persisting the same finished game twice. */
  recorded: boolean;
}

const DEFAULT_SETTINGS: RoomSettings = { turnSeconds: null };

export class RoomManager {
  private rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  createRoom(host: {
    name: string;
    userId: string | null;
    variant?: GameVariant;
    wordPack?: string;
    settings?: Partial<RoomSettings>;
  }): { room: Room; player: Player } {
    let code = makeCode();
    while (this.rooms.has(code)) code = makeCode();

    const validVariant: GameVariant =
      host.variant === "pictures" ? "pictures" : host.variant === "coop" ? "coop" : "classic";
    const player = this.makePlayer(host.name, host.userId);
    const room: Room = {
      code,
      variant: validVariant,
      wordPack: host.wordPack || "mixed",
      teamsLocked: false,
      hostId: player.id,
      players: new Map([[player.id, player]]),
      order: [player.id],
      game: null,
      settings: { ...DEFAULT_SETTINGS, ...host.settings },
      chat: [],
      createdAt: Date.now(),
      turnDeadline: null,
      turnTimer: null,
      recorded: false,
    };
    this.rooms.set(code, room);
    return { room, player };
  }

  makePlayer(name: string, userId: string | null): Player {
    return {
      id: makeId(),
      token: makeId() + makeId(),
      name: sanitizeName(name),
      team: null,
      role: "operative",
      connected: true,
      socketId: null,
      lastSeen: Date.now(),
      userId,
    };
  }

  addPlayer(room: Room, name: string, userId: string | null): Player {
    const player = this.makePlayer(name, userId);
    room.players.set(player.id, player);
    room.order.push(player.id);
    return player;
  }

  removePlayer(room: Room, playerId: string): void {
    room.players.delete(playerId);
    room.order = room.order.filter((id) => id !== playerId);
    if (room.hostId === playerId) {
      // Promote the next connected player (or anyone) to host.
      const next = room.order.find((id) => room.players.get(id)?.connected) ?? room.order[0];
      if (next) room.hostId = next;
    }
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room?.turnTimer) clearTimeout(room.turnTimer);
    this.rooms.delete(code.toUpperCase());
  }

  addChat(room: Room, msg: Omit<ChatMessage, "id" | "at">): ChatMessage {
    const full: ChatMessage = { ...msg, id: makeId(), at: Date.now() };
    room.chat.push(full);
    // Keep chat bounded to avoid unbounded memory growth.
    if (room.chat.length > 200) room.chat.splice(0, room.chat.length - 200);
    return full;
  }

  /** Number of players currently connected. */
  connectedCount(room: Room): number {
    let n = 0;
    for (const p of room.players.values()) if (p.connected) n++;
    return n;
  }

  allRooms(): Room[] {
    return [...this.rooms.values()];
  }
}

// -------------------------------------------------------------------------
// View serialization (per viewer)
// -------------------------------------------------------------------------

function sanitizeName(name: string): string {
  const trimmed = (name || "").trim().replace(/\s+/g, " ");
  const cleaned = trimmed.slice(0, 20);
  return cleaned.length > 0 ? cleaned : "Anonymous";
}
export { sanitizeName };

function isSpymasterOf(player: Player | undefined): boolean {
  return !!player && player.role === "spymaster" && player.team !== null;
}

function toClueView(game: GameState): ClueView | null {
  if (!game.clue) return null;
  const max = maxGuessesFor(game.clue.count);
  const remaining = max === Number.POSITIVE_INFINITY ? null : max - game.clue.guessesMade;
  return {
    word: game.clue.word,
    count: game.clue.count,
    guessesMade: game.clue.guessesMade,
    guessesRemaining: remaining,
  };
}

/**
 * Build the RoomView for one specific viewer. Card roles are only included when
 * the card is revealed OR the viewer is a spymaster (who holds the key card) OR
 * the game has finished.
 */
export function buildRoomView(room: Room, viewerId: string): RoomView {
  const viewer = room.players.get(viewerId);
  const seesKey = isSpymasterOf(viewer) || room.game?.phase === "finished";

  const players: PlayerView[] = room.order
    .map((id) => room.players.get(id))
    .filter((p): p is Player => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      isHost: p.id === room.hostId,
      connected: p.connected,
    }));

  const game = room.game;
  const board: CardView[] = game
    ? game.board.map((c) => ({
        word: c.word,
        image: c.image,
        revealed: c.revealed,
        role: (c.revealed || seesKey ? c.role : null) as CardRole | null,
      }))
    : [];

  const variant = game?.variant ?? room.variant;

  return {
    code: room.code,
    phase: game ? game.phase : "lobby",
    variant,
    gridCols: game?.gridCols ?? VARIANTS[variant].gridCols,
    teamsLocked: room.teamsLocked,
    wordPack: room.wordPack,
    hostId: room.hostId,
    players,
    settings: room.settings,
    chat: room.chat,
    board,
    startingTeam: game?.startingTeam ?? null,
    currentTeam: game?.currentTeam ?? null,
    turnPhase: game?.turnPhase ?? null,
    clue: game ? toClueView(game) : null,
    score: game ? getScore(game) : null,
    winner: game?.winner ?? null,
    winReason: game?.winReason ?? null,
    turnDeadline: room.turnDeadline,
    you: {
      id: viewerId,
      team: viewer?.team ?? null,
      role: viewer?.role ?? "operative",
      isHost: viewerId === room.hostId,
      isSpymaster: isSpymasterOf(viewer),
    },
  };
}
