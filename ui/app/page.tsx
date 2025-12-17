"use client";

import { useEffect, useState } from "react";
import { Todo } from "./types";
import { API_ENDPOINTS } from "./config";
import { api } from "./lib/api";

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

type SortOption = "priority" | "due_date" | "created" | "alphabetical";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortTodos<T extends Todo>(todos: T[], sortBy: SortOption): T[] {
  return [...todos].sort((a, b) => {
    switch (sortBy) {
      case "priority": {
        const pA = PRIORITY_ORDER[a.priority || ""] ?? 3;
        const pB = PRIORITY_ORDER[b.priority || ""] ?? 3;
        if (pA !== pB) return pA - pB;
        // Secondary sort by due date
        const dA = a.due_date || "9999";
        const dB = b.due_date || "9999";
        return dA.localeCompare(dB);
      }
      case "due_date": {
        const dA = a.due_date || "9999";
        const dB = b.due_date || "9999";
        return dA.localeCompare(dB);
      }
      case "created": {
        const cA = a.created_at || "0000";
        const cB = b.created_at || "0000";
        return cB.localeCompare(cA); // Newest first
      }
      case "alphabetical":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
}

export default function TodosPage() {
  const [todos, setTodos] = useState<(Todo & { content?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed"
  >("pending");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
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
        const res = await api.get(API_ENDPOINTS.todoById(id));
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
    api.get(API_ENDPOINTS.todos)
      .then((res) => res.json())
      .then((data) => {
        setTodos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = sortTodos(
    todos.filter((t) => filter === "all" || t.status === filter),
    sortBy
  );

  const counts = {
    all: todos.length,
    pending: todos.filter((t) => t.status === "pending").length,
    in_progress: todos.filter((t) => t.status === "in_progress").length,
    completed: todos.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="min-h-screen p-4 md:p-12" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="mx-auto max-w-xl">
        <div className="mb-6 md:mb-10 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4 md:gap-6 text-sm overflow-x-auto">
            {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="transition-colors whitespace-nowrap"
                style={{ color: filter === f ? 'var(--foreground)' : 'var(--muted)' }}
              >
                {f === "in_progress" ? "active" : f}
                {filter === f && (
                  <span className="ml-1" style={{ color: 'var(--accent)' }}>{counts[f]}</span>
                )}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs px-2 py-1 rounded outline-none cursor-pointer"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
            }}
          >
            <option value="priority">priority</option>
            <option value="due_date">due date</option>
            <option value="created">newest</option>
            <option value="alphabetical">a-z</option>
          </select>
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>nothing here</div>
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
                  className="flex items-start gap-4 cursor-pointer -mx-3 px-3 py-2 rounded transition-colors"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => toggleExpand(todo.id)}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: todo.status === "completed"
                        ? 'var(--muted)'
                        : todo.priority === "high"
                          ? 'var(--accent)'
                          : todo.priority === "medium"
                            ? 'var(--foreground)'
                            : 'var(--muted)'
                    }}
                  />
                  <div className="flex-1">
                    <span
                      className={todo.status === "completed" ? "line-through" : ""}
                    >
                      {todo.title}
                    </span>
                    {todo.tags && todo.tags.length > 0 && (
                      <span className="ml-3 text-sm" style={{ color: 'var(--muted)' }}>
                        {todo.tags.join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm" style={{ color: 'var(--muted)' }}>
                    {formatDate(todo.due_date || "")}
                  </span>
                </div>
                {expanded === todo.id && (
                  <div className="ml-6 mt-2 pl-4 border-l-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                    {todo.content !== undefined ? (
                      <div className="whitespace-pre-wrap">
                        {todo.content.replace(/^# .+\n\n?/, "") ||
                          "(no description)"}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted)' }}>loading...</div>
                    )}
                    <div className="mt-3 flex gap-4 text-xs" style={{ color: 'var(--muted)' }}>
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
