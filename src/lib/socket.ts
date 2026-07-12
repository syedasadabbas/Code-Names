"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/protocol";
import { getToken } from "./authClient";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * Shared Socket.IO client. Connects lazily on first use in the browser.
 *
 * In a split deployment (Next.js on Vercel + a standalone realtime server), set
 * NEXT_PUBLIC_SOCKET_URL to the realtime server's URL. When it is unset (local
 * combined dev/prod), the client connects to the same origin that served the page.
 */
export function getSocket(): AppSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    const opts = {
      path: "/socket.io",
      autoConnect: true,
      transports: ["websocket", "polling"],
      auth: { token: getToken() ?? undefined },
    };
    socket = url ? io(url, opts) : io(opts);
  }
  return socket;
}
