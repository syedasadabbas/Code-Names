// Custom server hosting Next.js and Socket.IO on a single HTTP port.
// Run with `npm run dev` (watch) or `npm start` (production).

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server } from "socket.io";
import { GameServer } from "./socket/gameServer.js";
import { SocialServer } from "./social/socialServer.js";
import { RoomManager } from "./rooms/roomManager.js";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "localhost";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    try {
      handle(req, res, parse(req.url || "/", true));
    } catch (err) {
      console.error("Request handling error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new Server(server, {
    path: "/socket.io",
    cors: { origin: dev ? "*" : false },
  });

  const manager = new RoomManager();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new GameServer(io as any, manager);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new SocialServer(io as any, manager);

  server.on("error", (err) => {
    console.error("HTTP server error:", err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Codenames ready on http://${hostname}:${port} (dev=${dev})`);
  });
});
