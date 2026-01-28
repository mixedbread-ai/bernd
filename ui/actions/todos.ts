"use server";

import { revalidatePath } from "next/cache";
import { PATHS, type Priority, type TodoStatus } from "@/lib/constants";
import { getFS, getGoogleCalendar } from "@/lib/context";

export interface TodoCreate {
  title: string;
  description?: string;
  due_date?: string;
  priority?: Priority;
  status?: TodoStatus;
  tags?: string[];
}

export interface TodoUpdate {
  new_title?: string;
  description?: string;
  due_date?: string;
  priority?: Priority;
  status?: TodoStatus;
  tags?: string[];
}

// Helper to make a safe filename from title
function makeSafeTitle(title: string): string {
  return title
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
}

function generateTodoFilename(title: string): string {
  const safeTitle = makeSafeTitle(title);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${safeTitle}-${timestamp}.md`;
}

export async function createTodo(
  data: TodoCreate,
): Promise<{ status: string; path: string; calendar?: unknown }> {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  const content = `# ${data.title}\n\n${data.description ?? ""}`;
  const metadata: Record<string, unknown> = {
    type: "todo",
    title: data.title,
    due_date: data.due_date ?? "",
    priority: data.priority ?? "medium",
    status: data.status ?? "pending",
    tags: data.tags ?? [],
  };

  // Create calendar event if due_date is set and gcal is configured
  let calResult: unknown;
  if (gcal && data.due_date) {
    calResult = await gcal.createEvent({
      title: data.title,
      description: data.description ?? "",
      startTime: data.due_date,
      durationMinutes: 30,
    });
    const calObj = calResult as Record<string, unknown>;
    if (calObj?.event_id) {
      metadata.calendar_event_id = calObj.event_id;
    }
  }

  const filename = generateTodoFilename(data.title);
  const result = await fs.write(
    `${PATHS.TODOS}/${filename}`,
    content,
    metadata,
  );

  revalidatePath("/");

  return calResult ? { ...result, calendar: calResult } : result;
}

export async function updateTodo(
  id: string,
  data: TodoUpdate,
): Promise<{ status: string; path: string; calendar?: unknown }> {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  // Get existing todo metadata and extract current title from content
  const existing = await fs.read(`${PATHS.TODOS}/${id}.md`);
  const existingMeta = "error" in existing ? {} : existing.metadata;
  const eventId = existingMeta.calendar_event_id as string | undefined;

  // Extract current title from file content (# Title header)
  let currentTitle = id;
  if (!("error" in existing)) {
    const titleMatch = existing.content.match(/^# (.+)$/m);
    if (titleMatch) {
      currentTitle = titleMatch[1];
    }
  }

  const newTitle = data.new_title ?? currentTitle;
  const content = `# ${newTitle}\n\n${data.description ?? ""}`;

  const metadata: Record<string, unknown> = {
    type: "todo",
    title: newTitle,
    due_date: data.due_date ?? "",
    priority: data.priority ?? "medium",
    status: data.status ?? "pending",
    tags: data.tags ?? [],
  };

  // Handle calendar event
  let calResult: unknown;
  if (gcal) {
    if (data.status === "completed" && eventId) {
      // Delete calendar event when todo is completed
      calResult = await gcal.deleteEvent(eventId);
    } else if (eventId && data.due_date) {
      // Update existing event
      calResult = await gcal.updateEvent(eventId, {
        title: newTitle,
        description: data.description ?? "",
        startTime: data.due_date,
        durationMinutes: 30,
      });
      metadata.calendar_event_id = eventId;
    } else if (!eventId && data.due_date && data.status !== "completed") {
      // Create new event if todo didn't have one but now has due_date
      calResult = await gcal.createEvent({
        title: newTitle,
        description: data.description ?? "",
        startTime: data.due_date,
        durationMinutes: 30,
      });
      const calObj = calResult as Record<string, unknown>;
      if (calObj?.event_id) {
        metadata.calendar_event_id = calObj.event_id;
      }
    }
  }

  // If title changed, create new file with new filename and delete old
  if (newTitle !== currentTitle) {
    await fs.delete(`${PATHS.TODOS}/${id}.md`);
    const newFilename = generateTodoFilename(newTitle);
    const result = await fs.write(
      `${PATHS.TODOS}/${newFilename}`,
      content,
      metadata,
    );
    revalidatePath("/");
    return calResult ? { ...result, calendar: calResult } : result;
  }

  // Otherwise, update in place using the same file ID
  const result = await fs.write(`${PATHS.TODOS}/${id}.md`, content, metadata);

  revalidatePath("/");

  return calResult ? { ...result, calendar: calResult } : result;
}

export async function deleteTodo(
  id: string,
): Promise<{ status: string; path: string }> {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  // Get existing todo to check for calendar event
  const existing = await fs.read(`${PATHS.TODOS}/${id}.md`);
  const eventId =
    "error" in existing
      ? undefined
      : (existing.metadata.calendar_event_id as string | undefined);

  // Delete calendar event if exists
  if (gcal && eventId) {
    await gcal.deleteEvent(eventId);
  }

  const result = await fs.delete(`${PATHS.TODOS}/${id}.md`);

  revalidatePath("/");

  if ("error" in result) {
    return { status: "error", path: `${PATHS.TODOS}/${id}.md` };
  }
  return result;
}
