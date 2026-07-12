"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { RoomView } from "@shared/protocol";
import type { RoomActions } from "@/hooks/useRoom";

export default function Chat({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view.chat.length]);

  function send() {
    const t = text.trim();
    if (!t) return;
    actions.sendChat(t);
    setText("");
  }

  return (
    <div className="surface flex h-full min-h-0 flex-col rounded-xl">
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold text-muted">
        Chat &amp; log
      </div>
      <div ref={scrollRef} className="thin-scroll flex-1 space-y-1 overflow-y-auto p-3 text-sm">
        {view.chat.map((m) => (
          <div key={m.id}>
            {m.system ? (
              <p className="italic text-muted">{m.text}</p>
            ) : (
              <p>
                <span
                  className={clsx(
                    "font-semibold",
                    m.team === "red" && "text-red-400",
                    m.team === "blue" && "text-sky-400",
                    !m.team && "text-muted",
                  )}
                >
                  {m.authorName}:
                </span>{" "}
                <span>{m.text}</span>
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-[var(--border)] p-2">
        <input
          className="flex-1 rounded bg-[var(--surface-2)] px-3 py-2 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-sky-500"
          placeholder="Message…"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-500">
          Send
        </button>
      </div>
    </div>
  );
}
