// Wire protocol shared between the Socket.IO server and the browser client.
// These are the only shapes that cross the network. The server's internal game
// engine types (server/game/types.ts) are intentionally NOT exposed to the client
// so that hidden card roles can be stripped per viewer.

export type Team = "red" | "blue";
export type GameVariant = "classic" | "pictures" | "coop";
export type CardRole = "red" | "blue" | "neutral" | "assassin";
export type PlayerRole = "spymaster" | "operative";
export type GamePhase = "lobby" | "playing" | "finished";
export type TurnPhase = "clue" | "guess";
export type WinReason = "all-agents-found" | "assassin-revealed" | "opponent-assassin";

export interface PlayerView {
  id: string;
  name: string;
  /** null means the player is an unassigned spectator. */
  team: Team | null;
  role: PlayerRole;
  isHost: boolean;
  connected: boolean;
}

export interface CardView {
  word: string;
  /** Public image URL for picture cards; null for word cards. */
  image: string | null;
  revealed: boolean;
  /** The role is null when it must stay hidden from this particular viewer. */
  role: CardRole | null;
}

export interface ClueView {
  word: string;
  count: number;
  guessesMade: number;
  /** Remaining guesses; null means unlimited (clue number 0). */
  guessesRemaining: number | null;
}

export interface TeamScore {
  total: number;
  found: number;
  remaining: number;
}

export interface ScoreView {
  red: TeamScore;
  blue: TeamScore;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  team: Team | null;
  text: string;
  /** Epoch milliseconds. */
  at: number;
  /** System messages (e.g. "Red gave the clue OCEAN 3") render differently. */
  system: boolean;
}

export interface RoomSettings {
  /** Per-turn timer in seconds; null disables the timer. */
  turnSeconds: number | null;
}

export interface RoomView {
  code: string;
  phase: GamePhase;
  variant: GameVariant;
  /** Board grid column count for the active variant. */
  gridCols: number;
  /** When true, only the host may move players between teams/roles. */
  teamsLocked: boolean;
  /** When true, the room can be found via Quick Match. Host can toggle it off. */
  isPublic: boolean;
  /** Selected word-pack id (word-based variants only). */
  wordPack: string;
  hostId: string;
  players: PlayerView[];
  settings: RoomSettings;
  chat: ChatMessage[];

  // Present once a game has started (phase !== "lobby").
  board: CardView[];
  startingTeam: Team | null;
  currentTeam: Team | null;
  turnPhase: TurnPhase | null;
  clue: ClueView | null;
  score: ScoreView | null;
  winner: Team | null;
  winReason: WinReason | null;
  /** Server epoch-ms deadline for the current turn, or null when no timer. */
  turnDeadline: number | null;

  // Viewer-specific.
  you: {
    id: string;
    team: Team | null;
    role: PlayerRole;
    isHost: boolean;
    /** Convenience flag: this viewer sees the key card. */
    isSpymaster: boolean;
  };
}

// --- Acknowledgement payloads --------------------------------------------

export interface Identity {
  playerId: string;
  token: string;
}

export interface CreateJoinAck {
  ok: boolean;
  error?: string;
  code?: string;
  identity?: Identity;
}

export interface SimpleAck {
  ok: boolean;
  error?: string;
}

// --- Event name maps (typed Socket.IO) -----------------------------------

export interface ClientToServerEvents {
  "room:create": (
    payload: { name: string; variant?: GameVariant; wordPack?: string; settings?: Partial<RoomSettings> },
    cb: (ack: CreateJoinAck) => void,
  ) => void;
  "room:join": (
    payload: { code: string; name: string },
    cb: (ack: CreateJoinAck) => void,
  ) => void;
  "room:rejoin": (
    payload: { code: string; playerId: string; token: string },
    cb: (ack: CreateJoinAck) => void,
  ) => void;
  "room:leave": (cb?: (ack: SimpleAck) => void) => void;

  "player:setTeam": (payload: { team: Team | null }, cb?: (ack: SimpleAck) => void) => void;
  "player:setRole": (payload: { role: PlayerRole }, cb?: (ack: SimpleAck) => void) => void;
  "player:rename": (payload: { name: string }, cb?: (ack: SimpleAck) => void) => void;

  "settings:update": (payload: Partial<RoomSettings>, cb?: (ack: SimpleAck) => void) => void;
  "room:setVariant": (payload: { variant: GameVariant }, cb?: (ack: SimpleAck) => void) => void;
  "room:setWordPack": (payload: { packId: string }, cb?: (ack: SimpleAck) => void) => void;
  "room:setPrivate": (payload: { isPrivate: boolean }, cb?: (ack: SimpleAck) => void) => void;

  "match:find": (
    payload: { name: string; variant?: GameVariant | "any" },
    cb: (ack: CreateJoinAck) => void,
  ) => void;
  "match:stats": (cb: (ack: { openRooms: number; players: number }) => void) => void;

  "teams:reset": (cb?: (ack: SimpleAck) => void) => void;
  "teams:randomize": (cb?: (ack: SimpleAck) => void) => void;
  "teams:lock": (payload: { locked: boolean }, cb?: (ack: SimpleAck) => void) => void;

  "game:start": (cb?: (ack: SimpleAck) => void) => void;
  "game:clue": (payload: { word: string; count: number }, cb?: (ack: SimpleAck) => void) => void;
  "game:guess": (payload: { cardIndex: number }, cb?: (ack: SimpleAck) => void) => void;
  "game:endTurn": (cb?: (ack: SimpleAck) => void) => void;
  "game:newGame": (cb?: (ack: SimpleAck) => void) => void;

  "chat:send": (payload: { text: string }, cb?: (ack: SimpleAck) => void) => void;
}

export interface ServerToClientEvents {
  "room:update": (view: RoomView) => void;
  "room:closed": (payload: { reason: string }) => void;
  "toast": (payload: { kind: "info" | "error" | "success"; message: string }) => void;
}

/** Client-facing metadata for the selectable word packs (words live server-side). */
export const WORD_PACK_META: { id: string; name: string; difficulty: "easy" | "medium" | "hard" }[] = [
  { id: "mixed", name: "Mixed", difficulty: "medium" },
  { id: "everyday", name: "Everyday", difficulty: "easy" },
  { id: "animals", name: "Animals", difficulty: "easy" },
  { id: "food", name: "Food & Drink", difficulty: "easy" },
  { id: "geography", name: "Geography", difficulty: "medium" },
  { id: "movies", name: "Movies & TV", difficulty: "medium" },
  { id: "sports", name: "Sports", difficulty: "medium" },
  { id: "science", name: "Science & Tech", difficulty: "hard" },
];

export const ROOM_CODE_LENGTH = 4;
export const MAX_NAME_LENGTH = 20;
export const MAX_CHAT_LENGTH = 300;
