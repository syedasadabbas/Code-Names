import { describe, it, expect } from "vitest";
import {
  createGame,
  giveClue,
  guess,
  endTurn,
  getScore,
  validateClue,
  BOARD_SIZE,
  STARTING_TEAM_AGENTS,
  SECOND_TEAM_AGENTS,
  ASSASSIN_COUNT,
  NEUTRAL_COUNT,
} from "./engine.js";
import type { GameState, Team } from "./types.js";

// A fixed seed produces a reproducible board, letting us assert exact behaviour.
function fixedGame(startingTeam: Team = "red"): GameState {
  return createGame({ seed: 42, startingTeam });
}

/** Find the index of the first unrevealed card of a given role. */
function findCard(state: GameState, role: string): number {
  return state.board.findIndex((c) => c.role === role && !c.revealed);
}

describe("createGame", () => {
  it("creates a 25-card board with the correct key distribution", () => {
    const g = fixedGame("red");
    expect(g.board).toHaveLength(BOARD_SIZE);
    const roles = g.board.map((c) => c.role);
    expect(roles.filter((r) => r === "red")).toHaveLength(STARTING_TEAM_AGENTS);
    expect(roles.filter((r) => r === "blue")).toHaveLength(SECOND_TEAM_AGENTS);
    expect(roles.filter((r) => r === "assassin")).toHaveLength(ASSASSIN_COUNT);
    expect(roles.filter((r) => r === "neutral")).toHaveLength(NEUTRAL_COUNT);
  });

  it("gives the starting team the extra agent and the first turn", () => {
    const g = fixedGame("blue");
    expect(g.startingTeam).toBe("blue");
    expect(g.currentTeam).toBe("blue");
    const score = getScore(g);
    expect(score.blue.total).toBe(STARTING_TEAM_AGENTS);
    expect(score.red.total).toBe(SECOND_TEAM_AGENTS);
  });

  it("is reproducible for a fixed seed", () => {
    const a = createGame({ seed: 7 });
    const b = createGame({ seed: 7 });
    expect(a.board.map((c) => c.word)).toEqual(b.board.map((c) => c.word));
    expect(a.board.map((c) => c.role)).toEqual(b.board.map((c) => c.role));
  });
});

describe("validateClue / giveClue", () => {
  it("rejects empty, multi-word, and out-of-range clues", () => {
    const g = fixedGame();
    expect(validateClue(g, "", 1).ok).toBe(false);
    expect(validateClue(g, "two words", 1).ok).toBe(false);
    expect(validateClue(g, "ocean", -1).ok).toBe(false);
    expect(validateClue(g, "ocean", 10).ok).toBe(false);
    expect(validateClue(g, "ocean", 1.5).ok).toBe(false);
  });

  it("rejects a clue equal to a board word", () => {
    const g = fixedGame();
    const boardWord = g.board[0].word;
    expect(validateClue(g, boardWord, 1).ok).toBe(false);
  });

  it("accepts a valid clue and moves to the guessing phase", () => {
    const g = fixedGame("red");
    const { state, error } = giveClue(g, "red", "ocean", 2);
    expect(error).toBeUndefined();
    expect(state.turnPhase).toBe("guess");
    expect(state.clue).toEqual({ word: "ocean", count: 2, guessesMade: 0 });
    expect(state.version).toBe(g.version + 1);
  });

  it("refuses a clue from the team that is not on turn", () => {
    const g = fixedGame("red");
    const { error } = giveClue(g, "blue", "ocean", 2);
    expect(error).toBeDefined();
  });
});

