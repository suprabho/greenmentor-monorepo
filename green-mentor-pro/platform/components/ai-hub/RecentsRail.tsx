"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Plus, PencilSimple, Trash, Check, X } from "@phosphor-icons/react";
import type { Conversation } from "@/lib/chat/types";

/** Left rail of the Chat tab: conversation history with new / rename / delete. */
export function RecentsRail({ conversations }: { conversations: Conversation[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function remove(id: string) {
    await fetch(`/api/ai-hub/chat/conversations/${id}`, { method: "DELETE" });
    if (pathname.includes(id)) router.push("/ai-hub/chat");
    router.refresh();
  }

  async function commitRename(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    await fetch(`/api/ai-hub/chat/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="shrink-0 p-3">
        <Link
          href="/ai-hub/chat"
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-teal-700 hover:text-teal-800"
        >
          <Plus size={16} weight="bold" />
          New chat
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recents</div>
        {conversations.length === 0 ? (
          <p className="px-2 py-1 text-[12.5px] text-gray-400">No chats yet.</p>
        ) : (
          conversations.map((c) => {
            const active = pathname === `/ai-hub/chat/${c.id}`;
            if (renamingId === c.id) {
              return (
                <div key={c.id} className="flex items-center gap-1 px-2 py-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(c.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12.5px] outline-none focus:border-teal-700"
                  />
                  <button onClick={() => commitRename(c.id)} className="text-green-700 hover:text-green-800" aria-label="Save">
                    <Check size={15} weight="bold" />
                  </button>
                  <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
                    <X size={15} weight="bold" />
                  </button>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className={clsx(
                  "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  active ? "bg-teal-900/[0.06]" : "hover:bg-gray-50"
                )}
              >
                <Link href={`/ai-hub/chat/${c.id}`} className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {c.title ?? "New chat"}
                </Link>
                <button
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameValue(c.title ?? "");
                  }}
                  className="hidden shrink-0 text-gray-400 hover:text-gray-700 group-hover:block"
                  aria-label="Rename"
                >
                  <PencilSimple size={14} />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="hidden shrink-0 text-gray-400 hover:text-danger group-hover:block"
                  aria-label="Delete"
                >
                  <Trash size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
