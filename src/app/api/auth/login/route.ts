import { z } from "zod";
import { prisma } from "@server/db/prisma";
import { verifyPassword, signToken } from "@server/auth/auth";
import { json, error } from "@/app/api/_lib/handler";

const schema = z.object({
  username: z.string().min(1).max(24),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid input.");

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return error("Incorrect username or password.", 401);
  }

  const profile = { userId: user.id, username: user.username, displayName: user.displayName };
  return json({ token: signToken(profile), profile });
}
