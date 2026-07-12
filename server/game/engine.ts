// Pure Codenames game engine.
//
// All functions are side-effect free: they take the current state (and inputs)
// and return a new state plus a result. This keeps the rules fully unit-testable
// and independent of the network/persistence layers.

import type {
  Card,
  CardRole,
  GameState,
  GameVariant,
  GuessOutcome,
  Score,
  Team,
} from "./types.js";
import { DEFAULT_WORDS } from "./words.js";
import { picturePath, pictureIds } from "./pictures.js";

// Classic (Codenames) board constants — kept as named exports for tests/consumers.
export const BOARD_SIZE = 25;
export const STARTING_TEAM_AGENTS = 9;
export const SECOND_TEAM_AGENTS = 8;
export const ASSASSIN_COUNT = 1;
export const NEUTRAL_COUNT =
  BOARD_SIZE - STARTING_TEAM_AGENTS - SECOND_TEAM_AGENTS - ASSASSIN_COUNT; // 7
export const MAX_CLUE_COUNT = 9;

// Per-variant board configuration.
export interface VariantConfig {
  /** Card content: single words or picture images. */
  kind: "word" | "image";
  boardSize: number;
  startingAgents: number;
  secondAgents: number;
  neutral: number;
  assassin: number;
  gridCols: number;
}

export const VARIANTS: Record<GameVariant, VariantConfig> = {
  // Classic Codenames: 5×5, 9/8 agents, 7 bystanders, 1 assassin.
  classic: {
    kind: "word",
    boardSize: 25,
    startingAgents: 9,
    secondAgents: 8,
    neutral: 7,
    assassin: 1,
    gridCols: 5,
  },
  // Codenames: Pictures: 5×4, 8/7 agents, 4 bystanders, 1 assassin.
  pictures: {
    kind: "image",
    boardSize: 20,
    startingAgents: 8,
    secondAgents: 7,
    neutral: 4,
    assassin: 1,
    gridCols: 5,
  },
  // Cooperative (base-game "fewer players" variant): your team (blue) plays
  // against a simulated opponent (red). Same 5×5 / 9-8-7-1 layout as classic.
  coop: {
    kind: "word",
    boardSize: 25,
    startingAgents: 9,
    secondAgents: 8,
    neutral: 7,
    assassin: 1,
    gridCols: 5,
  },
};

/** In co-op, the human team is always blue; red is the simulated opponent. */
export const COOP_HUMAN_TEAM: Team = "blue";
export const COOP_ENEMY_TEAM: Team = "red";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) so boards can be reproduced in tests.
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle returning a new array; does not mutate the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const otherTeam = (team: Team): Team => (team === "red" ? "blue" : "red");

// ---------------------------------------------------------------------------
// Board / game creation
// ---------------------------------------------------------------------------

