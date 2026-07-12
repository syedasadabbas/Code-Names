// Standalone Socket.IO realtime server (no Next.js).
//
// Used for SPLIT deployments: the Next.js UI is hosted on a serverless platform
// (e.g. Vercel) while this long-lived process hosts the authoritative game/room
// state and WebSocket connections on a container host (e.g. Render / Fly.io).
//
// Local combined dev/prod (Next + Socket.IO on one port) still uses server/index.ts.

import { createServer } from "node:http";
import { Server } from "socket.io";
import { GameServer } from "./socket/gameServer.js";
import { SocialServer } from "./social/socialServer.js";

const port = parseInt(process.env.PORT || "3001", 10);

// Comma-separated allow-list of browser origins permitted to connect (the URL of
// the deployed Next.js frontend). Defaults to "*" for convenience; set it in prod.
const originEnv = (process.env.CLIENT_ORIGIN || "*").trim();
const origins =
  originEnv === "*" ? "*" : originEnv.split(",").map((s) => s.trim()).filter(Boolean);

const server = createServer((req, res) => {
  // Health check / friendly root for the platform's uptime probes.
  if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain");
    res.end("Codenames realtime server OK");
    return;
  }
  res.statusCode = 404;
  res.end("Not found");
});

const io = new Server(server, {
  path: "/socket.io",
  cors: { origin: origins, methods: ["GET", "POST"] },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
new GameServer(io as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
new SocialServer(io as any);

server.on("error", (err) => {
  console.error("HTTP server error:", err);
  process.exit(1);
});

server.listen(port, () => {
  console.log(
    `> Codenames realtime server listening on :${port} (allowed origins: ${
      origins === "*" ? "*" : (origins as string[]).join(", ")
    })`,
  );
});
