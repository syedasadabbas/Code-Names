"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { getProfile } from "@/lib/authClient";
import type {
  ConversationView,
  DMView,
  FriendView,
  IncomingRequestView,
  NotificationView,
  OutgoingRequestView,
  PublicUser,
} from "@shared/protocol";

export function useSocial() {
  const profile = typeof window !== "undefined" ? getProfile() : null;
  const enabled = !!profile;
  const myId = profile?.userId ?? "";

  const [friends, setFriends] = useState<FriendView[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequestView[]>([]);
  const [notifications, setNotifications] = useState<NotificationView[]>([]);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [openWith, setOpenWith] = useState<PublicUser | null>(null);
  const [messages, setMessages] = useState<DMView[]>([]);
  const openRef = useRef<PublicUser | null>(null);
  openRef.current = openWith;

  const refreshFriends = useCallback(() => {
    if (!enabled) return;
    getSocket().emit("friend:list", (d) => {
      setFriends(d.friends);
      setIncoming(d.incoming);
      setOutgoing(d.outgoing);
    });
  }, [enabled]);

  const refreshConversations = useCallback(() => {
    if (!enabled) return;
    getSocket().emit("dm:conversations", (d) => setConversations(d.conversations));
  }, [enabled]);

  const refreshNotifications = useCallback(() => {
    if (!enabled) return;
    getSocket().emit("notif:list", (d) => setNotifications(d.notifications));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    const onConnect = () => {
      refreshFriends();
      refreshConversations();
      refreshNotifications();
    };
    const onFriendChanged = () => {
      refreshFriends();
    };
    const onPresence = (p: { userId: string; online: boolean }) => {
      setFriends((fs) => fs.map((f) => (f.userId === p.userId ? { ...f, online: p.online } : f)));
      setConversations((cs) =>
        cs.map((c) => (c.user.userId === p.userId ? { ...c, online: p.online } : c)),
      );
    };
    const onDmNew = (m: DMView) => {
      const open = openRef.current;
      if (open && m.fromUserId === open.userId) {
        setMessages((ms) => [...ms, m]);
        getSocket().emit("dm:read", { withUserId: open.userId });
      }
      refreshConversations();
    };
    const onDelivered = (p: { messageId: string; at: number }) => {
      setMessages((ms) => ms.map((m) => (m.id === p.messageId ? { ...m, deliveredAt: p.at } : m)));
    };
    const onSeen = (p: { withUserId: string; at: number }) => {
      const open = openRef.current;
      if (open && open.userId === p.withUserId) {
        setMessages((ms) =>
          ms.map((m) => (m.fromUserId === myId && !m.seenAt ? { ...m, seenAt: p.at, deliveredAt: m.deliveredAt ?? p.at } : m)),
        );
      }
    };
    const onNotif = (n: NotificationView) => {
      setNotifications((ns) => [n, ...ns]);
    };

    socket.on("connect", onConnect);
    socket.on("friend:changed", onFriendChanged);
    socket.on("presence:update", onPresence);
    socket.on("dm:new", onDmNew);
    socket.on("dm:delivered", onDelivered);
    socket.on("dm:seen", onSeen);
    socket.on("notif:new", onNotif);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("friend:changed", onFriendChanged);
      socket.off("presence:update", onPresence);
      socket.off("dm:new", onDmNew);
      socket.off("dm:delivered", onDelivered);
      socket.off("dm:seen", onSeen);
      socket.off("notif:new", onNotif);
    };
  }, [enabled, myId, refreshFriends, refreshConversations, refreshNotifications]);

  const openConversation = useCallback((user: PublicUser) => {
    setOpenWith(user);
    setMessages([]);
    const socket = getSocket();
    socket.emit("dm:history", { withUserId: user.userId }, (d) => setMessages(d.messages));
    socket.emit("dm:read", { withUserId: user.userId });
    setConversations((cs) => cs.map((c) => (c.user.userId === user.userId ? { ...c, unread: 0 } : c)));
  }, []);

  const actions = {
    searchUsers: (query: string) =>
      new Promise<PublicUser[]>((resolve) =>
        getSocket().emit("user:search", { query }, (d) => resolve(d.users)),
      ),
    addFriend: (username: string) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) =>
        getSocket().emit("friend:add", { username }, (a) => {
          refreshFriends();
          resolve(a);
        }),
      ),
    respond: (requestId: string, accept: boolean) =>
      getSocket().emit("friend:respond", { requestId, accept }, () => refreshFriends()),
    removeFriend: (userId: string) =>
      getSocket().emit("friend:remove", { userId }, () => {
        refreshFriends();
        refreshConversations();
      }),
    invite: (toUserId: string) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) =>
        getSocket().emit("game:invite", { toUserId }, resolve),
      ),
    openConversation,
    closeConversation: () => setOpenWith(null),
    sendDm: (body: string) => {
      const open = openRef.current;
      if (!open || !body.trim()) return;
      getSocket().emit("dm:send", { toUserId: open.userId, body: body.trim() }, (a) => {
        if (a.ok && a.message) {
          setMessages((ms) => [...ms, a.message!]);
          refreshConversations();
        }
      });
    },
    markNotificationsRead: () => {
      getSocket().emit("notif:read", {});
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    },
    refreshAll: () => {
      refreshFriends();
      refreshConversations();
      refreshNotifications();
    },
  };

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const unreadDms = conversations.reduce((s, c) => s + c.unread, 0);

  return {
    enabled,
    myId,
    friends,
    incoming,
    outgoing,
    notifications,
    conversations,
    openWith,
    messages,
    unreadNotifs,
    unreadDms,
    actions,
  };
}
