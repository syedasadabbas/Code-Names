// Social real-time server: presence tracking, friends, friend requests, game
// invites, direct messages (with delivery/seen receipts), and notifications.
// Runs alongside GameServer on the same Socket.IO instance. All social features
// require an authenticated account (a valid JWT on the handshake).

import type { Server, Socket } from "socket.io";
import { verifyToken } from "../auth/auth.js";
import * as social from "../db/social.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SimpleAck,
  DMView,
} from "../../shared/protocol.js";

interface SocketData {
  userId?: string | null;
  displayName?: string | null;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export class SocialServer {
  /** userId -> set of connected socket ids. */
  private online = new Map<string, Set<string>>();

  constructor(private io: IO) {
    this.io.on("connection", (socket) => this.onConnection(socket));
  }

  private isOnline(userId: string): boolean {
    const set = this.online.get(userId);
    return !!set && set.size > 0;
  }

  private emitToUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    const set = this.online.get(userId);
    if (!set) return;
    for (const sid of set) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.io.to(sid).emit(event, ...(args as any));
    }
  }

  private async onConnection(socket: IOSocket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    if (payload) {
      socket.data.userId = payload.userId;
      socket.data.displayName = payload.displayName;
      await this.register(socket, payload.userId);
    }

    socket.on("friend:add", (p, cb) => void this.handleFriendAdd(socket, p, cb));
    socket.on("friend:respond", (p, cb) => void this.handleFriendRespond(socket, p, cb));
    socket.on("friend:remove", (p, cb) => void this.handleFriendRemove(socket, p, cb));
    socket.on("friend:list", (cb) => void this.handleFriendList(socket, cb));
    socket.on("game:invite", (p, cb) => void this.handleInvite(socket, p, cb));
    socket.on("dm:send", (p, cb) => void this.handleDmSend(socket, p, cb));
    socket.on("dm:history", (p, cb) => void this.handleDmHistory(socket, p, cb));
    socket.on("dm:read", (p, cb) => void this.handleDmRead(socket, p, cb));
    socket.on("dm:conversations", (cb) => void this.handleConversations(socket, cb));
    socket.on("notif:list", (cb) => void this.handleNotifList(socket, cb));
    socket.on("notif:read", (p, cb) => void this.handleNotifRead(socket, p, cb));

    socket.on("disconnect", () => void this.unregister(socket));
  }

  private async register(socket: IOSocket, userId: string): Promise<void> {
    const first = !this.isOnline(userId);
    const set = this.online.get(userId) ?? new Set<string>();
    set.add(socket.id);
    this.online.set(userId, set);
    if (!first) return;

    // Newly online: tell friends, and deliver any queued messages.
    try {
      const friends = await social.friendIds(userId);
      for (const fid of friends) this.emitToUser(fid, "presence:update", { userId, online: true });
      const pending = await social.deliverPendingTo(userId);
      for (const p of pending) {
        this.emitToUser(p.fromUserId, "dm:delivered", { messageId: p.messageId, at: p.at });
      }
    } catch (err) {
      console.error("[social] register error:", err);
    }
  }

  private async unregister(socket: IOSocket): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;
    const set = this.online.get(userId);
    if (!set) return;
    set.delete(socket.id);
    if (set.size > 0) return;
    this.online.delete(userId);
    try {
      const friends = await social.friendIds(userId);
      for (const fid of friends) this.emitToUser(fid, "presence:update", { userId, online: false });
    } catch (err) {
      console.error("[social] unregister error:", err);
    }
  }

  private auth(socket: IOSocket, cb?: (a: SimpleAck) => void): string | null {
    const userId = socket.data.userId;
    if (!userId) {
      cb?.({ ok: false, error: "Sign in to use friends and messaging." });
      return null;
    }
    return userId;
  }

  // --- friends ------------------------------------------------------------

  private async handleFriendAdd(socket: IOSocket, p: { username: string }, cb: (a: SimpleAck) => void) {
    const userId = this.auth(socket, cb);
    if (!userId) return;
    try {
      const res = await social.addFriendByUsername(userId, String(p?.username ?? ""));
      if (!res.ok) return cb({ ok: false, error: res.error });
      const name = socket.data.displayName ?? "Someone";
      if (res.target) {
        if (res.accepted) {
          // Reverse request auto-accepted → both are now friends.
          const notif = await social.createNotification({
            userId: res.target.userId,
            type: "friend_accepted",
            actorId: userId,
            actorName: name,
            text: `${name} accepted your friend request`,
          });
          this.emitToUser(res.target.userId, "notif:new", notif);
          this.emitToUser(res.target.userId, "friend:changed");
        } else {
          const notif = await social.createNotification({
            userId: res.target.userId,
            type: "friend_request",
            actorId: userId,
            actorName: name,
            text: `${name} sent you a friend request`,
          });
          this.emitToUser(res.target.userId, "notif:new", notif);
          this.emitToUser(res.target.userId, "friend:changed");
        }
      }
      cb({ ok: true });
    } catch (err) {
      console.error("[social] friend:add", err);
      cb({ ok: false, error: "Server error." });
    }
  }

  private async handleFriendRespond(
    socket: IOSocket,
    p: { requestId: string; accept: boolean },
    cb: (a: SimpleAck) => void,
  ) {
    const userId = this.auth(socket, cb);
    if (!userId) return;
    try {
      const res = await social.respondToRequest(userId, String(p?.requestId ?? ""), !!p?.accept);
      if (!res.ok) return cb({ ok: false, error: res.error });
      if (p.accept && res.requesterId && res.responder) {
        const notif = await social.createNotification({
          userId: res.requesterId,
          type: "friend_accepted",
          actorId: userId,
          actorName: res.responder.displayName,
          text: `${res.responder.displayName} accepted your friend request`,
        });
        this.emitToUser(res.requesterId, "notif:new", notif);
      }
      if (res.requesterId) this.emitToUser(res.requesterId, "friend:changed");
      cb({ ok: true });
    } catch (err) {
      console.error("[social] friend:respond", err);
      cb({ ok: false, error: "Server error." });
    }
  }

  private async handleFriendRemove(socket: IOSocket, p: { userId: string }, cb?: (a: SimpleAck) => void) {
    const userId = this.auth(socket, cb);
    if (!userId) return;
    try {
      await social.removeFriend(userId, String(p?.userId ?? ""));
      this.emitToUser(String(p?.userId ?? ""), "friend:changed");
      cb?.({ ok: true });
    } catch (err) {
      console.error("[social] friend:remove", err);
      cb?.({ ok: false, error: "Server error." });
    }
  }

  private async handleFriendList(socket: IOSocket, cb: (d: any) => void) {
    const userId = socket.data.userId;
    if (!userId) return cb({ friends: [], incoming: [], outgoing: [] });
    try {
      const data = await social.getFriendsData(userId);
      const friends = data.friends.map((u) => ({ ...u, online: this.isOnline(u.userId) }));
      cb({ friends, incoming: data.incoming, outgoing: data.outgoing });
    } catch (err) {
      console.error("[social] friend:list", err);
      cb({ friends: [], incoming: [], outgoing: [] });
    }
  }

  // --- game invite --------------------------------------------------------

  private async handleInvite(socket: IOSocket, p: { toUserId: string }, cb: (a: SimpleAck) => void) {
    const userId = this.auth(socket, cb);
    if (!userId) return;
    const roomCode = (socket.data as { roomCode?: string }).roomCode;
    if (!roomCode) return cb({ ok: false, error: "Open a room before inviting friends." });
    const toUserId = String(p?.toUserId ?? "");
    try {
      if (!(await social.areFriends(userId, toUserId))) {
        return cb({ ok: false, error: "You can only invite friends." });
      }
      const name = socket.data.displayName ?? "A friend";
      const notif = await social.createNotification({
        userId: toUserId,
        type: "game_invite",
        actorId: userId,
        actorName: name,
        roomCode,
        text: `${name} invited you to a game`,
      });
      this.emitToUser(toUserId, "notif:new", notif);
      cb({ ok: true });
    } catch (err) {
      console.error("[social] game:invite", err);
      cb({ ok: false, error: "Server error." });
    }
  }

  // --- direct messages ----------------------------------------------------

  private async handleDmSend(
    socket: IOSocket,
    p: { toUserId: string; body: string },
    cb: (a: { ok: boolean; error?: string; message?: DMView }) => void,
  ) {
    const userId = socket.data.userId;
    if (!userId) return cb({ ok: false, error: "Sign in to send messages." });
    const toUserId = String(p?.toUserId ?? "");
    const body = String(p?.body ?? "").trim().slice(0, 2000);
    if (!body) return cb({ ok: false, error: "Empty message." });
    try {
      if (!(await social.areFriends(userId, toUserId))) {
        return cb({ ok: false, error: "You can only message friends." });
      }
      const online = this.isOnline(toUserId);
      const message = await social.saveMessage(userId, toUserId, body, online);
      if (online) this.emitToUser(toUserId, "dm:new", message);
      cb({ ok: true, message });
    } catch (err) {
      console.error("[social] dm:send", err);
      cb({ ok: false, error: "Server error." });
    }
  }

  private async handleDmHistory(socket: IOSocket, p: { withUserId: string }, cb: (d: any) => void) {
    const userId = socket.data.userId;
    if (!userId) return cb({ messages: [] });
    try {
      const messages = await social.conversationHistory(userId, String(p?.withUserId ?? ""));
      cb({ messages });
    } catch (err) {
      console.error("[social] dm:history", err);
      cb({ messages: [] });
    }
  }

  private async handleDmRead(socket: IOSocket, p: { withUserId: string }, cb?: (a: SimpleAck) => void) {
    const userId = socket.data.userId;
    if (!userId) return cb?.({ ok: false, error: "Not signed in." });
    const withUserId = String(p?.withUserId ?? "");
    try {
      const at = await social.markConversationSeen(userId, withUserId);
      if (at) this.emitToUser(withUserId, "dm:seen", { withUserId: userId, at });
      cb?.({ ok: true });
    } catch (err) {
      console.error("[social] dm:read", err);
      cb?.({ ok: false, error: "Server error." });
    }
  }

  private async handleConversations(socket: IOSocket, cb: (d: any) => void) {
    const userId = socket.data.userId;
    if (!userId) return cb({ conversations: [] });
    try {
      const conversations = await social.listConversations(userId);
      for (const c of conversations) c.online = this.isOnline(c.user.userId);
      cb({ conversations });
    } catch (err) {
      console.error("[social] dm:conversations", err);
      cb({ conversations: [] });
    }
  }

  // --- notifications ------------------------------------------------------

  private async handleNotifList(socket: IOSocket, cb: (d: any) => void) {
    const userId = socket.data.userId;
    if (!userId) return cb({ notifications: [] });
    try {
      cb({ notifications: await social.listNotifications(userId) });
    } catch (err) {
      console.error("[social] notif:list", err);
      cb({ notifications: [] });
    }
  }

  private async handleNotifRead(socket: IOSocket, p: { id?: string }, cb?: (a: SimpleAck) => void) {
    const userId = socket.data.userId;
    if (!userId) return cb?.({ ok: false });
    try {
      await social.markNotificationsRead(userId, p?.id);
      cb?.({ ok: true });
    } catch (err) {
      console.error("[social] notif:read", err);
      cb?.({ ok: false, error: "Server error." });
    }
  }
}
