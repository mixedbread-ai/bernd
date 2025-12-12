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
        due_date: str = None,
        duration_minutes: int = 10,
        calendar_id: str = "primary",
    ) -> dict:
        """Create a calendar event.

        Args:
            title: Event title
            description: Event description
            due_date: ISO date string (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:MM:SS)
            duration_minutes: Event duration in minutes (default 10)
            calendar_id: Calendar ID (default "primary")

        Returns:
            Created event info or error
        """
        if not due_date:
            return {"error": "No due_date provided"}

        try:
            # Parse the due date
            if "T" in due_date:
                # Full datetime provided
                start_dt = datetime.fromisoformat(due_date.replace("Z", ""))
            else:
                # Just date, default to 9 AM
                start_dt = datetime.strptime(due_date, "%Y-%m-%d").replace(hour=9)

            end_dt = start_dt + timedelta(minutes=duration_minutes)

            event = {
                "summary": title,
                "description": description,
                "start": {
                    "dateTime": start_dt.isoformat(),
                    "timeZone": "Europe/Berlin",  # Adjust as needed
                },
                "end": {
                    "dateTime": end_dt.isoformat(),
                    "timeZone": "Europe/Berlin",
                },
            }

            result = self.service.events().insert(
                calendarId=calendar_id, body=event
            ).execute()

            return {
                "status": "created",
                "event_id": result.get("id"),
                "link": result.get("htmlLink"),
            }

        except Exception as e:
            print(f"[GoogleCalendar] Error creating event: {e}")
            return {"error": str(e)}

    def update_event(
        self,
        event_id: str,
        title: str = None,
        description: str = None,
        due_date: str = None,
        duration_hours: int = 1,
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
            if due_date:
                if "T" in due_date:
                    start_dt = datetime.fromisoformat(due_date.replace("Z", ""))
                else:
                    start_dt = datetime.strptime(due_date, "%Y-%m-%d").replace(hour=9)
                end_dt = start_dt + timedelta(hours=duration_hours)
                event["start"] = {"dateTime": start_dt.isoformat(), "timeZone": "Europe/Berlin"}
                event["end"] = {"dateTime": end_dt.isoformat(), "timeZone": "Europe/Berlin"}

            result = self.service.events().update(
                calendarId=calendar_id, eventId=event_id, body=event
            ).execute()

            return {"status": "updated", "event_id": result.get("id")}
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
        self, max_results: int = 10, calendar_id: str = "primary"
    ) -> list[dict]:
        """List upcoming events."""
        try:
            now = datetime.utcnow().isoformat() + "Z"
            result = self.service.events().list(
                calendarId=calendar_id,
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()

            events = []
            for event in result.get("items", []):
                events.append({
                    "id": event.get("id"),
                    "title": event.get("summary"),
                    "start": event.get("start", {}).get("dateTime", event.get("start", {}).get("date")),
                    "link": event.get("htmlLink"),
                })
            return events

        except Exception as e:
            return [{"error": str(e)}]
