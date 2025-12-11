"use client";

import { useState, useRef, useEffect } from "react";
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, streamingToolCalls]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Empty state - centered input
  if (messages.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center text-[#1a1a1a] px-6">
        <div className="w-full max-w-lg text-center mb-8">
          <h1 className="text-3xl font-light text-[#1a1a1a]">
            Hey Aamir
          </h1>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          autoFocus
          className="w-full max-w-lg bg-white border border-[#e0ded9] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-3 text-sm outline-none placeholder:text-[#a8a8a8] focus:border-[#c45d3a] focus:shadow-[0_2px_12px_rgba(196,93,58,0.08)] transition-all"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col text-[#1a1a1a]">
      <div className="flex-1 overflow-y-auto flex justify-center">
        <div className="w-full max-w-2xl px-6 py-12 pb-32">

          {messages.map((msg, i) => (
            <div key={i} className={`mb-6 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "user" ? (
                <div className="bg-[#e8e6e3] text-[#1a1a1a] px-4 py-2 rounded-2xl max-w-[80%] text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%]">
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.toolCalls.map((tc, j) => (
                        <div key={j} className="text-xs text-[#a8a8a8] font-mono">
                          <span className="text-[#c45d3a]">→</span> {tc.name}
                          <span className="text-[#c4c4c4] ml-1">({JSON.stringify(tc.args)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="prose prose-sm prose-neutral max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
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
                      <div key={j} className="text-xs text-[#a8a8a8] font-mono">
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

      <div className="fixed bottom-6 left-44 right-0 flex justify-center px-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="message..."
          disabled={loading}
          autoFocus
          className="w-full max-w-2xl bg-white/80 backdrop-blur border border-[#e0ded9] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-4 text-sm outline-none placeholder:text-[#c4c4c4] disabled:opacity-50 focus:border-[#c45d3a] focus:shadow-[0_2px_12px_rgba(196,93,58,0.08)] transition-all"
        />
      </div>
    </div>
  );
}
