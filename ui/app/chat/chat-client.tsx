"use client";

import { ClockIcon, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  CopyButton,
  ImageModal,
  ImagePreview,
  MessageImages,
  ToolCallsList,
} from "@/components/chat";
import { useChatHistory } from "@/context/chat-history-context";
import {
  fileToImageAttachment,
  handleChatKeyDown,
  handlePasteWithImages,
  useChat,
} from "@/hooks/use-chat";
import type { Chat } from "@/lib/data/chats";
import type { ToolCall } from "@/types";

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

interface ChatClientProps {
  initialChat?: Chat;
}

export function ChatClient({ initialChat }: ChatClientProps) {
  const router = useRouter();
  const { setIsHistoryOpen, chats } = useChatHistory();
  const [chatId, setChatId] = useState<string | null>(initialChat?.id ?? null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    loadChat: loadChatMessages,
  } = useChat({
    onChatSaved: (newChatId) => {
      setChatId(newChatId);
      window.history.pushState(null, "", `/chat/${newChatId}`);
    },
  });

  // Load initial chat messages when provided via server component
  const initialChatLoadedRef = useRef(false);
  useEffect(() => {
    if (initialChat && !initialChatLoadedRef.current) {
      initialChatLoadedRef.current = true;
      loadChatMessages(initialChat.id, initialChat.messages);
    }
  }, [initialChat, loadChatMessages]);

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
  }, [
    messages,
    streamingContent,
    streamingToolCalls,
    userScrolledUp,
    scrollToBottom,
  ]);

  // Track previous messages to detect new user messages
  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        // Reset scroll state when user sends a new message
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
    clearChat();
    setChatId(null);
    router.push("/chat");
  }

  function handleKeyDownLocal(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    handleChatKeyDown(e, input, setInput, () => sendMessage(chatId));
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

  // Input element
  const inputElement = (
    <div className="w-full">
      <ImagePreview images={images} onRemove={removeImage} size="medium" />
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDownLocal}
          onPaste={handlePaste}
          placeholder="Ask anything..."
          disabled={loading}
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
  );

  // Empty state
  if (messages.length === 0 && !loading) {
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

            {inputElement}

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

        {expandedImage && (
          <ImageModal
            src={expandedImage}
            onClose={() => setExpandedImage(null)}
          />
        )}
      </div>
    );
  }

  // Chat view
  return (
    <div className="h-svh flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 backdrop-blur sticky top-0 z-10 border-b border-border bg-background">
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center gap-2 text-sm transition-colors hover:opacity-70 text-muted"
        >
          <ClockIcon size={16} />
          <span className="hidden sm:inline">History</span>
          {chats.length > 0 && (
            <span className="text-xs text-muted">({chats.length})</span>
          )}
        </button>

        <button
          type="button"
          onClick={startNewChat}
          className="text-xs transition-colors hover:opacity-70 text-accent"
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
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-6 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="px-4 py-2.5 rounded-2xl max-w-[80%] text-sm bg-user-bubble text-foreground">
                  <MessageImages
                    images={msg.images}
                    onImageClick={setExpandedImage}
                  />
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] group/msg">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <ToolCallsList toolCalls={msg.toolCalls} />
                  )}
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-1 opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity">
                    <CopyButton text={msg.content} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <StreamingIndicator
              toolCalls={streamingToolCalls}
              content={streamingContent}
            />
          )}

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

interface StreamingIndicatorProps {
  toolCalls: ToolCall[];
  content: string;
}

function StreamingIndicator({ toolCalls, content }: StreamingIndicatorProps) {
  return (
    <div className="mb-6 flex justify-start">
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
              className="w-2 h-2 rounded-full animate-bounce bg-accent"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce bg-accent"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce bg-accent"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
