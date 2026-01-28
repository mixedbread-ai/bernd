"use client";

import { ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  fileToImageAttachment,
  handleChatKeyDown,
  handlePasteWithImages,
  useChat,
} from "../hooks/use-chat";
import type { Message, ToolCall } from "../types";
import {
  ImageModal,
  ImagePreview,
  MessageImages,
  ToolCallsList,
} from "./chat";

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

interface MessageBubbleProps {
  msg: Message;
  onCopy: (text: string) => void;
  onImageClick?: (src: string) => void;
}

function MessageBubble({ msg, onCopy, onImageClick }: MessageBubbleProps) {
  if (msg.role === "user") {
    return (
      <div className="px-3 py-2 rounded-2xl max-w-[80%] text-sm bg-user-bubble text-foreground">
        <MessageImages
          images={msg.images}
          onImageClick={onImageClick}
          maxHeight="small"
        />
        <div className="prose prose-sm max-w-none text-foreground">
          <ReactMarkdown components={markdownComponents}>
            {msg.content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] group">
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <ToolCallsList toolCalls={msg.toolCalls} />
      )}
      <div className="prose prose-sm max-w-none text-foreground">
        <ReactMarkdown components={markdownComponents}>
          {msg.content}
        </ReactMarkdown>
      </div>
      <button
        type="button"
        onClick={() => onCopy(msg.content)}
        className="mt-1 text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted"
      >
        copy
      </button>
    </div>
  );
}

interface StreamingMessageProps {
  toolCalls: ToolCall[];
  content: string;
}

function StreamingMessage({ toolCalls, content }: StreamingMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        {toolCalls.length > 0 && <ToolCallsList toolCalls={toolCalls} />}
        {content ? (
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
              style={{ animationDelay: "300ms" }}
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
  }, []);

  function handleKeyDownLocal(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    handleChatKeyDown(e, input, setInput, () => sendMessage());
  }

  async function handlePaste(e: React.ClipboardEvent) {
    await handlePasteWithImages(e, addImage);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

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
                className="text-xs transition-colors hover:opacity-70 text-muted"
              >
                clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs transition-colors hover:opacity-70 text-muted"
            >
              esc
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center text-sm py-8 text-muted">
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
        <div className="p-3 border-t border-border">
          <ImagePreview images={images} onRemove={removeImage} size="small" />
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
              className="absolute right-2 bottom-2 p-1 transition-colors hover:opacity-70 text-muted"
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
