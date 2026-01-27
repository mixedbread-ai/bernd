// Pure functions for fetching todos data

import type { Todo } from "@/types";
import {
	PATHS,
	Priority,
	type PriorityType,
	TodoStatus,
	type TodoStatusType,
} from "../constants";
import type {
	FileListItem,
	SearchResult,
	SemanticFS,
} from "../services/semantic-fs";

function pathToId(path: string): string {
	// Extract filename without extension as ID
	const filename = path.split("/").pop() ?? "";
	return filename.replace(".md", "");
}

function sortTodos(todos: Todo[]): Todo[] {
	const statusOrder: Record<TodoStatusType, number> = {
		[TodoStatus.IN_PROGRESS]: 0,
		[TodoStatus.PENDING]: 1,
		[TodoStatus.COMPLETED]: 2,
	};

	const priorityOrder: Record<PriorityType, number> = {
		[Priority.HIGH]: 0,
		[Priority.MEDIUM]: 1,
		[Priority.LOW]: 2,
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

function fileToTodo(file: FileListItem): Todo {
	const metadata = file.metadata;
	return {
		id: pathToId(file.path),
		title: file.path.split("/").pop()?.replace(".md", "") ?? "",
		description: (metadata.description as string) ?? undefined,
		due_date: (metadata.due_date as string) ?? undefined,
		priority: (metadata.priority as PriorityType) ?? Priority.MEDIUM,
		status: (metadata.status as TodoStatusType) ?? TodoStatus.PENDING,
		tags: (metadata.tags as string[]) ?? undefined,
		calendar_event_id: (metadata.calendar_event_id as string) ?? undefined,
		created_at: (metadata.created_at as string) ?? undefined,
	};
}

function searchResultToTodo(result: SearchResult): Todo {
	const metadata = result.metadata;
	return {
		id: pathToId(result.path),
		title: result.path.split("/").pop()?.replace(".md", "") ?? "",
		description: (metadata.description as string) ?? undefined,
		due_date: (metadata.due_date as string) ?? undefined,
		priority: (metadata.priority as PriorityType) ?? Priority.MEDIUM,
		status: (metadata.status as TodoStatusType) ?? TodoStatus.PENDING,
		tags: (metadata.tags as string[]) ?? undefined,
		calendar_event_id: (metadata.calendar_event_id as string) ?? undefined,
		created_at: (metadata.created_at as string) ?? undefined,
	};
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
	const result = await fs.read(`${PATHS.TODOS}/${id}.md`);
	if ("error" in result) {
		return null;
	}

	const metadata = result.metadata;
	return {
		id,
		title: id,
		description: result.content.replace(/^#.*\n\n?/, ""), // Remove markdown title
		due_date: (metadata.due_date as string) ?? undefined,
		priority: (metadata.priority as PriorityType) ?? Priority.MEDIUM,
		status: (metadata.status as TodoStatusType) ?? TodoStatus.PENDING,
		tags: (metadata.tags as string[]) ?? undefined,
		calendar_event_id: (metadata.calendar_event_id as string) ?? undefined,
		created_at: (metadata.created_at as string) ?? undefined,
	};
}

export async function searchTodos(
	fs: SemanticFS,
	query: string,
	topK = 10,
): Promise<Todo[]> {
	const results = await fs.search(query, PATHS.TODOS, topK);
	return results.map(searchResultToTodo);
}
