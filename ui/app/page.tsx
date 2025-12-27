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
        return cB.localeCompare(cA);
      }
      case "alphabetical":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
}

interface TodoFormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  due_date: string;
}

const emptyFormData: TodoFormData = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
};

export default function TodosPage() {
  const [todos, setTodos] = useState<(Todo & { content?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed"
  >("pending");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TodoFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  const fetchTodos = async () => {
    try {
      const res = await api.get(API_ENDPOINTS.todos);
      const data = await res.json();
      setTodos(data);
    } catch (e) {
      console.error("Failed to fetch todos", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }

    setExpanded(id);

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

  const toggleComplete = async (e: React.MouseEvent, todo: Todo) => {
    e.stopPropagation();
    const newStatus = todo.status === "completed" ? "pending" : "completed";

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, status: newStatus } : t))
    );

    try {
      await api.patch(API_ENDPOINTS.todoUpdate(todo.id), { status: newStatus });
    } catch (e) {
      console.error("Failed to update todo", e);
      // Revert on error
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, status: todo.status } : t))
      );
    }
  };

  const deleteTodo = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this todo?")) return;

    const todoToDelete = todos.find((t) => t.id === id);
    setTodos((prev) => prev.filter((t) => t.id !== id));

    try {
      await api.delete(API_ENDPOINTS.todoDelete(id));
    } catch (e) {
      console.error("Failed to delete todo", e);
      if (todoToDelete) {
        setTodos((prev) => [...prev, todoToDelete]);
      }
    }
  };

  const startEdit = (e: React.MouseEvent, todo: Todo & { content?: string }) => {
    e.stopPropagation();
    setEditingId(todo.id);
    setFormData({
      title: todo.title,
      description: todo.content?.replace(/^# .+\n\n?/, "") || "",
      priority: todo.priority,
      due_date: todo.due_date || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        // Update existing todo
        await api.patch(API_ENDPOINTS.todoUpdate(editingId), {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          due_date: formData.due_date || null,
        });
      } else {
        // Create new todo
        await api.post(API_ENDPOINTS.todoCreate, {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          due_date: formData.due_date || null,
        });
      }
      await fetchTodos();
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyFormData);
    } catch (e) {
      console.error("Failed to save todo", e);
    } finally {
      setSaving(false);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
  };

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
    <div className="min-h-screen p-4 md:p-12 bg-background text-foreground">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 md:mb-10 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4 md:gap-6 text-sm overflow-x-auto">
            {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`transition-colors whitespace-nowrap ${filter === f ? 'text-foreground' : 'text-muted'}`}
              >
                {f === "in_progress" ? "active" : f}
                {filter === f && (
                  <span className="ml-1 text-accent">{counts[f]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs px-2 py-1 rounded outline-none cursor-pointer bg-surface border border-border text-muted"
            >
              <option value="priority">priority</option>
              <option value="due_date">due date</option>
              <option value="created">newest</option>
              <option value="alphabetical">a-z</option>
            </select>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setFormData(emptyFormData);
              }}
              className="text-xs px-3 py-1 rounded bg-accent text-background hover:opacity-90 transition-opacity"
            >
              + new
            </button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-4 rounded-lg bg-surface border border-border">
            <div className="space-y-4">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted outline-none focus:border-accent"
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted outline-none focus:border-accent resize-none"
                rows={3}
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as "low" | "medium" | "high" })}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-foreground outline-none focus:border-accent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">Due date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-foreground outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.title.trim()}
                  className="px-4 py-2 text-sm bg-accent text-background rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-muted">...</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted">nothing here</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((todo) => (
              <li
                key={todo.id}
                className={`group ${
                  todo.status === "completed" ? "opacity-40" : ""
                }`}
              >
                <div
                  className="flex items-start gap-3 cursor-pointer -mx-3 px-3 py-2 rounded transition-colors hover:bg-surface-hover"
                  onClick={() => toggleExpand(todo.id)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => toggleComplete(e, todo)}
                    className={`mt-1 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      todo.status === "completed"
                        ? "bg-muted border-muted"
                        : "border-muted hover:border-foreground"
                    }`}
                  >
                    {todo.status === "completed" && (
                      <svg className="w-3 h-3 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Priority indicator */}
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      todo.status === "completed"
                        ? 'bg-transparent'
                        : todo.priority === "high"
                          ? 'bg-accent'
                          : todo.priority === "medium"
                            ? 'bg-foreground'
                            : 'bg-muted'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <span
                      className={`${todo.status === "completed" ? "line-through" : ""}`}
                    >
                      {todo.title}
                    </span>
                    {todo.tags && todo.tags.length > 0 && (
                      <span className="ml-3 text-sm text-muted">
                        {todo.tags.join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Actions - visible on hover */}
                  <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEdit(e, todo)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      edit
                    </button>
                    <button
                      onClick={(e) => deleteTodo(e, todo.id)}
                      className="text-xs text-muted hover:text-accent"
                    >
                      delete
                    </button>
                  </div>

                  <span className="shrink-0 text-sm text-muted">
                    {formatDate(todo.due_date || "")}
                  </span>
                </div>
                {expanded === todo.id && (
                  <div className="ml-9 mt-2 pl-4 border-l-2 border-border text-sm text-muted">
                    {todo.content !== undefined ? (
                      <div className="whitespace-pre-wrap">
                        {todo.content.replace(/^# .+\n\n?/, "") ||
                          "(no description)"}
                      </div>
                    ) : (
                      <div className="text-muted">loading...</div>
                    )}
                    <div className="mt-3 flex gap-4 text-xs text-muted">
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
