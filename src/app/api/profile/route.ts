import { z } from "zod";
import { prisma } from "@server/db/prisma";
import { signToken } from "@server/auth/auth";
import { bearer, json, error } from "@/app/api/_lib/handler";

const schema = z.object({
  displayName: z.string().min(1).max(20),
});

export async function PATCH(req: Request) {
  const payload = bearer(req);
  if (!payload) return error("Not authenticated.", 401);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Display name must be 1–20 characters.");

  const user = await prisma.user.update({
    where: { id: payload.userId },
    data: { displayName: parsed.data.displayName.trim() },
  });

  const profile = { userId: user.id, username: user.username, displayName: user.displayName };
  // Reissue the token so the new display name flows into the socket handshake.
  return json({ token: signToken(profile), profile });
}
