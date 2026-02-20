import { Readability } from "@mozilla/readability";
import { tool } from "ai";
import { JSDOM } from "jsdom";
import {
  addTodoSchema,
  calendarSchema,
  fetchSchema,
  filesSchema,
  getTodosSchema,
  memorySchema,
  removeTodoSchema,
  searchTodosSchema,
  skillSchema,
  updateTodoSchema,
  webSearchSchema,
} from "@/lib/agent/schemas";
import {
  generateSkillDescriptions,
  getSkills,
  handleSkill,
} from "@/lib/agent/skills";
import { PATHS } from "@/lib/constants";
import type { GoogleCalendar } from "@/lib/services/google-calendar";
import type { SemanticFS } from "@/lib/services/semantic-fs";
import { WebSearch } from "@/lib/services/web-search";
import { type FileMetadata, isTodoMetadata } from "@/types";

export function createTools(
  fs: SemanticFS,
  getGcal: () => GoogleCalendar | null,
  apiKey: string,
) {
  const skills = getSkills();
  const skillDescriptions = generateSkillDescriptions(skills);

  return {
    add_todo: tool({
      description: "Add a new todo item.",
      inputSchema: addTodoSchema,
      execute: async ({
        title,
        description,
        due_date,
        priority,
        status,
        tags,
      }) => {
        try {
          const content = `# ${title}\n\n${description ?? ""}`;
          const metadata: Record<string, unknown> = {
            type: "todo",
            due_date: due_date ?? "",
            priority: priority ?? "medium",
            status: status ?? "pending",
            tags: tags ?? [],
          };

          // Create calendar event if due_date is set and gcal is configured
          const gcal = getGcal();
          let calResult: unknown;
          if (gcal && due_date) {
            try {
              calResult = await gcal.createEvent({
                title,
                description: description ?? "",
                startTime: due_date,
                durationMinutes: 30,
              });
              const calObj = calResult as Record<string, unknown>;
              if (calObj?.event_id) {
                metadata.calendar_event_id = calObj.event_id;
              }
            } catch (calErr) {
              calResult = { error: String(calErr) };
            }
          }

          const result = await fs.write(
            `${PATHS.TODOS}/${title}.md`,
            content,
            metadata,
          );
          return calResult ? { ...result, calendar: calResult } : result;
        } catch (e) {
          return { error: String(e) };
        }
      },
    }),

    get_todos: tool({
      description: "List all todos.",
      inputSchema: getTodosSchema,
      execute: async ({ n = 20 }) => {
        const files = await fs.list(PATHS.TODOS, n);
        return files.map((f) => ({
          title: f.path.split("/").pop()?.replace(".md", "") ?? "",
          ...f.metadata,
        }));
      },
    }),

    search_todos: tool({
      description: "Search todos by semantic meaning.",
      inputSchema: searchTodosSchema,
      execute: async ({ query, top_k = 10 }) => {
        return fs.search(query, PATHS.TODOS, top_k);
      },
    }),

    remove_todo: tool({
      description: "Delete a todo permanently.",
      inputSchema: removeTodoSchema,
      execute: async ({ title }) => {
        try {
          // Get existing todo to check for calendar event
          let eventId: string | undefined;
          try {
            const existing = await fs.read(`${PATHS.TODOS}/${title}.md`);
            eventId = isTodoMetadata(existing.metadata)
              ? existing.metadata.calendar_event_id
              : undefined;
          } catch {
            // Todo doesn't exist yet
          }

          // Delete calendar event if exists
          const gcal = getGcal();
          if (gcal && eventId) {
            try {
              await gcal.deleteEvent(eventId);
            } catch {
              // Calendar failure should not prevent todo deletion
            }
          }

          return await fs.delete(`${PATHS.TODOS}/${title}.md`);
        } catch (e) {
          return { error: String(e) };
        }
      },
    }),

    update_todo: tool({
      description:
        "Update an existing todo. Use status='completed' to mark done.",
      inputSchema: updateTodoSchema,
      execute: async ({
        title,
        new_title,
        description,
        due_date,
        priority,
        status,
        tags,
      }) => {
        try {
          const finalTitle = new_title ?? title;
          const content = `# ${finalTitle}\n\n${description ?? ""}`;

          // Get existing todo metadata
          let eventId: string | undefined;
          try {
            const existing = await fs.read(`${PATHS.TODOS}/${title}.md`);
            eventId = isTodoMetadata(existing.metadata)
              ? existing.metadata.calendar_event_id
              : undefined;
          } catch {
            // Todo doesn't exist yet
          }

          const metadata: Record<string, unknown> = {
            type: "todo",
            due_date: due_date ?? "",
            priority: priority ?? "medium",
            status: status ?? "pending",
            tags: tags ?? [],
          };

          // Handle calendar event
          const gcal = getGcal();
          let calResult: unknown;
          if (gcal) {
            try {
              if (status === "completed" && eventId) {
                calResult = await gcal.deleteEvent(eventId);
              } else if (eventId && due_date) {
                calResult = await gcal.updateEvent(eventId, {
                  title: finalTitle,
                  description: description ?? "",
                  startTime: due_date,
                  durationMinutes: 30,
                });
                metadata.calendar_event_id = eventId;
              } else if (!eventId && due_date && status !== "completed") {
                calResult = await gcal.createEvent({
                  title: finalTitle,
                  description: description ?? "",
                  startTime: due_date,
                  durationMinutes: 30,
                });
                const calObj = calResult as Record<string, unknown>;
                if (calObj?.event_id) {
                  metadata.calendar_event_id = calObj.event_id;
                }
              }
            } catch (calErr) {
              calResult = { error: String(calErr) };
            }
          }

          if (finalTitle !== title) {
            await fs.delete(`${PATHS.TODOS}/${title}.md`);
          }

          const result = await fs.write(
            `${PATHS.TODOS}/${finalTitle}.md`,
            content,
            metadata,
          );
          return calResult ? { ...result, calendar: calResult } : result;
        } catch (e) {
          return { error: String(e) };
        }
      },
    }),

    memory: tool({
      description: `Manage memories about the user.
Commands:
- search: Semantic search across ALL memories. Use natural language query like "Max" or "board member". No path needed.
- view: Read a specific file (path required) or list all files (path="/memories/")
- create: Write content to a path
- str_replace: Replace text in a file
- insert: Insert text at a line number
- delete: Remove a file`,
      inputSchema: memorySchema,
      execute: async ({
        command,
        query,
        path,
        content,
        old_str,
        new_str,
        insert_line,
      }) => {
        try {
          const targetPath = path ?? PATHS.MEMORIES;

          switch (command) {
            case "view":
              if (targetPath === PATHS.MEMORIES || targetPath.endsWith("/")) {
                return { files: await fs.list(targetPath) };
              }
              return await fs.read(targetPath);

            case "create":
              return await fs.write(targetPath, content ?? "", {
                type: "memory",
              });

            case "delete":
              return await fs.delete(targetPath);

            case "search":
              return await fs.search(query ?? "", PATHS.MEMORIES, 10);

            case "str_replace": {
              const result = await fs.read(targetPath);
              const newContent = result.content.replace(
                old_str ?? "",
                new_str ?? "",
              );
              return await fs.write(targetPath, newContent, result.metadata);
            }

            case "insert": {
              let existingContent = "";
              let existingMetadata: Partial<FileMetadata> = { type: "memory" };
              try {
                const result = await fs.read(targetPath);
                existingContent = result.content;
                existingMetadata = result.metadata;
              } catch {
                // File doesn't exist, use defaults
              }
              const lines = existingContent.split("\n");
              const idx = Math.max(
                0,
                Math.min((insert_line ?? 1) - 1, lines.length),
              );
              lines.splice(idx, 0, new_str ?? "");
              return await fs.write(
                targetPath,
                lines.join("\n"),
                existingMetadata,
              );
            }

            default:
              return { error: `Unknown command: ${command}` };
          }
        } catch (e) {
          return { error: String(e) };
        }
      },
    }),

    web_search: tool({
      description: "Search the web for current information.",
      inputSchema: webSearchSchema,
      execute: async ({ query, top_k = 10 }) => {
        const ws = new WebSearch(apiKey);
        return ws.search(query, top_k);
      },
    }),

    calendar: tool({
      description: `Manage the user's Google Calendar.
Commands:
- list: List upcoming events (use time_min/time_max to filter by date range)
- create: Create a new event (can invite attendees via email)
- update: Update an existing event by event_id
- delete: Delete an event by event_id`,
      inputSchema: calendarSchema,
      execute: async ({
        command,
        event_id,
        title,
        description,
        start_time,
        end_time,
        duration_minutes,
        location,
        attendees,
        send_notifications,
        max_results,
        time_min,
        time_max,
      }) => {
        const gcal = getGcal();
        if (!gcal) {
          return {
            error: "Google Calendar not configured. Connect it in the sidebar.",
          };
        }

        try {
          switch (command) {
            case "list":
              return await gcal.listEvents({
                maxResults: max_results ?? 10,
                timeMin: time_min,
                timeMax: time_max,
              });

            case "create":
              if (!title) return { error: "title is required for create" };
              if (!start_time)
                return { error: "start_time is required for create" };
              return await gcal.createEvent({
                title,
                description: description ?? "",
                startTime: start_time,
                endTime: end_time,
                durationMinutes: duration_minutes ?? 60,
                location: location ?? "",
                attendees,
                sendNotifications: send_notifications ?? true,
              });

            case "update":
              if (!event_id)
                return { error: "event_id is required for update" };
              return await gcal.updateEvent(event_id, {
                title,
                description,
                startTime: start_time,
                endTime: end_time,
                durationMinutes: duration_minutes ?? 60,
                location,
                attendees,
                sendNotifications: send_notifications ?? true,
              });

            case "delete":
              if (!event_id)
                return { error: "event_id is required for delete" };
              return await gcal.deleteEvent(event_id);

            default:
              return { error: `Unknown command: ${command}` };
          }
        } catch (e) {
          return { error: String(e) };
        }
      },
    }),

    files: tool({
      description: `Semantic filesystem for storing and retrieving any data.
Commands:
- read: Read file content from a path
- write: Write content to a path (with optional metadata dict)
- delete: Remove a file
- list: List files under a path prefix (default: /)
- search: Semantic search with natural language query (optionally scoped to path prefix)
- update: Replace old_str with new_str in a file`,
      inputSchema: filesSchema,
      execute: async ({
        command,
        path,
        content,
        metadata,
        query,
        old_str,
        new_str,
        limit,
        top_k,
      }) => {
        try {
          const targetPath = path ?? "/";

          switch (command) {
            case "read":
              return await fs.read(targetPath);

            case "write":
              return await fs.write(targetPath, content ?? "", metadata);

            case "delete":
              return await fs.delete(targetPath);

            case "list":
              return { files: await fs.list(targetPath, limit ?? 100) };

            case "search":
              return await fs.search(query ?? "", targetPath, top_k ?? 10);

            case "update": {
              const result = await fs.read(targetPath);
              const newContent = result.content.replace(
                old_str ?? "",
                new_str ?? "",
              );
              return await fs.write(targetPath, newContent, result.metadata);
            }

            default:
              return { error: `Unknown command: ${command}` };
          }
        } catch (e) {
          return { error: String(e) };
        }
      },
    }),

    fetch: tool({
      description: `Fetch a webpage and extract its main content.
Uses Readability for intelligent content extraction that strips navigation, ads, and boilerplate.
Returns cleaned text optimized for reading.`,
      inputSchema: fetchSchema,
      execute: async ({ url }) => {
        try {
          const headers = {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          };

          const response = await fetch(url, {
            headers,
            redirect: "follow",
          });

          if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}` };
          }

          const contentType = response.headers.get("content-type") ?? "";

          // Return raw content for non-HTML
          if (!contentType.includes("text/html")) {
            const text = await response.text();
            return {
              url: response.url,
              status: response.status,
              content_type: contentType,
              content: text.slice(0, 50000),
            };
          }

          const html = await response.text();

          // Use JSDOM + Readability to extract main content
          const dom = new JSDOM(html, { url });
          const reader = new Readability(dom.window.document);
          const article = reader.parse();

          if (article) {
            return {
              url: response.url,
              status: response.status,
              title: article.title,
              content: article.textContent?.slice(0, 50000) ?? "",
            };
          }

          // Fallback: return raw text
          return {
            url: response.url,
            status: response.status,
            content: html.slice(0, 50000),
          };
        } catch (e) {
          return { error: `Failed to fetch: ${String(e)}` };
        }
      },
    }),

    skill: tool({
      description: `Activate a specialized skill to handle complex tasks.

Skills inject expert instructions and workflows into the conversation.
Use this when a task matches a skill's purpose.

${skillDescriptions}

To use: call skill(name="skill-name")
The skill's instructions will guide subsequent actions.`,
      inputSchema: skillSchema,
      execute: async ({ name }) => {
        return handleSkill(name);
      },
    }),
  };
}
