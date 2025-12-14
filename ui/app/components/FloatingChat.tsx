"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  useChat,
  handleChatKeyDown,
  handlePasteWithImages,
  fileToImageAttachment,
} from "../hooks/useChat";
import { Message, ToolCall, ImageAttachment } from "../types";

function ImagePreview({
  images,
  onRemove,
}: {
  images: ImageAttachment[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img, i) => (
        <div key={i} className="relative group">
          <img
            src={img.data}
            alt={`Attachment ${i + 1}`}
            className="h-12 w-12 object-cover rounded-lg"
            style={{ border: "1px solid var(--border)" }}
          />
          <button
            onClick={() => onRemove(i)}
            className="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "var(--accent)" }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function MessageImages({
  images,
  onImageClick,
}: {
  images?: ImageAttachment[];
  onImageClick?: (src: string) => void;
}) {
  if (!images || images.length === 0) return null;

  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img, i) => (
        <img
          key={i}
          src={img.data}
          alt={`Image ${i + 1}`}
          onClick={() => onImageClick?.(img.data)}
          className="max-h-32 max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          style={{ border: "1px solid var(--border)" }}
        />
      ))}
    </div>
  );
}

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl"
      >
        ×
      </button>
      <img
        src={src}
        alt="Expanded view"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function MessageBubble({
  msg,
  onCopy,
  onImageClick,
}: {
  msg: Message;
  onCopy: (text: string) => void;
  onImageClick?: (src: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div
        className="px-3 py-2 rounded-2xl max-w-[80%] text-sm"
        style={{ background: "var(--user-bubble)", color: "var(--foreground)" }}
      >
        <MessageImages images={msg.images} onImageClick={onImageClick} />
        <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] group">
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <ToolCallsList toolCalls={msg.toolCalls} />
      )}
      <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
      <button
        onClick={() => onCopy(msg.content)}
        className="mt-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--muted)" }}
      >
        copy
      </button>
    </div>
  );
}

function ToolCallsList({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div className="mb-2 space-y-1">
      {toolCalls.map((tc, j) => (
        <div
          key={j}
          className="text-xs font-mono break-all"
          style={{ color: "var(--muted)" }}
        >
          <span style={{ color: "var(--accent)" }}>→</span> {tc.name}
        </div>
      ))}
    </div>
  );
}

function StreamingMessage({
  toolCalls,
  content,
}: {
  toolCalls: ToolCall[];
  content: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        {toolCalls.length > 0 && <ToolCallsList toolCalls={toolCalls} />}
        {content ? (
          <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: "var(--accent)", animationDelay: "0ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: "var(--accent)", animationDelay: "150ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: "var(--accent)", animationDelay: "300ms" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const {
    messages,
    input,
    setInput,
    images,
    addImage,
    removeImage,
    loading,
    streamingToolCalls,
    streamingContent,
    sendMessage,
    clearChat,
  } = useChat();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen && !expandedImage) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, expandedImage]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleKeyDownLocal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleChatKeyDown(e, input, setInput, () => sendMessage());
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    await handlePasteWithImages(e, addImage);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of files) {
      const attachment = await fileToImageAttachment(file);
      if (attachment) {
        addImage(attachment);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Floating window */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Quick Chat
          </span>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs transition-colors hover:opacity-70"
                style={{ color: "var(--muted)" }}
              >
                clear
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs transition-colors hover:opacity-70"
              style={{ color: "var(--muted)" }}
            >
              esc
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>
              Ask Bernd anything...
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <MessageBubble
                msg={msg}
                onCopy={handleCopy}
                onImageClick={setExpandedImage}
              />
            </div>
          ))}

          {loading && (
            <StreamingMessage
              toolCalls={streamingToolCalls}
              content={streamingContent}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
          <ImagePreview images={images} onRemove={removeImage} />
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDownLocal}
              onPaste={handlePaste}
              placeholder="message..."
              disabled={loading}
              rows={2}
              className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none disabled:opacity-50 transition-colors resize-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
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
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-2 bottom-2 p-1 transition-colors hover:opacity-70"
              style={{ color: "var(--muted)" }}
              title="Attach image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {expandedImage && (
        <ImageModal src={expandedImage} onClose={() => setExpandedImage(null)} />
      )}
    </>
  );
}
