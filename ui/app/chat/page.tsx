"use client";

import { ClockIcon, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImagePreview } from "@/components/chat";
import { useChatHistory } from "@/context/chat-history-context";
import { useImageAttachments } from "@/hooks/use-image-attachments";
import { handleChatKeyDown } from "@/lib/chat-utils";
import { createChat } from "./actions";

// Generate chat ID in Python backend format: YYYYMMDD_HHMMSS
function generateChatId(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export default function NewChatPage() {
  const router = useRouter();
  const { setIsHistoryOpen, chats, setPendingMessage } = useChatHistory();
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const { images, fileInputRef, handlePaste, handleFileSelect, removeImage } = useImageAttachments();

  function handleSubmit() {
    if (!input.trim() && images.length === 0) return;

    const chatId = generateChatId();
    setPendingMessage({ text: input.trim(), images });
    startTransition(async () => {
      await createChat(chatId);
      router.push(`/chat/${chatId}`);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    handleChatKeyDown(e, input, setInput, handleSubmit);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-70 text-muted"
        >
          <ClockIcon size={16} />
          <span>History</span>
          {chats.length > 0 && (
            <span className="text-xs text-muted">({chats.length})</span>
          )}
        </button>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light mb-2 text-foreground">
              What can I help with?
            </h1>
            <p className="text-sm text-muted">
              Ask me anything or pick up where you left off
            </p>
          </div>

          <div className="w-full">
            <ImagePreview
              images={images}
              onRemove={removeImage}
              size="medium"
            />
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Ask anything..."
                disabled={isPending}
                rows={2}
                className="w-full rounded-xl shadow-sm px-4 py-3 pr-12 text-sm outline-none disabled:opacity-50 transition-all resize-none bg-surface border border-border text-foreground min-h-[56px] max-h-[120px] focus:border-accent"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-3 bottom-3 p-1.5 transition-colors hover:opacity-70 text-muted"
                title="Attach image"
              >
                <ImageIcon size={18} />
              </button>
            </div>
          </div>

          {/* Quick actions */}
          {chats.length > 0 && (
            <div className="mt-6">
              <p className="text-xs mb-2 text-muted">Recent</p>
              <div className="flex flex-wrap gap-2">
                {chats.slice(0, 3).map((chat) => (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="text-xs px-3 py-1.5 rounded-full transition-colors truncate max-w-[200px] hover:opacity-80 bg-surface border border-border text-muted"
                  >
                    {chat.title}
                  </button>
                ))}
                {chats.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-80 bg-surface border border-border text-muted"
                  >
                    +{chats.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
