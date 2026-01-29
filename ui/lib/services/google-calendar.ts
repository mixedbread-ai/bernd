// Google Calendar API integration
import { type calendar_v3, google } from "googleapis";

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry?: string;
}

export interface CreateEventParams {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  location?: string;
  attendees?: string[];
  sendNotifications?: boolean;
  calendarId?: string;
}

export interface UpdateEventParams {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  location?: string;
  attendees?: string[];
  sendNotifications?: boolean;
  calendarId?: string;
}

export interface ListEventsParams {
  maxResults?: number;
  timeMin?: string;
  timeMax?: string;
  calendarId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  link: string;
}

export interface CalendarResult {
  status: string;
  event_id?: string;
  link?: string;
  attendees_invited?: number;
}

export class GoogleCalendar {
  private service: calendar_v3.Calendar | null = null;
  private tokens: GoogleTokens;
  private clientId: string;
  private clientSecret: string;
  private onRefresh?: (tokens: GoogleTokens) => void;

  constructor(
    tokens: GoogleTokens,
    clientId: string,
    clientSecret: string,
    onRefresh?: (tokens: GoogleTokens) => void,
  ) {
    this.tokens = tokens;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.onRefresh = onRefresh;
  }

  private async getService(): Promise<calendar_v3.Calendar> {
    if (this.service) return this.service;

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
    );

    oauth2Client.setCredentials({
      access_token: this.tokens.access_token,
      refresh_token: this.tokens.refresh_token,
    });

    // Set up token refresh handler
    oauth2Client.on("tokens", (tokens) => {
      if (this.onRefresh && tokens.access_token) {
        this.onRefresh({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? this.tokens.refresh_token,
          expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : undefined,
        });
      }
    });

    this.service = google.calendar({ version: "v3", auth: oauth2Client });
    return this.service;
  }

  async createEvent(params: CreateEventParams): Promise<CalendarResult> {
    const {
      title,
      description = "",
      startTime,
      endTime,
      durationMinutes = 60,
      location = "",
      attendees,
      sendNotifications = true,
      calendarId = "primary",
    } = params;

    if (!startTime) {
      throw new Error("No start_time provided");
    }

    const service = await this.getService();

    // Parse start time
    let startDt: Date;
    if (startTime.includes("T")) {
      startDt = new Date(startTime.replace("Z", ""));
    } else {
      startDt = new Date(startTime);
      startDt.setHours(9, 0, 0, 0);
    }

    // Parse or calculate end time
    let endDt: Date;
    if (endTime) {
      if (endTime.includes("T")) {
        endDt = new Date(endTime.replace("Z", ""));
      } else {
        endDt = new Date(endTime);
        endDt.setHours(10, 0, 0, 0);
      }
    } else {
      endDt = new Date(startDt.getTime() + durationMinutes * 60 * 1000);
    }

    const event: calendar_v3.Schema$Event = {
      summary: title,
      description,
      location,
      start: {
        dateTime: startDt.toISOString(),
        timeZone: "Europe/Berlin",
      },
      end: {
        dateTime: endDt.toISOString(),
        timeZone: "Europe/Berlin",
      },
    };

    if (attendees && attendees.length > 0) {
      event.attendees = attendees.map((email) => ({ email }));
    }

    const result = await service.events.insert({
      calendarId,
      requestBody: event,
      sendUpdates:
        sendNotifications && attendees && attendees.length > 0
          ? "all"
          : "none",
    });

    return {
      status: "created",
      event_id: result.data.id ?? undefined,
      link: result.data.htmlLink ?? undefined,
      attendees_invited: attendees?.length ?? 0,
    };
  }

  async updateEvent(
    eventId: string,
    params: UpdateEventParams,
  ): Promise<CalendarResult> {
    const {
      title,
      description,
      startTime,
      endTime,
      durationMinutes = 60,
      location,
      attendees,
      sendNotifications = true,
      calendarId = "primary",
    } = params;

    const service = await this.getService();

    // Get existing event
    const existing = await service.events.get({
      calendarId,
      eventId,
    });

    const event = existing.data;

    // Update fields if provided
    if (title) event.summary = title;
    if (description !== undefined) event.description = description;
    if (location !== undefined) event.location = location;

    if (startTime) {
      let startDt: Date;
      if (startTime.includes("T")) {
        startDt = new Date(startTime.replace("Z", ""));
      } else {
        startDt = new Date(startTime);
        startDt.setHours(9, 0, 0, 0);
      }

      let endDt: Date;
      if (endTime) {
        if (endTime.includes("T")) {
          endDt = new Date(endTime.replace("Z", ""));
        } else {
          endDt = new Date(endTime);
          endDt.setHours(10, 0, 0, 0);
        }
      } else {
        endDt = new Date(startDt.getTime() + durationMinutes * 60 * 1000);
      }

      event.start = {
        dateTime: startDt.toISOString(),
        timeZone: "Europe/Berlin",
      };
      event.end = {
        dateTime: endDt.toISOString(),
        timeZone: "Europe/Berlin",
      };
    }

    if (attendees !== undefined) {
      event.attendees = attendees.map((email) => ({ email }));
    }

    const result = await service.events.update({
      calendarId,
      eventId,
      requestBody: event,
      sendUpdates: sendNotifications ? "all" : "none",
    });

    return {
      status: "updated",
      event_id: result.data.id ?? undefined,
      link: result.data.htmlLink ?? undefined,
    };
  }

  async deleteEvent(
    eventId: string,
    calendarId = "primary",
  ): Promise<CalendarResult> {
    const service = await this.getService();

    await service.events.delete({
      calendarId,
      eventId,
    });

    return { status: "deleted", event_id: eventId };
  }

  async listEvents(params?: ListEventsParams): Promise<CalendarEvent[]> {
    const {
      maxResults = 10,
      timeMin,
      timeMax,
      calendarId = "primary",
    } = params ?? {};

    const service = await this.getService();

    let effectiveTimeMin = timeMin;
    if (effectiveTimeMin) {
      if (
        !effectiveTimeMin.endsWith("Z") &&
        !effectiveTimeMin.includes("+")
      ) {
        effectiveTimeMin += "Z";
      }
    } else {
      effectiveTimeMin = new Date().toISOString();
    }

    const requestParams: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      timeMin: effectiveTimeMin,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    };

    if (timeMax) {
      let effectiveTimeMax = timeMax;
      if (
        !effectiveTimeMax.endsWith("Z") &&
        !effectiveTimeMax.includes("+")
      ) {
        effectiveTimeMax += "Z";
      }
      requestParams.timeMax = effectiveTimeMax;
    }

    const result = await service.events.list(requestParams);

    return (result.data.items ?? []).map((event) => ({
      id: event.id ?? "",
      title: event.summary ?? "",
      description: event.description ?? "",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      location: event.location ?? "",
      link: event.htmlLink ?? "",
    }));
  }
}