describe("guess", () => {
  it("lets the team continue after a correct guess", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 2).state;
    const idx = findCard(g, "red");
    const { state, outcome } = guess(g, "red", idx);
    expect(outcome?.correct).toBe(true);
    expect(outcome?.turnEnded).toBe(false);
    expect(state.currentTeam).toBe("red");
    expect(state.turnPhase).toBe("guess");
  });

  it("ends the turn after a neutral guess", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 2).state;
    const idx = findCard(g, "neutral");
    const { state, outcome } = guess(g, "red", idx);
    expect(outcome?.correct).toBe(false);
    expect(outcome?.turnEnded).toBe(true);
    expect(state.currentTeam).toBe("blue");
    expect(state.turnPhase).toBe("clue");
    expect(state.clue).toBeNull();
  });

  it("ends the turn after guessing the opponent's agent (and credits them)", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 3).state;
    const idx = findCard(g, "blue");
    const before = getScore(g).blue.found;
    const { state, outcome } = guess(g, "red", idx);
    expect(outcome?.turnEnded).toBe(true);
    expect(getScore(state).blue.found).toBe(before + 1);
    expect(state.currentTeam).toBe("blue");
  });

  it("ends the game immediately when the assassin is revealed", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 3).state;
    const idx = findCard(g, "assassin");
    const { state, outcome } = guess(g, "red", idx);
    expect(outcome?.gameEnded).toBe(true);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("blue");
    expect(state.winReason).toBe("assassin-revealed");
  });

  it("allows exactly the clue number of guesses (no bonus guess)", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 2).state; // exactly 2 guesses
    // First correct guess keeps the turn.
    let idx = findCard(g, "red");
    g = guess(g, "red", idx).state;
    expect(g.currentTeam).toBe("red");
    // Second correct guess reaches the clue number, so the turn ends.
    idx = findCard(g, "red");
    const { state, outcome } = guess(g, "red", idx);
    expect(outcome?.turnEnded).toBe(true);
    expect(state.currentTeam).toBe("blue");
  });

  it("ends the turn immediately after a single correct guess for a clue of 1", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 1).state; // exactly 1 guess
    const idx = findCard(g, "red");
    const { state, outcome } = guess(g, "red", idx);
    expect(outcome?.correct).toBe(true);
    expect(outcome?.turnEnded).toBe(true);
    expect(state.currentTeam).toBe("blue");
  });

  it("declares a winner when a team finds all its agents", () => {
    let g = fixedGame("red");
    // Reveal all red agents via repeated clues/guesses.
    while (getScore(g).red.remaining > 0 && g.phase === "playing") {
      if (g.turnPhase === "clue") g = giveClue(g, "red", "clue", 9).state;
      const idx = findCard(g, "red");
      g = guess(g, "red", idx).state;
    }
    expect(g.phase).toBe("finished");
    expect(g.winner).toBe("red");
    expect(g.winReason).toBe("all-agents-found");
  });

  it("rejects guessing an already-revealed card", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 3).state;
    const idx = findCard(g, "red");
    g = guess(g, "red", idx).state;
    const { error } = guess(g, "red", idx);
    expect(error).toBeDefined();
  });
});

describe("pictures variant", () => {
  const picGame = (startingTeam: Team = "red") =>
    createGame({ variant: "pictures", seed: 11, startingTeam });

  it("creates a 20-card image board with the 8/7/4/1 distribution", () => {
    const g = picGame("red");
    expect(g.variant).toBe("pictures");
    expect(g.gridCols).toBe(5);
    expect(g.board).toHaveLength(20);
    const roles = g.board.map((c) => c.role);
    expect(roles.filter((r) => r === "red")).toHaveLength(8);
    expect(roles.filter((r) => r === "blue")).toHaveLength(7);
    expect(roles.filter((r) => r === "neutral")).toHaveLength(4);
    expect(roles.filter((r) => r === "assassin")).toHaveLength(1);
  });

  it("uses image cards (image set, word empty) and unique images", () => {
    const g = picGame();
    for (const c of g.board) {
      expect(c.image).toMatch(/^\/pictures\/cards\/card-\d+\.jpg$/);
      expect(c.word).toBe("");
    }
    const uniqueImages = new Set(g.board.map((c) => c.image));
    expect(uniqueImages.size).toBe(20);
  });

  it("accepts clues even though picture cards have no words", () => {
    const g = picGame("red");
    expect(validateClue(g, "ocean", 2).ok).toBe(true);
    const { error, state } = giveClue(g, "red", "ocean", 2);
    expect(error).toBeUndefined();
    expect(state.turnPhase).toBe("guess");
  });

  it("plays a picture game to a win for the starting team", () => {
    let g = picGame("blue");
    while (getScore(g).blue.remaining > 0 && g.phase === "playing") {
      if (g.turnPhase === "clue") g = giveClue(g, "blue", "clue", 9).state;
      const idx = g.board.findIndex((c) => c.role === "blue" && !c.revealed);
      g = guess(g, "blue", idx).state;
    }
    expect(g.phase).toBe("finished");
    expect(g.winner).toBe("blue");
  });
});

