from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import os

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CREDENTIALS_FILE = os.path.join(
    os.path.dirname(__file__), "../secret/quantum-vista-481014-b4-bdf172a439d6.json"
)


class GoogleCalendar:
    def __init__(self, impersonate_email: str):
        """Initialize with domain-wide delegation, impersonating a user."""
        self.impersonate_email = impersonate_email
        self._service = None

    @property
    def service(self):
        if self._service is None:
            credentials = service_account.Credentials.from_service_account_file(
                CREDENTIALS_FILE, scopes=SCOPES
            )
            # Impersonate the user
            delegated_credentials = credentials.with_subject(self.impersonate_email)
            self._service = build("calendar", "v3", credentials=delegated_credentials)
        return self._service

    def create_event(
        self,
        title: str,
        description: str = "",
        start_time: str = None,
        end_time: str = None,
        duration_minutes: int = 60,
        location: str = "",
        attendees: list[str] = None,
        send_notifications: bool = True,
        calendar_id: str = "primary",
    ) -> dict:
        """Create a calendar event.

        Args:
            title: Event title
            description: Event description
            start_time: Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or date (YYYY-MM-DD)
            end_time: End time in ISO format (optional, calculated from duration if not provided)
            duration_minutes: Event duration in minutes (default 60, ignored if end_time provided)
            location: Event location
            attendees: List of email addresses to invite
            send_notifications: Whether to send email invites to attendees (default True)
            calendar_id: Calendar ID (default "primary")

        Returns:
            Created event info or error
        """
        if not start_time:
            return {"error": "No start_time provided"}

        try:
            # Parse the start time
            if "T" in start_time:
                start_dt = datetime.fromisoformat(start_time.replace("Z", ""))
            else:
                # Just date, default to 9 AM
                start_dt = datetime.strptime(start_time, "%Y-%m-%d").replace(hour=9)

            # Parse or calculate end time
            if end_time:
                if "T" in end_time:
                    end_dt = datetime.fromisoformat(end_time.replace("Z", ""))
                else:
                    end_dt = datetime.strptime(end_time, "%Y-%m-%d").replace(hour=10)
            else:
                end_dt = start_dt + timedelta(minutes=duration_minutes)

            event = {
                "summary": title,
                "description": description,
                "location": location,
                "start": {
                    "dateTime": start_dt.isoformat(),
                    "timeZone": "Europe/Berlin",
                },
                "end": {
                    "dateTime": end_dt.isoformat(),
                    "timeZone": "Europe/Berlin",
                },
            }

            # Add attendees if provided
            if attendees:
                event["attendees"] = [{"email": email} for email in attendees]

            result = self.service.events().insert(
                calendarId=calendar_id,
                body=event,
                sendUpdates="all" if send_notifications and attendees else "none",
            ).execute()

            return {
                "status": "created",
                "event_id": result.get("id"),
                "link": result.get("htmlLink"),
                "attendees_invited": len(attendees) if attendees else 0,
            }

        except Exception as e:
            print(f"[GoogleCalendar] Error creating event: {e}")
            return {"error": str(e)}

    def update_event(
        self,
        event_id: str,
        title: str = None,
        description: str = None,
        start_time: str = None,
        end_time: str = None,
        duration_minutes: int = 60,
        location: str = None,
        attendees: list[str] = None,
        send_notifications: bool = True,
        calendar_id: str = "primary",
    ) -> dict:
        """Update an existing calendar event."""
        try:
            # Get existing event
            event = self.service.events().get(
                calendarId=calendar_id, eventId=event_id
            ).execute()

            # Update fields if provided
            if title:
                event["summary"] = title
            if description is not None:
                event["description"] = description
            if location is not None:
                event["location"] = location
            if start_time:
                if "T" in start_time:
                    start_dt = datetime.fromisoformat(start_time.replace("Z", ""))
                else:
                    start_dt = datetime.strptime(start_time, "%Y-%m-%d").replace(hour=9)

                if end_time:
                    if "T" in end_time:
                        end_dt = datetime.fromisoformat(end_time.replace("Z", ""))
                    else:
                        end_dt = datetime.strptime(end_time, "%Y-%m-%d").replace(hour=10)
                else:
                    end_dt = start_dt + timedelta(minutes=duration_minutes)

                event["start"] = {"dateTime": start_dt.isoformat(), "timeZone": "Europe/Berlin"}
                event["end"] = {"dateTime": end_dt.isoformat(), "timeZone": "Europe/Berlin"}

            # Update attendees if provided
            if attendees is not None:
                event["attendees"] = [{"email": email} for email in attendees]

            result = self.service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event,
                sendUpdates="all" if send_notifications else "none",
            ).execute()

            return {"status": "updated", "event_id": result.get("id"), "link": result.get("htmlLink")}
        except Exception as e:
            print(f"[GoogleCalendar] Error updating event: {e}")
            return {"error": str(e)}

    def delete_event(self, event_id: str, calendar_id: str = "primary") -> dict:
        """Delete a calendar event."""
        try:
            self.service.events().delete(
                calendarId=calendar_id, eventId=event_id
            ).execute()
            return {"status": "deleted", "event_id": event_id}
        except Exception as e:
            print(f"[GoogleCalendar] Error deleting event: {e}")
            return {"error": str(e)}

    def list_events(
        self,
        max_results: int = 10,
        time_min: str = None,
        time_max: str = None,
        calendar_id: str = "primary",
    ) -> list[dict]:
        """List upcoming events.

        Args:
            max_results: Maximum number of events to return
            time_min: Start time filter in ISO format (default: now)
            time_max: End time filter in ISO format (optional)
            calendar_id: Calendar ID (default: "primary")
        """
        try:
            if time_min:
                # Ensure it has timezone
                if not time_min.endswith("Z") and "+" not in time_min:
                    time_min = time_min + "Z"
            else:
                time_min = datetime.now().isoformat() + "Z"

            params = {
                "calendarId": calendar_id,
                "timeMin": time_min,
                "maxResults": max_results,
                "singleEvents": True,
                "orderBy": "startTime",
            }

            if time_max:
                if not time_max.endswith("Z") and "+" not in time_max:
                    time_max = time_max + "Z"
                params["timeMax"] = time_max

            result = self.service.events().list(**params).execute()

            events = []
            for event in result.get("items", []):
                events.append({
                    "id": event.get("id"),
                    "title": event.get("summary"),
                    "description": event.get("description", ""),
                    "start": event.get("start", {}).get("dateTime", event.get("start", {}).get("date")),
                    "end": event.get("end", {}).get("dateTime", event.get("end", {}).get("date")),
                    "location": event.get("location", ""),
                    "link": event.get("htmlLink"),
                })
            return events

        except Exception as e:
            return [{"error": str(e)}]
