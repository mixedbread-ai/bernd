// Centralized configuration for the Bernd application

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  // Todos
  todos: `${API_BASE_URL}/todos`,
  todosSearch: `${API_BASE_URL}/todos/search`,
  todoById: (id: string) => `${API_BASE_URL}/todos/by-id/${id}`,

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
} as const;
