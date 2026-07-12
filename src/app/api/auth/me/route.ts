import { bearer, json, error } from "@/app/api/_lib/handler";

export async function GET(req: Request) {
  const payload = bearer(req);
  if (!payload) return error("Not authenticated.", 401);
  return json({
    profile: {
      userId: payload.userId,
      username: payload.username,
      displayName: payload.displayName,
    },
  });
}
