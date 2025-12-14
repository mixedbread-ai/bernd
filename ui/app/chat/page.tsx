"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useChat, handleChatKeyDown } from "../hooks/useChat";
import { Message, ToolCall, ChatSummary } from "../types";
import { API_ENDPOINTS } from "../config";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-[#c4c4c4] hover:text-[#888] transition-colors"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function ToolCallsList({
  toolCalls,
  showArgs = false,
}: {
  toolCalls: ToolCall[];
  showArgs?: boolean;
}) {
  return (
    <div className="mb-2 space-y-1">
      {toolCalls.map((tc, j) => (
        <div key={j} className="text-xs text-[#a8a8a8] font-mono break-all">
          <span className="text-[#c45d3a]">→</span> {tc.name}
          {showArgs && (
            <span className="text-[#c4c4c4] ml-1">
              ({JSON.stringify(tc.args)})
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatSearch, setChatSearch] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    streamingToolCalls,
    streamingContent,
    sendMessage,
    clearChat,
  } = useChat({
    onChatSaved: (newChatId) => {
      setChatId(newChatId);
      fetchChats();
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom();
    }
  }, [messages, streamingContent, streamingToolCalls, userScrolledUp]);

  // Detect if user scrolled up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setUserScrolledUp(!isNearBottom);
  };

  // Reset scroll state when loading starts
  useEffect(() => {
    if (loading) {
      setUserScrolledUp(false);
    }
  }, [loading]);

  // Fetch chat list on mount
  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.chats);
      const data = await res.json();
      setChats(data);
    } catch (e) {
      console.error("Failed to fetch chats", e);
    }
  };

  const loadChat = async (id: string) => {
    try {
      const res = await fetch(API_ENDPOINTS.chatById(id));
      const data = await res.json();
      if (data.error) {
        console.error("Chat not found:", data.error);
        return;
      }
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setChatId(id);
      }
    } catch (e) {
      console.error("Failed to load chat", e);
    }
  };

  const startNewChat = () => {
    clearChat();
    setChatId(null);
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering loadChat
    try {
      await fetch(API_ENDPOINTS.chatById(id), { method: "DELETE" });
      // If we deleted the current chat, start a new one
      if (chatId === id) {
        startNewChat();
      }
      fetchChats();
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleKeyDownLocal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleChatKeyDown(e, input, setInput, () => sendMessage(chatId));
  };

  // Filter chats by search
  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(chatSearch.toLowerCase())
  );

  // Right sidebar with chat history
  const ChatSidebar = () => (
    <div className="fixed right-0 top-0 h-screen w-64 border-l border-[#e8e6e3] bg-[#faf9f7] px-4 py-6 flex flex-col">
      <button
        onClick={startNewChat}
        className="w-full text-left text-sm text-[#666] hover:text-[#1a1a1a] mb-4 transition-colors"
      >
        + new chat
      </button>

      <input
        type="text"
        value={chatSearch}
        onChange={(e) => setChatSearch(e.target.value)}
        placeholder="search chats..."
        className="w-full bg-white/50 border border-[#e8e6e3] rounded px-3 py-2 text-xs outline-none placeholder:text-[#c4c4c4] focus:border-[#c45d3a] transition-colors mb-4"
      />

      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {filteredChats.map((chat) => (
            <li key={chat.id} className="group/item relative">
              <button
                onClick={() => loadChat(chat.id)}
                className={`w-full text-left px-2 py-1.5 pr-8 text-xs rounded transition-colors truncate ${
                  chatId === chat.id
                    ? "bg-[#e8e6e3] text-[#1a1a1a]"
                    : "text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0efed]"
                }`}
              >
                {chat.title}
              </button>
              <button
                onClick={(e) => deleteChat(chat.id, e)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[#c4c4c4] hover:text-[#c45d3a] opacity-0 group-hover/item:opacity-100 transition-opacity"
                title="Delete chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // Empty state - centered input
  if (messages.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center text-[#1a1a1a] px-6 mr-64">
        <div className="w-full max-w-lg text-center mb-8">
          <h1 className="text-3xl font-light text-[#1a1a1a]">Hey Aamir</h1>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDownLocal}
          placeholder="How can I help you today?"
          autoFocus
          rows={3}
          className="w-full max-w-lg bg-white border border-[#e0ded9] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-3 text-sm outline-none placeholder:text-[#a8a8a8] focus:border-[#c45d3a] focus:shadow-[0_2px_12px_rgba(196,93,58,0.08)] transition-all resize-none"
        />
        <ChatSidebar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col text-[#1a1a1a] mr-64">
      <ChatSidebar />

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto flex justify-center"
      >
        <div className="w-full max-w-2xl px-6 py-12 pb-40">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-6 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="bg-[#e8e6e3] text-[#1a1a1a] px-4 py-2 rounded-2xl max-w-[80%] text-sm prose prose-sm prose-neutral max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="max-w-[85%] group/msg">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <ToolCallsList toolCalls={msg.toolCalls} showArgs />
                  )}
                  <div className="prose prose-sm prose-neutral max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  <div className="mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <CopyButton text={msg.content} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="mb-6 flex justify-start">
              <div className="max-w-[85%]">
                {streamingToolCalls.length > 0 && (
                  <ToolCallsList toolCalls={streamingToolCalls} showArgs />
                )}
                {streamingContent ? (
                  <div className="prose prose-sm prose-neutral max-w-none">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-[#a8a8a8]">...</div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="fixed bottom-6 left-44 right-64 flex justify-center px-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDownLocal}
          placeholder="message..."
          disabled={loading}
          autoFocus
          rows={3}
          className="w-full max-w-2xl bg-white/80 backdrop-blur border border-[#e0ded9] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-3 text-sm outline-none placeholder:text-[#c4c4c4] disabled:opacity-50 focus:border-[#c45d3a] focus:shadow-[0_2px_12px_rgba(196,93,58,0.08)] transition-all resize-none"
        />
      </div>
    </div>
  );
}
