"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Global Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
        body: JSON.stringify({ messages: newMessages }),
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
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }

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
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = input.slice(0, start) + "\n" + input.slice(end);
        setInput(newValue);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 1;
        }, 0);
        return;
      }
      e.preventDefault();
      sendMessage();
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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[80vh] bg-[#faf9f7] border border-[#e0ded9] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e6e3]">
          <span className="text-sm font-medium text-[#1a1a1a]">Quick Chat</span>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setStreamingContent("");
                  setStreamingToolCalls([]);
                }}
                className="text-xs text-[#a8a8a8] hover:text-[#1a1a1a] transition-colors"
              >
                clear
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#a8a8a8] hover:text-[#1a1a1a] transition-colors"
            >
              esc
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center text-[#a8a8a8] text-sm py-8">
              Ask Bernd anything...
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="bg-[#e8e6e3] text-[#1a1a1a] px-3 py-2 rounded-2xl max-w-[80%] text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] group">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.toolCalls.map((tc, j) => (
                        <div key={j} className="text-xs text-[#a8a8a8] font-mono break-all">
                          <span className="text-[#c45d3a]">→</span> {tc.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="prose prose-sm prose-neutral max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="mt-1 text-xs text-[#c4c4c4] hover:text-[#888] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    copy
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                {streamingToolCalls.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {streamingToolCalls.map((tc, j) => (
                      <div key={j} className="text-xs text-[#a8a8a8] font-mono">
                        <span className="text-[#c45d3a]">→</span> {tc.name}
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

        {/* Input */}
        <div className="border-t border-[#e8e6e3] p-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="message..."
            disabled={loading}
            rows={2}
            className="w-full bg-white border border-[#e0ded9] rounded-lg px-3 py-2 text-sm outline-none placeholder:text-[#c4c4c4] disabled:opacity-50 focus:border-[#c45d3a] transition-colors resize-none"
          />
        </div>
      </div>
    </>
  );
}
