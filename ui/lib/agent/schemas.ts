import { z } from "zod";

export const addTodoSchema = z.object({
  title: z.string().describe("Todo title"),
  description: z.string().optional().describe("Detailed description"),
  due_date: z.string().optional().describe("Due date (ISO 8601)"),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const getTodosSchema = z.object({
  n: z.number().optional().describe("Number of todos to retrieve"),
});

export const searchTodosSchema = z.object({
  query: z.string().describe("Search query"),
  top_k: z.number().optional().describe("Number of results"),
});

export const removeTodoSchema = z.object({
  title: z.string().describe("Todo title to remove"),
});

export const updateTodoSchema = z.object({
  title: z.string().describe("Current todo title"),
  new_title: z.string().optional().describe("New title"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const memorySchema = z.object({
  command: z.enum([
    "search",
    "view",
    "create",
    "delete",
    "str_replace",
    "insert",
  ]),
  query: z
    .string()
    .optional()
    .describe("Natural language search query (for search command only)"),
  path: z
    .string()
    .optional()
    .describe("File path like /memories/user.md (not needed for search)"),
  content: z.string().optional().describe("Content to write"),
  old_str: z.string().optional(),
  new_str: z.string().optional(),
  insert_line: z.number().optional(),
});

export const webSearchSchema = z.object({
  query: z.string().describe("Search query"),
  top_k: z.number().optional().describe("Number of results"),
});

export const calendarSchema = z.object({
  command: z
    .enum(["list", "create", "update", "delete"])
    .describe("The calendar operation to perform"),
  event_id: z
    .string()
    .optional()
    .describe("Event ID (required for update/delete)"),
  title: z.string().optional().describe("Event title (required for create)"),
  description: z.string().optional().describe("Event description"),
  start_time: z
    .string()
    .optional()
    .describe(
      "Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or date (YYYY-MM-DD)",
    ),
  end_time: z
    .string()
    .optional()
    .describe("End time in ISO format (optional, uses duration if not set)"),
  duration_minutes: z
    .number()
    .optional()
    .describe(
      "Duration in minutes (default: 60, ignored if end_time provided)",
    ),
  location: z.string().optional().describe("Event location"),
  attendees: z
    .array(z.string())
    .optional()
    .describe("List of email addresses to invite"),
  send_notifications: z
    .boolean()
    .optional()
    .describe("Send email invites to attendees (default: true)"),
  max_results: z
    .number()
    .optional()
    .describe("Max events to return for list (default: 10)"),
  time_min: z
    .string()
    .optional()
    .describe("Start of time range for list (ISO format, default: now)"),
  time_max: z
    .string()
    .optional()
    .describe("End of time range for list (ISO format)"),
});

export const filesSchema = z.object({
  command: z.enum(["read", "write", "delete", "list", "search", "update"]),
  path: z
    .string()
    .optional()
    .describe("File path like /notes/meeting.md or prefix like /notes/"),
  content: z.string().optional().describe("Content to write"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional metadata dict"),
  query: z.string().optional().describe("Natural language search query"),
  old_str: z.string().optional().describe("String to replace (for update)"),
  new_str: z.string().optional().describe("Replacement string (for update)"),
  limit: z.number().optional().describe("Max files to list (default: 100)"),
  top_k: z.number().optional().describe("Max search results (default: 10)"),
});

export const fetchSchema = z.object({
  url: z.string().describe("The URL to fetch"),
});

export const skillSchema = z.object({
  name: z.string().describe("Name of the skill to activate"),
});
