"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useImageAttachments } from "@/hooks/use-image-attachments";
import { handleChatKeyDown, imagesToFileParts } from "@/lib/chat-utils";
import { cn } from "@/lib/utils/ui";
import { AssistantMessage } from "@/components/chat/assistant-message";
import { ImageModal } from "@/components/chat/image-modal";
import { ImagePreview } from "@/components/chat/image-preview";
import { StreamingIndicator } from "@/components/chat/streaming-indicator";
import { UserMessage } from "@/components/chat/user-message";

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
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

  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen || !isStreaming) {
          setIsOpen((prev) => !prev);
        }
      }
      if (e.key === "Escape" && isOpen && !expandedImage && !isStreaming) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isStreaming, expandedImage]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to bottom
  // biome-ignore lint/correctness/useExhaustiveDependencies: -
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if ((!input.trim() && images.length === 0) || isStreaming) return;
    const text = input;
    setInput("");
    setImages([]);

    const fileParts = imagesToFileParts(images);

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

  function clearChat() {
    setMessages([]);
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={() => !isStreaming && setIsOpen(false)}
      />

      {/* Floating window */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden bg-background border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            Quick Chat
          </span>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                disabled={isStreaming}
                className="text-xs transition-colors hover:opacity-70 text-muted disabled:opacity-30"
              >
                clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isStreaming}
              className="text-xs transition-colors hover:opacity-70 text-muted disabled:opacity-30"
            >
              esc
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center text-sm py-8 text-muted">
              Ask Bernd anything...
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {message.role === "user" ? (
                <UserMessage
                  message={message}
                  onImageClick={setExpandedImage}
                  size="compact"
                />
              ) : (
                <AssistantMessage message={message} status={status} />
              )}
            </div>
          ))}

          {status === "submitted" && <StreamingIndicator size="compact" />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <ImagePreview
            images={images}
            onRemove={removeImage}
            size="small"
            disabled={isStreaming}
          />
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDownLocal}
              onPaste={handlePaste}
              placeholder="message..."
              disabled={isStreaming}
              rows={2}
              className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none disabled:opacity-50 transition-colors resize-none bg-surface border border-border text-foreground focus:border-accent"
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
              className="absolute right-2 bottom-2 p-1 transition-colors hover:opacity-70 text-muted disabled:opacity-30"
              title="Attach image"
            >
              <ImageIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {expandedImage && (
        <ImageModal
          src={expandedImage}
          onClose={() => setExpandedImage(null)}
        />
      )}
    </>
  );
}
