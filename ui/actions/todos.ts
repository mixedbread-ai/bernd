"use server";

import { revalidatePath } from "next/cache";
import { PATHS } from "@/lib/constants";
import { getFS, getGoogleCalendar } from "@/lib/context";
import { generateTimestamp } from "@/lib/utils";
import {
  isTodoMetadata,
  type TodoCreate,
  type TodoMetadata,
  type TodoUpdate,
} from "@/types";

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
  return `${safeTitle}-${generateTimestamp()}.md`;
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

  // Read existing todo to preserve fields not included in the partial update
  let eventId: string | undefined;
  let currentTitle = id;
  let existingDescription = "";
  let existingMeta: Omit<
    TodoMetadata,
    "type" | "path" | "created_at" | "updated_at"
  > = {};
  try {
    const existing = await fs.read(`${PATHS.TODOS}/${id}.md`);
    if (isTodoMetadata(existing.metadata)) {
      const { type, path, created_at, updated_at, ...rest } = existing.metadata;
      existingMeta = rest;
      eventId = existing.metadata.calendar_event_id;
    }
    const titleMatch = existing.content.match(/^# (.+)$/m);
    if (titleMatch) {
      currentTitle = titleMatch[1];
    }
    existingDescription = existing.content.replace(/^#.*\n\n?/, "");
  } catch {
    // Todo doesn't exist yet
  }

  const newTitle = data.new_title ?? currentTitle;
  const description = data.description ?? existingDescription;
  const content = `# ${newTitle}\n\n${description}`;

  const metadata: Omit<TodoMetadata, "path" | "created_at" | "updated_at"> & {
    calendar_event_id?: string;
  } = {
    ...existingMeta,
    type: "todo",
    title: newTitle,
    ...(data.due_date !== undefined && { due_date: data.due_date }),
    ...(data.priority !== undefined && { priority: data.priority }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.tags !== undefined && { tags: data.tags }),
  };

  // Handle calendar event
  if (gcal) {
    if (data.status === "completed" && eventId) {
      await gcal.deleteEvent(eventId);
      delete metadata.calendar_event_id;
    } else if (eventId && data.due_date) {
      await gcal.updateEvent(eventId, {
        title: newTitle,
        description,
        startTime: data.due_date,
        durationMinutes: 30,
      });
      metadata.calendar_event_id = eventId;
    } else if (!eventId && data.due_date && data.status !== "completed") {
      const calResult = await gcal.createEvent({
        title: newTitle,
        description,
        startTime: data.due_date,
        durationMinutes: 30,
      });
      if (calResult.event_id) {
        metadata.calendar_event_id = calResult.event_id;
      }
    }
  }

  // If title changed, write new file first, then delete old to avoid data loss
  if (newTitle !== currentTitle) {
    const newFilename = generateTodoFilename(newTitle);
    await fs.write(`${PATHS.TODOS}/${newFilename}`, content, metadata);
    try {
      await fs.delete(`${PATHS.TODOS}/${id}.md`);
    } catch {
      // Old file may not exist (e.g. updating a non-existent todo with a new title)
    }
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
