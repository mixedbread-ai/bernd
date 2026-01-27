export const TodoStatus = {
	PENDING: "pending",
	IN_PROGRESS: "in_progress",
	COMPLETED: "completed",
} as const;

export type TodoStatusType = (typeof TodoStatus)[keyof typeof TodoStatus];

export const Priority = {
	LOW: "low",
	MEDIUM: "medium",
	HIGH: "high",
} as const;

export type PriorityType = (typeof Priority)[keyof typeof Priority];

export const FileType = {
	TODO: "todo",
	MEMORY: "memory",
	CHAT: "chat",
} as const;

export type FileTypeValue = (typeof FileType)[keyof typeof FileType];

// Path prefixes for semantic filesystem
export const PATHS = {
	TODOS: "/todos",
	MEMORIES: "/memories",
	CHATS: "/chats",
	CHAT_ASSETS: "/chat_assets",
	NOTES: "/notes",
	FILES: "/files",
	ENTITIES: "/memories/entities",
	PROJECTS: "/memories/projects",
	PEOPLE: "/memories/people",
	USER_PROFILE: "/memories/user.md",
	GOOGLE_AUTH: "/auth/google.json",
} as const;
