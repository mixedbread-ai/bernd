"use client";

import { useEffect, useState } from "react";
import { Todo } from "./types";
import { API_ENDPOINTS } from "./config";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  if (days === 1) return "tmrw";
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TodosPage() {
  const [todos, setTodos] = useState<(Todo & { content?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed"
  >("pending");
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }

    setExpanded(id);

    // Fetch content if not already loaded
    const todo = todos.find((t) => t.id === id);
    if (todo && todo.content === undefined) {
      try {
        const res = await fetch(API_ENDPOINTS.todoById(id));
        const data = await res.json();
        setTodos((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, content: data.content || "(no description)" } : t
          )
        );
      } catch (e) {
        console.error("Failed to fetch todo details", e);
        setTodos((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, content: "(failed to load)" } : t
          )
        );
      }
    }
  };

  useEffect(() => {
    fetch(API_ENDPOINTS.todos)
      .then((res) => res.json())
      .then((data) => {
        setTodos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = todos.filter((t) => filter === "all" || t.status === filter);

  const counts = {
    all: todos.length,
    pending: todos.filter((t) => t.status === "pending").length,
    in_progress: todos.filter((t) => t.status === "in_progress").length,
    completed: todos.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] p-12 text-[#1a1a1a]">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 flex items-baseline gap-6 text-sm">
          {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`transition-colors ${
                filter === f
                  ? "text-[#1a1a1a]"
                  : "text-[#c4c4c4] hover:text-[#888]"
              }`}
            >
              {f === "in_progress" ? "active" : f}
              {filter === f && (
                <span className="ml-1 text-[#c45d3a]">{counts[f]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-[#a8a8a8]">...</div>
        ) : filtered.length === 0 ? (
          <div className="text-[#c4c4c4]">nothing here</div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((todo) => (
              <li
                key={todo.id}
                className={`group ${
                  todo.status === "completed" ? "opacity-40" : ""
                }`}
              >
                <div
                  className="flex items-start gap-4 cursor-pointer hover:bg-[#f5f4f2] -mx-3 px-3 py-2 rounded transition-colors"
                  onClick={() => toggleExpand(todo.id)}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      todo.status === "completed"
                        ? "bg-[#d4d4d4]"
                        : todo.priority === "high"
                          ? "bg-[#c45d3a]"
                          : todo.priority === "medium"
                            ? "bg-[#1a1a1a]"
                            : "bg-[#c4c4c4]"
                    }`}
                  />
                  <div className="flex-1">
                    <span
                      className={todo.status === "completed" ? "line-through" : ""}
                    >
                      {todo.title}
                    </span>
                    {todo.tags && todo.tags.length > 0 && (
                      <span className="ml-3 text-sm text-[#a8a8a8]">
                        {todo.tags.join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm text-[#c4c4c4]">
                    {formatDate(todo.due_date || "")}
                  </span>
                </div>
                {expanded === todo.id && (
                  <div className="ml-6 mt-2 pl-4 border-l-2 border-[#e8e8e6] text-sm text-[#666]">
                    {todo.content !== undefined ? (
                      <div className="whitespace-pre-wrap">
                        {todo.content.replace(/^# .+\n\n?/, "") ||
                          "(no description)"}
                      </div>
                    ) : (
                      <div className="text-[#c4c4c4]">loading...</div>
                    )}
                    <div className="mt-3 flex gap-4 text-xs text-[#a8a8a8]">
                      <span>priority: {todo.priority}</span>
                      <span>status: {todo.status}</span>
                      {todo.due_date && <span>due: {todo.due_date}</span>}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
