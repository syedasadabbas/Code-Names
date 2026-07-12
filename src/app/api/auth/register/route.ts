import { z } from "zod";
import { prisma } from "@server/db/prisma";
import { hashPassword, signToken } from "@server/auth/auth";
import { json, error } from "@/app/api/_lib/handler";

const schema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only."),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(20).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Invalid input.");

  const { username, password } = parsed.data;
  const displayName = parsed.data.displayName?.trim() || username;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return error("That username is taken.", 409);

  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), displayName },
  });

  const profile = { userId: user.id, username: user.username, displayName: user.displayName };
  return json({ token: signToken(profile), profile });
}
