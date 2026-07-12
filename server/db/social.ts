// Database helpers for the social layer: friends, friend requests, direct
// messages (with delivery/seen receipts), and notifications. Pure DB logic; the
// socket layer (server/social/socialServer.ts) adds presence + real-time pushes.

import { prisma } from "./prisma.js";
import type {
  ConversationView,
  DMView,
  FriendsData,
  NotificationType,
  NotificationView,
  PublicUser,
} from "../../shared/protocol.js";

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function toPublic(u: { id: string; username: string; displayName: string }): PublicUser {
  return { userId: u.id, username: u.username, displayName: u.displayName };
}

async function publicUsers(ids: string[]): Promise<Map<string, PublicUser>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } } });
  return new Map(users.map((u) => [u.id, toPublic(u)]));
}

function toDM(m: {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  createdAt: Date;
  deliveredAt: Date | null;
  seenAt: Date | null;
}): DMView {
  return {
    id: m.id,
    fromUserId: m.fromUserId,
    toUserId: m.toUserId,
    body: m.body,
    at: m.createdAt.getTime(),
    deliveredAt: m.deliveredAt ? m.deliveredAt.getTime() : null,
    seenAt: m.seenAt ? m.seenAt.getTime() : null,
  };
}

export async function searchUsers(query: string, excludeUserId: string, limit = 8): Promise<PublicUser[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { username: "asc" },
  });
  return rows.map(toPublic);
}

// --- friends --------------------------------------------------------------

export async function areFriends(a: string, b: string): Promise<boolean> {
  const [x, y] = pair(a, b);
  const f = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId: x, userBId: y } } });
  return !!f;
}

export interface AddFriendResult {
  ok: boolean;
  error?: string;
  /** Set when a reverse request existed and was auto-accepted. */
  accepted?: boolean;
  target?: PublicUser;
}

export async function addFriendByUsername(
  fromUserId: string,
  toUsername: string,
): Promise<AddFriendResult> {
  const target = await prisma.user.findUnique({ where: { username: toUsername.trim() } });
  if (!target) return { ok: false, error: "No user with that username." };
  if (target.id === fromUserId) return { ok: false, error: "You can't add yourself." };
  if (await areFriends(fromUserId, target.id)) {
    return { ok: false, error: "You're already friends." };
  }

  // If they already sent us a request, accept it instead of creating a new one.
  const reverse = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: target.id, toUserId: fromUserId } },
  });
  if (reverse && reverse.status === "pending") {
    await createFriendship(target.id, fromUserId);
    await prisma.friendRequest.update({ where: { id: reverse.id }, data: { status: "accepted" } });
    return { ok: true, accepted: true, target: toPublic(target) };
  }

  await prisma.friendRequest.upsert({
    where: { fromUserId_toUserId: { fromUserId, toUserId: target.id } },
    update: { status: "pending" },
    create: { fromUserId, toUserId: target.id, status: "pending" },
  });
  return { ok: true, target: toPublic(target) };
}

async function createFriendship(a: string, b: string): Promise<void> {
  const [x, y] = pair(a, b);
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: x, userBId: y } },
    update: {},
    create: { userAId: x, userBId: y },
  });
}

export interface RespondResult {
  ok: boolean;
  error?: string;
  requesterId?: string;
  responder?: PublicUser;
}

export async function respondToRequest(
  userId: string,
  requestId: string,
  accept: boolean,
): Promise<RespondResult> {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.toUserId !== userId) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: "Request already handled." };

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: accept ? "accepted" : "declined" },
  });
  if (accept) await createFriendship(req.fromUserId, req.toUserId);

  const responder = await prisma.user.findUnique({ where: { id: userId } });
  return {
    ok: true,
    requesterId: req.fromUserId,
    responder: responder ? toPublic(responder) : undefined,
  };
}

export async function removeFriend(userId: string, otherId: string): Promise<void> {
  const [x, y] = pair(userId, otherId);
  await prisma.friendship.deleteMany({ where: { userAId: x, userBId: y } });
  // Also clear any lingering requests both ways.
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    },
  });
}

/** Friend ids (for presence fan-out). */
export async function friendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
  });
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

