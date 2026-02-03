import { PATHS, type Priority, type TodoStatus } from "@/lib/constants";
import type {
  FileListItem,
  SearchResult,
  SemanticFS,
} from "@/lib/services/semantic-fs";
import type { Todo, TodoMetadata } from "@/types";
import { isTodoMetadata } from "@/types";

function pathToId(path: string): string {
  // Extract filename without extension as ID
  const filename = path.split("/").pop() ?? "";
  return filename.replace(".md", "");
}

function sortTodos(todos: Todo[]): Todo[] {
  const statusOrder: Record<TodoStatus, number> = {
    in_progress: 0,
    pending: 1,
    completed: 2,
  };

  const priorityOrder: Record<Priority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return todos.sort((a, b) => {
    // First by status
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (earlier first, no due date last)
    if (a.due_date && b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;

    // Finally by title
    return a.title.localeCompare(b.title);
  });
}

function todoMetadataToTodo(id: string, metadata: TodoMetadata): Todo {
  return {
    id,
    title: metadata.title ?? id,
    description: undefined,
    due_date: metadata.due_date ?? undefined,
    priority: metadata.priority ?? "medium",
    status: metadata.status ?? "pending",
    tags: metadata.tags ?? undefined,
    calendar_event_id: metadata.calendar_event_id ?? undefined,
    created_at: metadata.created_at ?? undefined,
  };
}

function fileToTodo(file: FileListItem): Todo {
  const metadata = file.metadata;
  if (isTodoMetadata(metadata)) {
    return todoMetadataToTodo(pathToId(file.path), metadata);
  }
  throw new Error(`Expected todo metadata, got ${metadata.type}`);
}

function extractTitleFromContent(content: string): string | null {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1] : null;
}

function searchResultToTodo(result: SearchResult): Todo {
  const metadata = result.metadata;
  const id = pathToId(result.path);
  const fallbackTitle = extractTitleFromContent(result.content) ?? id;

  if (isTodoMetadata(metadata)) {
    return {
      ...todoMetadataToTodo(id, metadata),
      title: metadata.title ?? fallbackTitle,
    };
  }
  throw new Error(`Expected todo metadata, got ${metadata.type}`);
}

export async function getTodos(fs: SemanticFS, limit = 50): Promise<Todo[]> {
  const files = await fs.list(PATHS.TODOS, limit);
  const todos = files.map(fileToTodo);
  return sortTodos(todos);
}

export async function getTodo(
  fs: SemanticFS,
  id: string,
): Promise<Todo | null> {
  try {
    const result = await fs.read(`${PATHS.TODOS}/${id}.md`);

    const metadata = result.metadata;
    if (!isTodoMetadata(metadata)) {
      throw new Error(`Expected todo metadata, got ${metadata.type}`);
    }

    const fallbackTitle = extractTitleFromContent(result.content) ?? id;
    const description = result.content.replace(/^#.*\n\n?/, ""); // Remove markdown title

    return {
      ...todoMetadataToTodo(id, metadata),
      title: metadata.title ?? fallbackTitle,
      description,
    };
  } catch {
    return null;
  }
}

export async function searchTodos(
  fs: SemanticFS,
  query: string,
  topK = 10,
): Promise<Todo[]> {
  const results = await fs.search(query, PATHS.TODOS, topK);
  return results.map(searchResultToTodo);
}
