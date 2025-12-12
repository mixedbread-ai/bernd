"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

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

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

interface ChatSummary {
  id: string;
  title: string;
  message_count: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatSearch, setChatSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

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
      const res = await fetch("http://localhost:8000/chats");
      const data = await res.json();
      setChats(data);
    } catch (e) {
      console.error("Failed to fetch chats", e);
    }
  };

  const loadChat = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/chats/${id}`);
      const data = await res.json();
      console.log("Loaded chat:", data);
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
    setMessages([]);
    setChatId(null);
    setStreamingContent("");
    setStreamingToolCalls([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreamingToolCalls([]);
    setStreamingContent("");

    try {
      const res = await fetch("http://localhost:8000/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, chat_id: chatId }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const toolCalls: ToolCall[] = [];
      let finalContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "tool_call") {
                  toolCalls.push({ name: data.name, args: data.args });
                  setStreamingToolCalls([...toolCalls]);
                } else if (data.type === "text_delta") {
                  finalContent += data.delta;
                  setStreamingContent(finalContent);
                } else if (data.type === "response_end") {
                  finalContent = data.content;
                  setStreamingContent(finalContent);
                } else if (data.type === "chat_saved") {
                  setChatId(data.chat_id);
                  fetchChats(); // Refresh chat list
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }

      // Finalize message
      setMessages([
        ...newMessages,
        { role: "assistant", content: finalContent, toolCalls },
      ]);
      setStreamingToolCalls([]);
      setStreamingContent("");
    } catch (e) {
      console.error("Chat failed", e);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "(failed to get response)" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        // Cmd+Enter, Ctrl+Enter, or Shift+Enter = new line
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = input.slice(0, start) + "\n" + input.slice(end);
        setInput(newValue);
        // Set cursor position after the newline
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 1;
        }, 0);
        return;
      }
      // Plain Enter = send
      e.preventDefault();
      sendMessage();
    }
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
            <li key={chat.id}>
              <button
                onClick={() => loadChat(chat.id)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors truncate ${
                  chatId === chat.id
                    ? "bg-[#e8e6e3] text-[#1a1a1a]"
                    : "text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0efed]"
                }`}
              >
                {chat.title}
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
          <h1 className="text-3xl font-light text-[#1a1a1a]">
            Hey Aamir
          </h1>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
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
            <div key={i} className={`mb-6 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "user" ? (
                <div className="bg-[#e8e6e3] text-[#1a1a1a] px-4 py-2 rounded-2xl max-w-[80%] text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] group/msg">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.toolCalls.map((tc, j) => (
                        <div key={j} className="text-xs text-[#a8a8a8] font-mono break-all">
                          <span className="text-[#c45d3a]">→</span> {tc.name}
                          <span className="text-[#c4c4c4] ml-1">({JSON.stringify(tc.args)})</span>
                        </div>
                      ))}
                    </div>
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
                  <div className="mb-2 space-y-1">
                    {streamingToolCalls.map((tc, j) => (
                      <div key={j} className="text-xs text-[#a8a8a8] font-mono break-all">
                        <span className="text-[#c45d3a]">→</span> {tc.name}
                        <span className="text-[#c4c4c4] ml-1">({JSON.stringify(tc.args)})</span>
                      </div>
                    ))}
                  </div>
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
          onKeyDown={handleKeyDown}
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