export async function getFriendsData(userId: string): Promise<Omit<FriendsData, "friends"> & { friends: PublicUser[] }> {
  const ids = await friendIds(userId);
  const [friendMap, incoming, outgoing] = await Promise.all([
    publicUsers(ids),
    prisma.friendRequest.findMany({ where: { toUserId: userId, status: "pending" } }),
    prisma.friendRequest.findMany({ where: { fromUserId: userId, status: "pending" } }),
  ]);
  const partyMap = await publicUsers([
    ...incoming.map((r) => r.fromUserId),
    ...outgoing.map((r) => r.toUserId),
  ]);
  return {
    friends: ids.map((id) => friendMap.get(id)).filter((u): u is PublicUser => !!u),
    incoming: incoming
      .map((r) => {
        const from = partyMap.get(r.fromUserId);
        return from ? { id: r.id, from } : null;
      })
      .filter((x): x is { id: string; from: PublicUser } => !!x),
    outgoing: outgoing
      .map((r) => {
        const to = partyMap.get(r.toUserId);
        return to ? { id: r.id, to } : null;
      })
      .filter((x): x is { id: string; to: PublicUser } => !!x),
  };
}

// --- direct messages ------------------------------------------------------

export async function saveMessage(
  fromUserId: string,
  toUserId: string,
  body: string,
  deliveredNow: boolean,
): Promise<DMView> {
  const m = await prisma.directMessage.create({
    data: { fromUserId, toUserId, body, deliveredAt: deliveredNow ? new Date() : null },
  });
  return toDM(m);
}

export async function markDelivered(messageId: string): Promise<number | null> {
  const m = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!m || m.deliveredAt) return m?.deliveredAt ? m.deliveredAt.getTime() : null;
  const now = new Date();
  await prisma.directMessage.update({ where: { id: messageId }, data: { deliveredAt: now } });
  return now.getTime();
}

/** Mark all messages FROM withUserId TO userId as seen. Returns the timestamp if any updated. */
export async function markConversationSeen(userId: string, withUserId: string): Promise<number | null> {
  const now = new Date();
  const res = await prisma.directMessage.updateMany({
    where: { fromUserId: withUserId, toUserId: userId, seenAt: null },
    data: { seenAt: now, deliveredAt: now },
  });
  return res.count > 0 ? now.getTime() : null;
}

/** Mark all undelivered messages to a user as delivered (called when they come online). */
export async function deliverPendingTo(
  userId: string,
): Promise<{ messageId: string; fromUserId: string; at: number }[]> {
  const pending = await prisma.directMessage.findMany({
    where: { toUserId: userId, deliveredAt: null },
  });
  if (pending.length === 0) return [];
  const now = new Date();
  await prisma.directMessage.updateMany({
    where: { toUserId: userId, deliveredAt: null },
    data: { deliveredAt: now },
  });
  return pending.map((m) => ({ messageId: m.id, fromUserId: m.fromUserId, at: now.getTime() }));
}

export async function conversationHistory(userId: string, withUserId: string, limit = 100): Promise<DMView[]> {
  const rows = await prisma.directMessage.findMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: withUserId },
        { fromUserId: withUserId, toUserId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map(toDM);
}

export async function listConversations(userId: string): Promise<ConversationView[]> {
  const rows = await prisma.directMessage.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  const byPartner = new Map<string, { last: DMView; unread: number }>();
  for (const r of rows) {
    const partner = r.fromUserId === userId ? r.toUserId : r.fromUserId;
    const dm = toDM(r);
    const entry = byPartner.get(partner);
    if (!entry) byPartner.set(partner, { last: dm, unread: 0 });
    if (r.toUserId === userId && !r.seenAt) {
      byPartner.get(partner)!.unread += 1;
    }
  }
  const users = await publicUsers([...byPartner.keys()]);
  const convos: ConversationView[] = [];
  for (const [partner, { last, unread }] of byPartner) {
    const user = users.get(partner);
    if (user) convos.push({ user, online: false, lastMessage: last, unread });
  }
  return convos;
}

// --- notifications --------------------------------------------------------

function toNotif(n: {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string | null;
  roomCode: string | null;
  text: string | null;
  read: boolean;
  createdAt: Date;
}): NotificationView {
  return {
    id: n.id,
    type: n.type as NotificationType,
    actorId: n.actorId,
    actorName: n.actorName,
    roomCode: n.roomCode,
    text: n.text,
    read: n.read,
    at: n.createdAt.getTime(),
  };
}

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  actorId?: string;
  actorName?: string;
  roomCode?: string;
  text?: string;
}): Promise<NotificationView> {
  const n = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      actorId: data.actorId ?? null,
      actorName: data.actorName ?? null,
      roomCode: data.roomCode ?? null,
      text: data.text ?? null,
    },
  });
  return toNotif(n);
}

export async function listNotifications(userId: string, limit = 30): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toNotif);
}

export async function markNotificationsRead(userId: string, id?: string): Promise<void> {
  await prisma.notification.updateMany({
    where: id ? { id, userId } : { userId, read: false },
    data: { read: true },
  });
}
