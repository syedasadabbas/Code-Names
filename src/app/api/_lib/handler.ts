// Small helpers shared by the auth API route handlers.

import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "@server/auth/auth";

export function bearer(req: Request): TokenPayload | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
