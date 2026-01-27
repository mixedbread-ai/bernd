"use server";

import { revalidatePath } from "next/cache";
import {
  FileType,
  PATHS,
  Priority,
  type PriorityType,
  TodoStatus,
  type TodoStatusType,
} from "@/lib/constants";
import { getFS, getGoogleCalendar } from "@/lib/context";

export interface TodoCreate {
  title: string;
  description?: string;
  due_date?: string;
  priority?: PriorityType;
  status?: TodoStatusType;
  tags?: string[];
}

export interface TodoUpdate {
  new_title?: string;
  description?: string;
  due_date?: string;
  priority?: PriorityType;
  status?: TodoStatusType;
  tags?: string[];
}

export async function createTodo(
  data: TodoCreate,
): Promise<{ status: string; path: string; calendar?: unknown }> {
  const fs = await getFS();
  const gcal = await getGoogleCalendar();

  const content = `# ${data.title}\n\n${data.description ?? ""}`;
  const metadata: Record<string, unknown> = {
    type: FileType.TODO,
    due_date: data.due_date ?? "",
    priority: data.priority ?? Priority.MEDIUM,
    status: data.status ?? TodoStatus.PENDING,
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

  const result = await fs.write(
    `${PATHS.TODOS}/${data.title}.md`,
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

  const title = id;
  const newTitle = data.new_title ?? title;
  const content = `# ${newTitle}\n\n${data.description ?? ""}`;

  // Get existing todo metadata
  const existing = await fs.read(`${PATHS.TODOS}/${title}.md`);
  const existingMeta = "error" in existing ? {} : existing.metadata;
  const eventId = existingMeta.calendar_event_id as string | undefined;

  const metadata: Record<string, unknown> = {
    type: FileType.TODO,
    due_date: data.due_date ?? "",
    priority: data.priority ?? Priority.MEDIUM,
    status: data.status ?? TodoStatus.PENDING,
    tags: data.tags ?? [],
  };

  // Handle calendar event
  let calResult: unknown;
  if (gcal) {
    if (data.status === TodoStatus.COMPLETED && eventId) {
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
    } else if (
      !eventId &&
      data.due_date &&
      data.status !== TodoStatus.COMPLETED
    ) {
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

  // Delete old file if title changed
  if (newTitle !== title) {
    await fs.delete(`${PATHS.TODOS}/${title}.md`);
  }

  const result = await fs.write(
    `${PATHS.TODOS}/${newTitle}.md`,
    content,
    metadata,
  );

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