describe("coop variant", () => {
  const coop = (seed = 5) => createGame({ variant: "coop", seed });

  it("sets up blue as the human team (9 agents) that starts", () => {
    const g = coop();
    expect(g.variant).toBe("coop");
    expect(g.startingTeam).toBe("blue");
    expect(g.currentTeam).toBe("blue");
    expect(getScore(g).blue.total).toBe(9);
    expect(getScore(g).red.total).toBe(8);
  });

  it("simulated opponent covers one enemy agent when the turn ends, then returns to blue", () => {
    let g = coop();
    g = giveClue(g, "blue", "clue", 2).state;
    const before = getScore(g).red.found;
    const neutral = g.board.findIndex((c) => c.role === "neutral" && !c.revealed);
    g = guess(g, "blue", neutral).state;
    expect(getScore(g).red.found).toBe(before + 1); // enemy covered one of its own
    expect(g.currentTeam).toBe("blue");
    expect(g.turnPhase).toBe("clue");
  });

  it("wins when the human team finds all its agents", () => {
    let g = coop();
    let guard = 0;
    while (getScore(g).blue.remaining > 0 && g.phase === "playing" && guard++ < 100) {
      if (g.turnPhase === "clue") g = giveClue(g, "blue", "clue", 9).state;
      const idx = g.board.findIndex((c) => c.role === "blue" && !c.revealed);
      g = guess(g, "blue", idx).state;
    }
    expect(g.phase).toBe("finished");
    expect(g.winner).toBe("blue");
  });

  it("loses instantly on the assassin", () => {
    let g = coop();
    g = giveClue(g, "blue", "clue", 3).state;
    const idx = g.board.findIndex((c) => c.role === "assassin");
    const { state } = guess(g, "blue", idx);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBe("red");
    expect(state.winReason).toBe("assassin-revealed");
  });

  it("loses when the simulated opponent contacts all its agents first", () => {
    let g = coop();
    let guard = 0;
    while (g.phase === "playing" && guard++ < 200) {
      if (g.turnPhase === "clue") g = giveClue(g, "blue", "clue", 1).state;
      let idx = g.board.findIndex((c) => !c.revealed && c.role === "neutral");
      if (idx < 0) idx = g.board.findIndex((c) => !c.revealed && c.role === "red");
      if (idx < 0) break;
      g = guess(g, "blue", idx).state;
    }
    expect(g.phase).toBe("finished");
    expect(g.winner).toBe("red");
  });
});

describe("endTurn", () => {
  it("blocks a voluntary pass before any guess is made", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 2).state;
    const { error } = endTurn(g, "red");
    expect(error).toBeDefined();
  });

  it("allows a voluntary pass after at least one guess", () => {
    let g = fixedGame("red");
    g = giveClue(g, "red", "clue", 2).state;
    const idx = findCard(g, "red");
    g = guess(g, "red", idx).state;
    const { state, error } = endTurn(g, "red");
    expect(error).toBeUndefined();
    expect(state.currentTeam).toBe("blue");
    expect(state.turnPhase).toBe("clue");
  });
});
