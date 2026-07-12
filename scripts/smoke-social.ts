// One-off smoke test for the social DB layer against a real Postgres.
// Creates two temp users, exercises friends/requests/DMs/receipts/notifications,
// asserts the results, and deletes everything it created. Run with:
//   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/smoke-social.ts
import { prisma } from "../server/db/prisma.js";
import * as social from "../server/db/social.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ok:", msg);
}

async function main() {
  const tag = "smoke_" + Math.abs(Date.now() % 100000);
  const u1 = await prisma.user.create({
    data: { username: `${tag}_a`, passwordHash: "x", displayName: "Alice" },
  });
  const u2 = await prisma.user.create({
    data: { username: `${tag}_b`, passwordHash: "x", displayName: "Bob" },
  });
  const ids = [u1.id, u2.id];

  try {
    console.log("friends:");
    let r = await social.addFriendByUsername(u1.id, u2.username);
    assert(r.ok && !r.accepted, "friend request created");

    let data2 = await social.getFriendsData(u2.id);
    assert(data2.incoming.length === 1 && data2.incoming[0].from.userId === u1.id, "u2 sees incoming request");
    const reqId = data2.incoming[0].id;

    const resp = await social.respondToRequest(u2.id, reqId, true);
    assert(resp.ok && resp.requesterId === u1.id, "request accepted");
    assert(await social.areFriends(u1.id, u2.id), "they are friends");

    const data1 = await social.getFriendsData(u1.id);
    assert(data1.friends.some((f) => f.userId === u2.id), "u1 friend list includes u2");

    console.log("messages + receipts:");
    const msg = await social.saveMessage(u1.id, u2.id, "hello bob", false);
    assert(msg.deliveredAt === null && msg.seenAt === null, "message starts undelivered/unseen");

    const pending = await social.deliverPendingTo(u2.id);
    assert(pending.length === 1 && pending[0].messageId === msg.id, "delivered pending on come-online");

    const seenAt = await social.markConversationSeen(u2.id, u1.id);
    assert(!!seenAt, "conversation marked seen");

    const hist = await social.conversationHistory(u1.id, u2.id);
    assert(hist.length === 1 && !!hist[0].deliveredAt && !!hist[0].seenAt, "history shows delivered + seen");

    const convos = await social.listConversations(u1.id);
    assert(convos.length === 1 && convos[0].user.userId === u2.id && convos[0].unread === 0, "u1 conversation, no unread");

    const convos2 = await social.listConversations(u2.id);
    assert(convos2[0].unread === 0, "u2 unread cleared after seen");

    console.log("notifications:");
    await social.createNotification({ userId: u2.id, type: "game_invite", actorId: u1.id, actorName: "Alice", roomCode: "ABCD", text: "invite" });
    const notifs = await social.listNotifications(u2.id);
    assert(notifs.length === 1 && notifs[0].type === "game_invite" && notifs[0].roomCode === "ABCD", "invite notification created");
    await social.markNotificationsRead(u2.id);
    const notifs2 = await social.listNotifications(u2.id);
    assert(notifs2[0].read === true, "notifications marked read");

    console.log("unfriend:");
    await social.removeFriend(u1.id, u2.id);
    assert(!(await social.areFriends(u1.id, u2.id)), "no longer friends");

    console.log("\nALL SOCIAL SMOKE TESTS PASSED");
  } finally {
    // Clean up everything we created.
    await prisma.directMessage.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.friendship.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    console.log("cleaned up temp users");
  }
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
});
