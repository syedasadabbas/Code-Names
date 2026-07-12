// Persistence of completed games and history queries.

import { prisma } from "./prisma.js";
import type { Room } from "../rooms/roomManager.js";

/**
 * Persist a finished game and its participants. Called once per game when it
 * reaches the "finished" phase. Failures are logged but never crash the room.
 */
export async function recordFinishedGame(room: Room): Promise<void> {
  const game = room.game;
  if (!game || game.phase !== "finished") return;

  const participants = [...room.players.values()]
    // Only record players who were on a team (spectators are excluded).
    .filter((p) => p.team !== null)
    .map((p) => ({
      userId: p.userId,
      name: p.name,
      team: p.team,
      role: p.role,
      won: p.team === game.winner,
    }));

  try {
    await prisma.gameRecord.create({
      data: {
        roomCode: room.code,
        variant: game.variant,
        startingTeam: game.startingTeam,
        winner: game.winner,
        winReason: game.winReason,
        startedAt: new Date(room.createdAt),
        participants: { create: participants },
      },
    });
  } catch (err) {
    console.error(`[history] failed to record game for room ${room.code}:`, err);
  }
}

export interface HistoryEntry {
  id: string;
  roomCode: string;
  winner: string | null;
  winReason: string | null;
  finishedAt: string;
  team: string | null;
  won: boolean;
}

/** Recent games a given user participated in. */
export async function getUserHistory(userId: string, limit = 25): Promise<HistoryEntry[]> {
  const rows = await prisma.gameParticipant.findMany({
    where: { userId },
    include: { gameRecord: true },
    orderBy: { gameRecord: { finishedAt: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.gameRecordId,
    roomCode: r.gameRecord.roomCode,
    winner: r.gameRecord.winner,
    winReason: r.gameRecord.winReason,
    finishedAt: r.gameRecord.finishedAt.toISOString(),
    team: r.team,
    won: r.won,
  }));
}
