"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useSocial } from "@/hooks/useSocial";
import { getProfile, setProfile, setToken, getToken, setPreferredName } from "@/lib/authClient";
import type { DMView, PublicUser } from "@shared/protocol";
import Icon from "./Icon";

type Tab = "friends" | "messages" | "notifications";

/**
 * Floating social hub (bottom-right), shown only for signed-in accounts.
 * Friends + requests + presence, direct messages with delivery/seen receipts,
 * notifications, game invites, and inline display-name editing.
 */
export default function SocialDock({ inRoom = false }: { inRoom?: boolean }) {
  const social = useSocial();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("friends");

  if (!social.enabled) return null;

  const badge = social.unreadDms + social.unreadNotifs;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="surface flex h-[28rem] w-[22rem] max-w-[92vw] flex-col overflow-hidden rounded-2xl shadow-2xl">
          <ProfileHeader />
          <div className="flex border-b border-[var(--border)] text-sm">
            <TabButton active={tab === "friends"} onClick={() => setTab("friends")} label="Friends" count={social.incoming.length} />
            <TabButton active={tab === "messages"} onClick={() => setTab("messages")} label="Messages" count={social.unreadDms} />
            <TabButton
              active={tab === "notifications"}
              onClick={() => {
                setTab("notifications");
                social.actions.markNotificationsRead();
              }}
              label="Alerts"
              count={social.unreadNotifs}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
            {tab === "friends" && <FriendsTab social={social} inRoom={inRoom} />}
            {tab === "messages" && <MessagesTab social={social} />}
            {tab === "notifications" && (
              <NotificationsTab social={social} onJoin={(code) => router.push(`/room/${code}`)} />
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-500"
        title="Friends & messages"
      >
        <Icon name={open ? "close" : "users"} size={24} />
        {!open && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1.5 py-2.5 font-semibold",
        active ? "border-b-2 border-sky-500 text-white" : "text-muted hover:opacity-80",
      )}
    >
      {label}
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

function ProfileHeader() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(getProfile()?.displayName ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ displayName: name }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setProfile(data.profile);
        setPreferredName(data.profile.displayName);
        window.location.reload(); // reconnect socket with the new display name
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
        {(getProfile()?.displayName ?? "?").charAt(0).toUpperCase()}
      </span>
      {editing ? (
        <>
          <input
            className="min-w-0 flex-1 rounded surface-2 px-2 py-1 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button onClick={save} disabled={busy} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
            Save
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 truncate text-sm font-semibold">{getProfile()?.displayName}</span>
          <button onClick={() => setEditing(true)} className="text-xs text-sky-400 hover:underline">
            Edit
          </button>
        </>
      )}
    </div>
  );
}

