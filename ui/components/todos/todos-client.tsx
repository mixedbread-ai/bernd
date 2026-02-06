"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  createTodoAction,
  deleteTodoAction,
  updateTodoAction,
} from "@/actions/todos";
import { useAutoFocus } from "@/hooks/use-auto-focus";
import { formatRelativeDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/ui";
import type { Todo, TodoCreate, TodoUpdate } from "@/types";

const FILTER_OPTIONS = ["all", "pending", "in_progress", "completed"] as const;
const SORT_OPTIONS = [
  "priority",
  "due_date",
  "created",
  "alphabetical",
] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
type Priority = "low" | "medium" | "high";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function getPriorityIndicatorClass(status: string, priority: Priority): string {
  if (status === "completed") {
    return "bg-transparent";
  }
  switch (priority) {
    case "high":
      return "bg-accent";
    case "medium":
      return "bg-foreground";
    case "low":
      return "bg-muted";
  }
}

function sortTodosList<T extends Todo>(todos: T[], sortBy: SortOption): T[] {
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
  priority: Priority;
  due_date: string;
}

const emptyFormData: TodoFormData = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
};

interface TodosClientProps {
  initialTodos: Todo[];
}

type TodoAction =
  | { type: "toggle"; id: string; newStatus: string }
  | { type: "delete"; id: string }
  | { type: "update"; id: string; data: TodoUpdate };

