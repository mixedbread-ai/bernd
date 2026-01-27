// Centralized configuration for the Bernd application

// Auth configuration (still needed for external auth service)
export const AUTH_BASE_URL =
  process.env.NEXT_PUBLIC_AUTH_BASE_URL || "http://localhost:3001/api/auth";

// Legacy API endpoints - kept for pages not yet migrated
// TODO: Remove these once all pages use the new data layer
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  // Todos
  todos: `${API_BASE_URL}/todos`,
  todosSearch: `${API_BASE_URL}/todos/search`,
  todoById: (id: string) => `${API_BASE_URL}/todos/by-id/${id}`,
  todoCreate: `${API_BASE_URL}/todos`,
  todoUpdate: (id: string) => `${API_BASE_URL}/todos/by-id/${id}`,
  todoDelete: (id: string) => `${API_BASE_URL}/todos/by-id/${id}`,

  // Chat
  chat: `${API_BASE_URL}/chat`,
  chatStream: `${API_BASE_URL}/chat/stream`,
  chats: `${API_BASE_URL}/chats`,
  chatById: (id: string) => `${API_BASE_URL}/chats/${id}`,

  // Notes
  notes: `${API_BASE_URL}/notes`,
  noteById: (id: string) => `${API_BASE_URL}/notes/${id}`,

  // Auth
  validateApiKey: `${API_BASE_URL}/auth/validate`,
  googleAuth: `${API_BASE_URL}/auth/google`,
  googleAuthStatus: `${API_BASE_URL}/auth/google/status`,

  // Search
  search: `${API_BASE_URL}/search`,

  // Files
  files: `${API_BASE_URL}/files`,
  filesUpload: `${API_BASE_URL}/files/upload`,
  filesFolder: `${API_BASE_URL}/files/folder`,
  filesDownload: (path: string) => `${API_BASE_URL}/files/download${path}`,
  filesDelete: (path: string) => `${API_BASE_URL}/files${path}`,
} as const;