function FriendsTab({ social, inRoom }: { social: ReturnType<typeof useSocial>; inRoom: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [sent, setSent] = useState<Record<string, string>>({});
  const friendIds = new Set(social.friends.map((f) => f.userId));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      social.actions.searchUsers(q).then(setResults);
    }, 250);
    return () => clearTimeout(t);
  }, [query, social.actions]);

  async function add(u: PublicUser) {
    const res = await social.actions.addFriend(u.username);
    setSent((s) => ({ ...s, [u.userId]: res.ok ? "Sent" : res.error ?? "Failed" }));
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2 rounded surface-2 px-2 py-1.5 ring-1 ring-[var(--border)] focus-within:ring-sky-500">
        <Icon name="search" size={15} />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder="Search players by username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results.length > 0 && (
        <div>
          {results.map((u) => {
            const isFriend = friendIds.has(u.userId);
            const status = sent[u.userId];
            return (
              <div key={u.userId} className="mb-1 flex items-center gap-2 rounded surface-2 px-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{u.displayName}</span>
                  <span className="block truncate text-xs text-muted">@{u.username}</span>
                </span>
                {isFriend ? (
                  <span className="text-xs text-muted">Friend</span>
                ) : status ? (
                  <span className="text-xs text-muted">{status}</span>
                ) : (
                  <button onClick={() => add(u)} className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500">
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted">No players found.</p>
      )}

      {social.incoming.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-muted">Requests</p>
          {social.incoming.map((r) => (
            <div key={r.id} className="mb-1 flex items-center gap-2 rounded surface-2 px-2 py-1.5 text-sm">
              <span className="flex-1 truncate">{r.from.displayName}</span>
              <button onClick={() => social.actions.respond(r.id, true)} className="text-emerald-400" title="Accept">
                <Icon name="check" size={16} />
              </button>
              <button onClick={() => social.actions.respond(r.id, false)} className="text-red-400" title="Decline">
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-bold uppercase text-muted">Friends ({social.friends.length})</p>
        {social.friends.length === 0 && <p className="text-xs text-muted">No friends yet. Add someone by username.</p>}
        {social.friends.map((f) => (
          <div key={f.userId} className="mb-1 flex items-center gap-2 rounded surface-2 px-2 py-1.5 text-sm">
            <span className={clsx("h-2 w-2 rounded-full", f.online ? "bg-emerald-400" : "bg-slate-500")} />
            <span className="flex-1 truncate">{f.displayName}</span>
            <button onClick={() => social.actions.openConversation(f)} className="text-sky-400" title="Message">
              <Icon name="rules" size={15} />
            </button>
            {inRoom && (
              <button
                onClick={() => social.actions.invite(f.userId)}
                className="text-amber-400"
                title="Invite to game"
              >
                <Icon name="play" size={15} />
              </button>
            )}
            <button onClick={() => social.actions.removeFriend(f.userId)} className="text-red-400" title="Remove">
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesTab({ social }: { social: ReturnType<typeof useSocial> }) {
  if (social.openWith) return <DMThread social={social} partner={social.openWith} />;
  return (
    <div className="p-3">
      {social.conversations.length === 0 && (
        <p className="text-sm text-muted">No conversations yet. Message a friend from the Friends tab.</p>
      )}
      {social.conversations.map((c) => (
        <button
          key={c.user.userId}
          onClick={() => social.actions.openConversation(c.user)}
          className="mb-1 flex w-full items-center gap-2 rounded surface-2 px-2 py-2 text-left text-sm hover:brightness-110"
        >
          <span className={clsx("h-2 w-2 rounded-full", c.online ? "bg-emerald-400" : "bg-slate-500")} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c.user.displayName}</span>
            <span className="block truncate text-xs text-muted">{c.lastMessage?.body ?? ""}</span>
          </span>
          {c.unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {c.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function DMThread({ social, partner }: { social: ReturnType<typeof useSocial>; partner: PublicUser }) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [social.messages.length]);

  function send() {
    if (!text.trim()) return;
    social.actions.sendDm(text);
    setText("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <button onClick={social.actions.closeConversation} className="text-muted" title="Back">
          <Icon name="exit" size={16} />
        </button>
        <span className="font-semibold">{partner.displayName}</span>
      </div>
      <div ref={scrollRef} className="thin-scroll flex-1 space-y-1.5 overflow-y-auto p-3">
        {social.messages.map((m) => (
          <MessageBubble key={m.id} m={m} mine={m.fromUserId === social.myId} />
        ))}
      </div>
      <div className="flex gap-2 border-t border-[var(--border)] p-2">
        <input
          className="min-w-0 flex-1 rounded surface-2 px-2 py-1.5 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
          placeholder="Message…"
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} className="rounded bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-500">
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ m, mine }: { m: DMView; mine: boolean }) {
  return (
    <div className={clsx("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm",
          mine ? "bg-sky-600 text-white" : "surface-2",
        )}
      >
        <span className="whitespace-pre-wrap break-words">{m.body}</span>
        {mine && (
          <span className="ml-2 inline-flex translate-y-0.5 items-center" title={m.seenAt ? "Seen" : m.deliveredAt ? "Delivered" : "Sent"}>
            <Icon name="check" size={12} className={clsx(m.seenAt ? "text-sky-200" : "text-white/70")} />
            {m.deliveredAt && (
              <Icon name="check" size={12} className={clsx("-ml-1.5", m.seenAt ? "text-sky-200" : "text-white/70")} />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function NotificationsTab({
  social,
  onJoin,
}: {
  social: ReturnType<typeof useSocial>;
  onJoin: (code: string) => void;
}) {
  return (
    <div className="p-3">
      {social.notifications.length === 0 && <p className="text-sm text-muted">No notifications.</p>}
      {social.notifications.map((n) => (
        <div key={n.id} className="mb-1 flex items-center gap-2 rounded surface-2 px-2 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{n.text}</span>
          {n.type === "game_invite" && n.roomCode && (
            <button
              onClick={() => onJoin(n.roomCode!)}
              className="shrink-0 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Join
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
