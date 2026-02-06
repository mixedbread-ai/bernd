"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ClockIcon, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantMessage } from "@/components/chat/assistant-message";
import { ImageModal } from "@/components/chat/image-modal";
import { ImagePreview } from "@/components/chat/image-preview";
import { StreamingIndicator } from "@/components/chat/streaming-indicator";
import { UserMessage } from "@/components/chat/user-message";
import { useChatHistory } from "@/context/chat-history-context";
import { useAutoFocus } from "@/hooks/use-auto-focus";
import { useImageAttachments } from "@/hooks/use-image-attachments";
import {
  handleChatKeyDown,
  imagesToFileParts,
  storedMessagesToUIMessages,
} from "@/lib/chat-utils";
import type { Chat } from "@/lib/data/chats";
import { cn } from "@/lib/utils/ui";

interface ChatConversationProps {
  chatId: string;
  initialChat: Chat;
}

export function ChatConversation({
  chatId,
  initialChat,
}: ChatConversationProps) {
  const router = useRouter();
  const { setIsHistoryOpen, chats, pendingMessage, setPendingMessage } =
    useChatHistory();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const {
    images,
    setImages,
    fileInputRef,
    handlePaste,
    handleFileSelect,
    removeImage,
  } = useImageAttachments();
  const textareaRef = useAutoFocus<HTMLTextAreaElement>();

  const initialMessages = useMemo(
    () => storedMessagesToUIMessages(initialChat.messages),
    [initialChat.messages],
  );

  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { chatId },
    }),
    messages: initialMessages,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Handle pending message from new chat page
  const pendingHandledRef = useRef(false);
  useEffect(() => {
    if (pendingMessage && !pendingHandledRef.current) {
      pendingHandledRef.current = true;
      const { text, images: pendingImages } = pendingMessage;
      setPendingMessage(null);

      const fileParts = imagesToFileParts(pendingImages);
      sendMessage({
        role: "user",
        parts: [...fileParts, { type: "text" as const, text: text.trim() }],
      });
    }
  }, [pendingMessage, setPendingMessage, sendMessage]);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll only when not manually scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: -
  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom();
    }
  }, [messages, userScrolledUp, scrollToBottom]);

  // Track previous messages to detect new user messages
  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        setTimeout(() => setUserScrolledUp(false), 0);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  function handleScroll() {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setUserScrolledUp(!isNearBottom);
  }

  function startNewChat() {
    setMessages([]);
    router.push("/chat");
  }

  function handleSend() {
    if ((!input.trim() && images.length === 0) || isStreaming) return;
    const text = input;
    const currentImages = images;
    setInput("");
    setImages([]);

    const fileParts = imagesToFileParts(currentImages);

    if (fileParts.length > 0) {
      sendMessage({
        role: "user",
        parts: [
          ...fileParts,
          ...(text.trim()
            ? [{ type: "text" as const, text: text.trim() }]
            : []),
        ],
      });
    } else {
      sendMessage({ text: text.trim() });
    }
  }

  function handleKeyDownLocal(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    handleChatKeyDown(e, input, setInput, handleSend);
  }

  const inputElement = (
    <div className="w-full">
      <ImagePreview
        images={images}
        onRemove={removeImage}
        size="medium"
        disabled={isStreaming}
      />
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDownLocal}
          onPaste={handlePaste}
          placeholder="Ask anything…"
          disabled={isStreaming}
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
          disabled={isStreaming}
          className="absolute right-3 bottom-3 p-1.5 transition-colors hover:opacity-70 text-muted disabled:opacity-30 rounded"
        >
          <ImageIcon size={18} aria-hidden="true" />
          <span className="sr-only">Attach image</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-svh flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 backdrop-blur sticky top-0 z-10 border-b border-border bg-background">
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-70 text-muted rounded"
        >
          <ClockIcon size={16} aria-hidden="true" />
          <span className="hidden sm:inline">History</span>
          {chats.length > 0 && (
            <span className="text-xs text-muted">({chats.length})</span>
          )}
        </button>

        <button
          type="button"
          onClick={startNewChat}
          className="text-xs transition-colors hover:opacity-70 text-accent rounded"
        >
          + New chat
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-64 md:pb-48">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "mb-6 flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {message.role === "user" ? (
                <UserMessage
                  message={message}
                  onImageClick={setExpandedImage}
                />
              ) : (
                <AssistantMessage message={message} status={status} />
              )}
            </div>
          ))}

          {status === "submitted" && <StreamingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed input */}
      <div
        className="fixed bottom-0 left-0 md:left-44 right-0 pt-4 pb-20 md:pb-3 px-4 md:px-6"
        style={{
          background: `linear-gradient(to top, var(--background), var(--background), transparent)`,
        }}
      >
        <div className="max-w-2xl mx-auto">{inputElement}</div>
      </div>

      {expandedImage && (
        <ImageModal
          src={expandedImage}
          onClose={() => setExpandedImage(null)}
        />
      )}
    </div>
  );
}
