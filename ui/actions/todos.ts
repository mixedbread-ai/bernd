"use server";

import { revalidatePath } from "next/cache";
import { PATHS, type Priority, type TodoStatus } from "@/lib/constants";
import { getFS, getGoogleCalendar } from "@/lib/context";
import { isTodoMetadata, type TodoMetadata } from "@/types";

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

export async function createTodoAction(data: TodoCreate) {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  const content = `# ${data.title}\n\n${data.description ?? ""}`;
  const metadata: Omit<TodoMetadata, "path" | "created_at" | "updated_at"> = {
    type: "todo",
    title: data.title,
    due_date: data.due_date ?? "",
    priority: data.priority ?? "medium",
    status: data.status ?? "pending",
    tags: data.tags ?? [],
  };

  // Create calendar event if due_date is set and gcal is configured
  if (gcal && data.due_date) {
    const calResult = await gcal.createEvent({
      title: data.title,
      description: data.description ?? "",
      startTime: data.due_date,
      durationMinutes: 30,
    });
    if (calResult.event_id) {
      metadata.calendar_event_id = calResult.event_id;
    }
  }

  const filename = generateTodoFilename(data.title);
  await fs.write(`${PATHS.TODOS}/${filename}`, content, metadata);

  revalidatePath("/");
}

export async function updateTodoAction(id: string, data: TodoUpdate) {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  // Get existing todo metadata and extract current title from content
  let eventId: string | undefined;
  let currentTitle = id;
  try {
    const existing = await fs.read(`${PATHS.TODOS}/${id}.md`);
    eventId = isTodoMetadata(existing.metadata)
      ? existing.metadata.calendar_event_id
      : undefined;
    const titleMatch = existing.content.match(/^# (.+)$/m);
    if (titleMatch) {
      currentTitle = titleMatch[1];
    }
  } catch {
    // Todo doesn't exist yet
  }

  const newTitle = data.new_title ?? currentTitle;
  const content = `# ${newTitle}\n\n${data.description ?? ""}`;

  const metadata: Omit<TodoMetadata, "path" | "created_at" | "updated_at"> & {
    calendar_event_id?: string;
  } = {
    type: "todo",
    title: newTitle,
    due_date: data.due_date ?? "",
    priority: data.priority ?? "medium",
    status: data.status ?? "pending",
    tags: data.tags ?? [],
  };

  // Handle calendar event
  if (gcal) {
    if (data.status === "completed" && eventId) {
      await gcal.deleteEvent(eventId);
    } else if (eventId && data.due_date) {
      await gcal.updateEvent(eventId, {
        title: newTitle,
        description: data.description ?? "",
        startTime: data.due_date,
        durationMinutes: 30,
      });
      metadata.calendar_event_id = eventId;
    } else if (!eventId && data.due_date && data.status !== "completed") {
      const calResult = await gcal.createEvent({
        title: newTitle,
        description: data.description ?? "",
        startTime: data.due_date,
        durationMinutes: 30,
      });
      if (calResult.event_id) {
        metadata.calendar_event_id = calResult.event_id;
      }
    }
  }

  // If title changed, create new file with new filename and delete old
  if (newTitle !== currentTitle) {
    await fs.delete(`${PATHS.TODOS}/${id}.md`);
    const newFilename = generateTodoFilename(newTitle);
    await fs.write(`${PATHS.TODOS}/${newFilename}`, content, metadata);
  } else {
    await fs.write(`${PATHS.TODOS}/${id}.md`, content, metadata);
  }

  revalidatePath("/");
}

export async function deleteTodoAction(id: string) {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  // Get existing todo to check for calendar event
  let eventId: string | undefined;
  try {
    const existing = await fs.read(`${PATHS.TODOS}/${id}.md`);
    eventId =
      existing.metadata && isTodoMetadata(existing.metadata)
        ? existing.metadata.calendar_event_id
        : undefined;
  } catch {
    // Todo doesn't exist
  }

  // Delete calendar event if exists
  if (gcal && eventId) {
    await gcal.deleteEvent(eventId);
  }

  await fs.delete(`${PATHS.TODOS}/${id}.md`);

  revalidatePath("/");
}
