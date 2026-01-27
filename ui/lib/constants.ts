export type TodoStatus = "pending" | "in_progress" | "completed";
export type Priority = "low" | "medium" | "high";
export type FileType = "todo" | "memory" | "chat";

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
