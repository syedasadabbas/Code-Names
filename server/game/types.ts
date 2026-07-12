// Pure domain types for the Codenames game engine.
// The engine is framework-agnostic and side-effect free so it can be unit-tested
// in isolation and reused by the Socket.IO layer.

export type Team = "red" | "blue";

/** Which game a room is playing. */
export type GameVariant = "classic" | "pictures" | "coop";

/** The hidden identity of a card as encoded on the spymasters' key card. */
export type CardRole = "red" | "blue" | "neutral" | "assassin";

export type GamePhase = "lobby" | "playing" | "finished";

/** Within an active turn: the spymaster gives a clue, then operatives guess. */
export type TurnPhase = "clue" | "guess";

export type WinReason = "all-agents-found" | "assassin-revealed" | "opponent-assassin";

export interface Card {
  /** The codename shown to everyone (classic variant). Empty for picture cards. */
  word: string;
  /** Public image URL for picture cards; null for word cards. */
  image: string | null;
  /** Hidden identity. Only sent to spymasters (and to everyone once revealed). */
  role: CardRole;
  /** Whether this card has been guessed/revealed. */
  revealed: boolean;
}

export interface Clue {
  word: string;
  /** Number of related cards. 0 is treated as "unlimited" guesses this turn. */
  count: number;
  /** Guesses already made against this clue this turn. */
  guessesMade: number;
}

export interface GameState {
  variant: GameVariant;
  /** Number of columns in the board grid (5 for both current variants). */
  gridCols: number;
  board: Card[];
  startingTeam: Team;
  currentTeam: Team;
  phase: GamePhase;
  turnPhase: TurnPhase;
  clue: Clue | null;
  winner: Team | null;
  winReason: WinReason | null;
  /** Monotonic counter incremented on every successful mutation (for optimistic sync). */
  version: number;
}

/** Result of attempting a guess, describing what happened for logging/animation. */
export interface GuessOutcome {
  cardIndex: number;
  word: string;
  role: CardRole;
  /** True when the revealed card belonged to the guessing team. */
  correct: boolean;
  /** True when this guess ended the team's turn. */
  turnEnded: boolean;
  /** Set when the guess ended the whole game. */
  gameEnded: boolean;
}

/** Remaining agents per team, derived from the board. */
export interface Score {
  red: { total: number; found: number; remaining: number };
  blue: { total: number; found: number; remaining: number };
}