export function TodosClient({ initialTodos }: TodosClientProps) {
  const [optimisticTodos, setOptimisticTodos] = useOptimistic(
    initialTodos,
    (state: Todo[], action: TodoAction) => {
      switch (action.type) {
        case "toggle":
          return state.map((todo) =>
            todo.id === action.id
              ? { ...todo, status: action.newStatus as Todo["status"] }
              : todo,
          );
        case "delete":
          return state.filter((todo) => todo.id !== action.id);
        case "update": {
          const { new_title, ...rest } = action.data;
          return state.map((todo) =>
            todo.id === action.id
              ? {
                  ...todo,
                  ...rest,
                  ...(new_title ? { id: new_title, title: new_title } : {}),
                }
              : todo,
          );
        }
      }
    },
  );
  const [{ filter, sort }, setParams] = useQueryStates({
    filter: parseAsStringLiteral(FILTER_OPTIONS).withDefault("pending"),
    sort: parseAsStringLiteral(SORT_OPTIONS).withDefault("priority"),
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TodoFormData>(emptyFormData);
  const [, startTransition] = useTransition();
  const [isFormPending, startFormTransition] = useTransition();
  const formInputRef = useAutoFocus<HTMLInputElement>(showForm);

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function toggleComplete(e: React.MouseEvent, todo: Todo) {
    e.stopPropagation();
    const newStatus = todo.status === "completed" ? "pending" : "completed";

    startTransition(async () => {
      setOptimisticTodos({ type: "toggle", id: todo.id, newStatus });
      try {
        await updateTodoAction(todo.id, { status: newStatus } as TodoUpdate);
      } catch {
        alert("Failed to update todo.");
      }
    });
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this todo?")) return;

    startTransition(async () => {
      setOptimisticTodos({ type: "delete", id });
      try {
        await deleteTodoAction(id);
      } catch {
        alert("Failed to delete todo.");
      }
    });
  }

  function startEdit(e: React.MouseEvent, todo: Todo & { content?: string }) {
    e.stopPropagation();
    setEditingId(todo.id);
    setFormData({
      title: todo.title,
      description: todo.description || "",
      priority: todo.priority,
      due_date: todo.due_date || "",
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) return;

    if (editingId) {
      const id = editingId;
      const updateData: TodoUpdate = {
        new_title: formData.title !== id ? formData.title : undefined,
        description: formData.description,
        priority: formData.priority,
        due_date: formData.due_date || undefined,
      };
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyFormData);
      startFormTransition(async () => {
        setOptimisticTodos({ type: "update", id, data: updateData });
        try {
          await updateTodoAction(id, updateData);
        } catch {
          alert("Failed to update todo.");
        }
      });
    } else {
      startFormTransition(async () => {
        try {
          const createData: TodoCreate = {
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            due_date: formData.due_date || undefined,
          };
          await createTodoAction(createData);
          setShowForm(false);
          setEditingId(null);
          setFormData(emptyFormData);
        } catch {
          alert("Failed to create todo.");
        }
      });
    }
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
  }

  const filtered = useMemo(
    () =>
      sortTodosList(
        optimisticTodos.filter((t) => filter === "all" || t.status === filter),
        sort,
      ),
    [optimisticTodos, filter, sort],
  );

  const counts = useMemo(
    () => ({
      all: optimisticTodos.length,
      pending: optimisticTodos.filter((t) => t.status === "pending").length,
      in_progress: optimisticTodos.filter((t) => t.status === "in_progress")
        .length,
      completed: optimisticTodos.filter((t) => t.status === "completed").length,
    }),
    [optimisticTodos],
  );

  return (
    <div className="min-h-screen p-4 md:p-12 bg-background text-foreground">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 md:mb-10 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-4 md:gap-6 text-sm overflow-x-auto">
            {(["all", "pending", "in_progress", "completed"] as const).map(
              (f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setParams({ filter: f }, { history: "push" })}
                  className={cn(
                    "transition-colors whitespace-nowrap rounded",
                    filter === f ? "text-foreground" : "text-muted",
                  )}
                >
                  {f === "in_progress" ? "active" : f}
                  {filter === f && (
                    <span className="ml-1 text-accent">{counts[f]}</span>
                  )}
                </button>
              ),
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sort}
                onChange={(e) =>
                  setParams({ sort: e.target.value as SortOption })
                }
                className="text-xs pl-2 pr-6 py-1 rounded outline-none cursor-pointer bg-surface border border-border text-muted appearance-none"
              >
                <option value="priority">priority</option>
                <option value="due_date">due date</option>
                <option value="created">newest</option>
                <option value="alphabetical">a-z</option>
              </select>
              <svg
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <button
              type="button"
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
          <form
            onSubmit={handleSubmit}
            className="mb-8 p-4 rounded-lg bg-surface border border-border"
          >
            <div className="space-y-4">
              <input
                ref={formInputRef}
                type="text"
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                disabled={isFormPending}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted outline-none focus:border-accent disabled:opacity-50"
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                disabled={isFormPending}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground placeholder:text-muted outline-none focus:border-accent resize-none disabled:opacity-50"
                rows={3}
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as Priority,
                        })
                      }
                      disabled={isFormPending}
                      className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded text-foreground outline-none focus:border-accent disabled:opacity-50 appearance-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-muted mb-1">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                    disabled={isFormPending}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-foreground outline-none focus:border-accent disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={isFormPending}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isFormPending || !formData.title.trim()}
                  className="px-4 py-2 text-sm bg-accent text-background rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isFormPending ? "Saving…" : editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </form>
        )}

        {filtered.length === 0 ? (
          <div className="text-muted">nothing here</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((todo) => (
              <li
                key={todo.id}
                className={cn(
                  "group",
                  todo.status === "completed" && "opacity-40",
                )}
              >
                {/* biome-ignore lint/a11y/useSemanticElements: div with role="button" required to allow nested interactive elements */}
                <div
                  className="flex items-start gap-3 cursor-pointer -mx-3 px-3 py-2 rounded transition-colors hover:bg-surface-hover"
                  onClick={() => toggleExpand(todo.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(todo.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => toggleComplete(e, todo)}
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                      todo.status === "completed"
                        ? "bg-muted border-muted"
                        : "border-muted hover:border-foreground",
                    )}
                  >
                    <span className="sr-only">
                      {todo.status === "completed"
                        ? "Mark as pending"
                        : "Mark as completed"}
                    </span>
                    {todo.status === "completed" && (
                      <svg
                        className="w-3 h-3 text-background"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Priority indicator */}
                  <span
                    className={cn(
                      "mt-2 h-2 w-2 shrink-0 rounded-full",
                      getPriorityIndicatorClass(todo.status, todo.priority),
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        todo.status === "completed" && "line-through",
                      )}
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
                  <div className="shrink-0 flex mt-0.75 items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => startEdit(e, todo)}
                      className="text-xs text-muted hover:text-foreground rounded"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, todo.id)}
                      className="text-xs text-muted hover:text-accent rounded"
                    >
                      delete
                    </button>
                  </div>

                  {todo.due_date && (
                    <span className="shrink-0 text-sm text-muted">
                      {formatRelativeDate(todo.due_date)}
                    </span>
                  )}
                </div>
                {expanded === todo.id && (
                  <div className="ml-9 mt-2 pl-4 border-l-2 border-border text-sm text-muted">
                    <div className="whitespace-pre-wrap">
                      {todo.description || "(no description)"}
                    </div>
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