export interface CreateGameOptions {
  variant?: GameVariant;
  words?: string[];
  seed?: number;
  /** Force which team starts (otherwise decided by the RNG). */
  startingTeam?: Team;
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const variant: GameVariant = options.variant ?? "classic";
  const cfg = VARIANTS[variant];
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);

  // Build the card content (words or images) for this variant.
  let contents: Array<{ word: string; image: string | null }>;
  if (cfg.kind === "word") {
    const pool =
      options.words && options.words.length >= cfg.boardSize
        ? options.words
        : DEFAULT_WORDS;
    contents = shuffle(pool, rng)
      .slice(0, cfg.boardSize)
      .map((word) => ({ word, image: null }));
  } else {
    contents = shuffle(pictureIds(), rng)
      .slice(0, cfg.boardSize)
      .map((id) => ({ word: "", image: picturePath(id) }));
  }

  // In co-op the human team (blue) always starts and gets the extra agent.
  const startingTeam: Team =
    variant === "coop"
      ? COOP_HUMAN_TEAM
      : options.startingTeam ?? (rng() < 0.5 ? "red" : "blue");
  const second = otherTeam(startingTeam);

  const roles: CardRole[] = [
    ...Array<CardRole>(cfg.startingAgents).fill(startingTeam),
    ...Array<CardRole>(cfg.secondAgents).fill(second),
    ...Array<CardRole>(cfg.neutral).fill("neutral"),
    ...Array<CardRole>(cfg.assassin).fill("assassin"),
  ];
  const shuffledRoles = shuffle(roles, rng);

  const board: Card[] = contents.map((content, i) => ({
    word: content.word,
    image: content.image,
    role: shuffledRoles[i],
    revealed: false,
  }));

  return {
    variant,
    gridCols: cfg.gridCols,
    board,
    startingTeam,
    currentTeam: startingTeam,
    phase: "playing",
    turnPhase: "clue",
    clue: null,
    winner: null,
    winReason: null,
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function getScore(state: GameState): Score {
  const count = (team: Team) => {
    const cards = state.board.filter((c) => c.role === team);
    const found = cards.filter((c) => c.revealed).length;
    return { total: cards.length, found, remaining: cards.length - found };
  };
  return { red: count("red"), blue: count("blue") };
}

/** Maximum guesses allowed for the current clue: exactly the clue number
 * (no bonus guess). A clue number of 0 still means unlimited guesses. */
export function maxGuessesFor(count: number): number {
  return count === 0 ? Number.POSITIVE_INFINITY : count;
}

// ---------------------------------------------------------------------------
// Clue validation
// ---------------------------------------------------------------------------

export interface ClueValidation {
  ok: boolean;
  error?: string;
}

export function validateClue(
  state: GameState,
  word: string,
  count: number,
): ClueValidation {
  const trimmed = word.trim();
  if (trimmed.length === 0) return { ok: false, error: "Clue cannot be empty." };
  if (/\s/.test(trimmed)) {
    return { ok: false, error: "Clue must be a single word (no spaces)." };
  }
  if (!Number.isInteger(count) || count < 0 || count > MAX_CLUE_COUNT) {
    return { ok: false, error: `Number must be an integer between 0 and ${MAX_CLUE_COUNT}.` };
  }
  // A clue may not be (or contain) a codename currently on the board.
  const normalized = trimmed.toUpperCase();
  for (const card of state.board) {
    if (card.revealed) continue;
    const boardWord = card.word.toUpperCase();
    if (!boardWord) continue; // picture cards have no word to conflict with
    if (
      normalized === boardWord ||
      normalized.includes(boardWord) ||
      boardWord.includes(normalized)
    ) {
      return {
        ok: false,
        error: `Clue may not relate to the board word "${card.word}".`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Actions (each returns { state, error? } or an outcome)
// ---------------------------------------------------------------------------

export interface ActionResult {
  state: GameState;
  error?: string;
}

function clone(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((c) => ({ ...c })),
    clue: state.clue ? { ...state.clue } : null,
  };
}

function endTurnInPlace(state: GameState): void {
  state.currentTeam = otherTeam(state.currentTeam);
  state.turnPhase = "clue";
  state.clue = null;
}

/**
 * Simulated-opponent turn for co-op: cover one enemy (red) agent, then hand play
 * back to the human team — unless that was the enemy's last agent, which is a loss.
 */
function coopEnemyTurn(state: GameState): void {
  const idx = state.board.findIndex((c) => c.role === COOP_ENEMY_TEAM && !c.revealed);
  if (idx >= 0) state.board[idx].revealed = true;

  if (getScore(state)[COOP_ENEMY_TEAM].remaining === 0) {
    // The simulated opponent found all its agents first — the team loses.
    state.phase = "finished";
    state.winner = COOP_ENEMY_TEAM;
    state.winReason = "all-agents-found";
    state.turnPhase = "clue";
    state.clue = null;
    return;
  }
  state.currentTeam = COOP_HUMAN_TEAM;
  state.turnPhase = "clue";
  state.clue = null;
}

/** End the current turn, routing through the simulated opponent in co-op. */
function advanceAfterTurn(state: GameState): void {
  if (state.variant === "coop") coopEnemyTurn(state);
  else endTurnInPlace(state);
}

export function giveClue(
  prev: GameState,
  team: Team,
  word: string,
  count: number,
): ActionResult {
  if (prev.phase !== "playing") return { state: prev, error: "Game is not in progress." };
  if (prev.currentTeam !== team) return { state: prev, error: "It is not your team's turn." };
  if (prev.turnPhase !== "clue") return { state: prev, error: "A clue has already been given this turn." };

  const validation = validateClue(prev, word, count);
  if (!validation.ok) return { state: prev, error: validation.error };

  const state = clone(prev);
  state.clue = { word: word.trim(), count, guessesMade: 0 };
  state.turnPhase = "guess";
  state.version += 1;
  return { state };
}

export interface GuessResult extends ActionResult {
  outcome?: GuessOutcome;
}

export function guess(prev: GameState, team: Team, cardIndex: number): GuessResult {
  if (prev.phase !== "playing") return { state: prev, error: "Game is not in progress." };
  if (prev.currentTeam !== team) return { state: prev, error: "It is not your team's turn." };
  if (prev.turnPhase !== "guess" || !prev.clue) {
    return { state: prev, error: "Wait for your spymaster to give a clue." };
  }
  if (cardIndex < 0 || cardIndex >= prev.board.length) {
    return { state: prev, error: "Invalid card." };
  }
  if (prev.board[cardIndex].revealed) {
    return { state: prev, error: "That card is already revealed." };
  }

  const state = clone(prev);
  const card = state.board[cardIndex];
  card.revealed = true;
  state.clue!.guessesMade += 1;
  state.version += 1;

  const outcome: GuessOutcome = {
    cardIndex,
    word: card.word,
    role: card.role,
    correct: card.role === team,
    turnEnded: false,
    gameEnded: false,
  };

  // Assassin: the guessing team loses immediately.
  if (card.role === "assassin") {
    state.phase = "finished";
    state.winner = otherTeam(team);
    state.winReason = "assassin-revealed";
    state.turnPhase = "clue";
    state.clue = null;
    outcome.turnEnded = true;
    outcome.gameEnded = true;
    return { state, outcome };
  }

  // Win check: a team that has all its agents revealed wins (even on the
  // opponent's turn). In co-op, the human team is blue; the enemy reaching 0
  // means the simulated opponent won, i.e. the team loses.
  const score = getScore(state);
  if (state.variant === "coop") {
    if (score.blue.remaining === 0) {
      finishWin(state, "blue");
      outcome.turnEnded = true;
      outcome.gameEnded = true;
      return { state, outcome };
    }
    if (score.red.remaining === 0) {
      finishWin(state, "red"); // simulated opponent completed — team loses
      outcome.turnEnded = true;
      outcome.gameEnded = true;
      return { state, outcome };
    }
  } else {
    if (score.red.remaining === 0) {
      finishWin(state, "red");
      outcome.turnEnded = true;
      outcome.gameEnded = true;
      return { state, outcome };
    }
    if (score.blue.remaining === 0) {
      finishWin(state, "blue");
      outcome.turnEnded = true;
      outcome.gameEnded = true;
      return { state, outcome };
    }
  }

  if (outcome.correct) {
    const max = maxGuessesFor(state.clue!.count);
    if (state.clue!.guessesMade >= max) {
      advanceAfterTurn(state);
      outcome.turnEnded = true;
    }
  } else {
    // Neutral or opponent's agent: turn ends immediately.
    advanceAfterTurn(state);
    outcome.turnEnded = true;
  }
  // The simulated opponent's turn may itself end the game (its last agent).
  if (state.phase === "finished") outcome.gameEnded = true;

  return { state, outcome };
}

function finishWin(state: GameState, winner: Team): void {
  state.phase = "finished";
  state.winner = winner;
  state.winReason = "all-agents-found";
  state.turnPhase = "clue";
  state.clue = null;
}

/**
 * Server-initiated end of turn (e.g. the turn timer expired). Unlike the
 * voluntary `endTurn`, this does not require a guess to have been made.
 */
export function forceEndTurn(prev: GameState): ActionResult {
  if (prev.phase !== "playing") return { state: prev, error: "Game is not in progress." };
  const state = clone(prev);
  advanceAfterTurn(state);
  state.version += 1;
  return { state };
}

/** Voluntary end of turn by the operatives (only after ≥1 guess). */
export function endTurn(prev: GameState, team: Team): ActionResult {
  if (prev.phase !== "playing") return { state: prev, error: "Game is not in progress." };
  if (prev.currentTeam !== team) return { state: prev, error: "It is not your team's turn." };
  if (prev.turnPhase !== "guess" || !prev.clue) {
    return { state: prev, error: "You can only end the turn while guessing." };
  }
  if (prev.clue.guessesMade < 1) {
    return { state: prev, error: "Your team must make at least one guess." };
  }
  const state = clone(prev);
  advanceAfterTurn(state);
  state.version += 1;
  return { state };
}
