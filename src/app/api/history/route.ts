import { prisma } from "@server/db/prisma";
import { bearer, json, error } from "@/app/api/_lib/handler";

export async function GET(req: Request) {
  const payload = bearer(req);
  if (!payload) return error("Not authenticated.", 401);

  const rows = await prisma.gameParticipant.findMany({
    where: { userId: payload.userId },
    include: { gameRecord: true },
    orderBy: { gameRecord: { finishedAt: "desc" } },
    take: 25,
  });

  const history = rows.map((r) => ({
    id: r.gameRecordId,
    roomCode: r.gameRecord.roomCode,
    winner: r.gameRecord.winner,
    winReason: r.gameRecord.winReason,
    finishedAt: r.gameRecord.finishedAt.toISOString(),
    team: r.team,
    won: r.won,
  }));

  return json({ history });
}
