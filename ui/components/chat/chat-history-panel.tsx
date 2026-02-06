"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { deleteChatAction } from "@/actions/chats";
import { useChatHistory } from "@/context/chat-history-context";
import { useAutoFocus } from "@/hooks/use-auto-focus";
import { cn } from "@/lib/utils/ui";
import type { ChatSummary } from "@/types";

export function ChatHistoryPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { isHistoryOpen, setIsHistoryOpen, chats } = useChatHistory();
  const [, startTransition] = useTransition();
  const [optimisticChats, setOptimisticChats] = useOptimistic(
    chats,
    (state: ChatSummary[], action: { type: "delete"; id: string }) =>
      state.filter((chat) => chat.id !== action.id),
  );
  const [chatSearch, setChatSearch] = useState("");
  const searchInputRef = useAutoFocus<HTMLInputElement>(isHistoryOpen);

  const activeChatId = pathname.startsWith("/chat/")
    ? pathname.slice("/chat/".length)
    : null;

  const filteredChats = useMemo(
    () =>
      optimisticChats.filter((chat) =>
        chat.title.toLowerCase().includes(chatSearch.toLowerCase()),
      ),
    [optimisticChats, chatSearch],
  );

  if (!isHistoryOpen) return null;

  function loadChat(id: string) {
    setIsHistoryOpen(false);
    router.push(`/chat/${id}`);
  }

  function startNewChat() {
    setIsHistoryOpen(false);
    router.push("/chat");
  }

  function deleteChat(id: string) {
    startTransition(async () => {
      setOptimisticChats({ type: "delete", id });
      try {
        await deleteChatAction(id, activeChatId === id);
      } catch {
        alert("Failed to delete chat.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40" onClick={() => setIsHistoryOpen(false)}>
      <div
        className="absolute left-0 md:left-44 top-0 h-full w-72 shadow-xl p-4 overflow-hidden flex flex-col bg-background border-r border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-foreground">History</h2>
          <button
            type="button"
            onClick={startNewChat}
            className="text-xs transition-colors hover:opacity-70 text-accent rounded"
          >
            + new
          </button>
        </div>

        <label className="sr-only" htmlFor="chat-search">
          Search chats
        </label>
        <input
          id="chat-search"
          ref={searchInputRef}
          type="text"
          value={chatSearch}
          onChange={(e) => setChatSearch(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors mb-3 bg-surface border border-border text-foreground"
        />

        <div className="flex-1 overflow-y-auto -mx-2">
          {filteredChats.length === 0 ? (
            <p className="text-xs px-2 text-muted">No chats yet</p>
          ) : (
            <ul className="space-y-0.5">
              {filteredChats.map((chat) => (
                <li key={chat.id} className="group/item relative">
                  <button
                    type="button"
                    onClick={() => loadChat(chat.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 pr-8 text-xs rounded-lg transition-colors",
                      activeChatId === chat.id
                        ? "bg-surface-hover text-foreground"
                        : "text-muted",
                    )}
                  >
                    <div className="truncate">{chat.title}</div>
                    <div className="text-[10px] mt-0.5 text-muted">
                      {chat.message_count} messages
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity hover:opacity-70 text-accent rounded"
                  >
                    <XIcon size={12} aria-hidden="true" />
                    <span className="sr-only">Delete chat</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
