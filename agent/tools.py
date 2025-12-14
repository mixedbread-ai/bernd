"""Tool schemas for the OpenAI model."""

from constants import TodoStatus, Priority

# Tool schemas for the model
TOOLS = [
    {
        "type": "function",
        "name": "add_todo",
        "description": "Add a new todo item.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Todo title"},
                "description": {
                    "type": "string",
                    "description": "Detailed description",
                },
                "due_date": {"type": "string", "description": "Due date (ISO 8601)"},
                "priority": {
                    "type": "string",
                    "enum": [p.value for p in Priority],
                },
                "status": {
                    "type": "string",
                    "enum": [s.value for s in TodoStatus],
                },
                "tags": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["title"],
        },
    },
    {
        "type": "function",
        "name": "get_todos",
        "description": "List all todos.",
        "parameters": {
            "type": "object",
            "properties": {
                "n": {"type": "integer", "description": "Number of todos to retrieve"},
            },
        },
    },
    {
        "type": "function",
        "name": "search_todos",
        "description": "Search todos by semantic meaning.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
            },
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "remove_todo",
        "description": "Delete a todo permanently.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Todo title to remove"},
            },
            "required": ["title"],
        },
    },
    {
        "type": "function",
        "name": "update_todo",
        "description": "Update an existing todo. Use status='completed' to mark done.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Current todo title"},
                "new_title": {"type": "string", "description": "New title"},
                "description": {"type": "string"},
                "due_date": {"type": "string"},
                "priority": {
                    "type": "string",
                    "enum": [p.value for p in Priority],
                },
                "status": {
                    "type": "string",
                    "enum": [s.value for s in TodoStatus],
                },
                "tags": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["title"],
        },
    },
    {
        "type": "function",
        "name": "memory",
        "description": """Manage memories about the user.
Commands:
- search: Semantic search across ALL memories. Use natural language query like "Max" or "board member". No path needed.
- view: Read a specific file (path required) or list all files (path="/memories/")
- create: Write content to a path
- str_replace: Replace text in a file
- insert: Insert text at a line number
- delete: Remove a file""",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": [
                        "search",
                        "view",
                        "create",
                        "delete",
                        "str_replace",
                        "insert",
                    ],
                },
                "query": {
                    "type": "string",
                    "description": "Natural language search query (for search command only)",
                },
                "path": {
                    "type": "string",
                    "description": "File path like /memories/user.md (not needed for search)",
                },
                "content": {"type": "string", "description": "Content to write"},
                "old_str": {"type": "string"},
                "new_str": {"type": "string"},
                "insert_line": {"type": "integer"},
            },
            "required": ["command"],
        },
    },
    {
        "type": "function",
        "name": "web_search",
        "description": "Search the web for current information.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "top_k": {"type": "integer", "description": "Number of results"},
            },
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "calendar",
        "description": """Manage the user's Google Calendar.
Commands:
- list: List upcoming events (use time_min/time_max to filter by date range)
- create: Create a new event (can invite attendees via email)
- update: Update an existing event by event_id
- delete: Delete an event by event_id""",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["list", "create", "update", "delete"],
                    "description": "The calendar operation to perform",
                },
                "event_id": {
                    "type": "string",
                    "description": "Event ID (required for update/delete)",
                },
                "title": {
                    "type": "string",
                    "description": "Event title (required for create)",
                },
                "description": {
                    "type": "string",
                    "description": "Event description",
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or date (YYYY-MM-DD)",
                },
                "end_time": {
                    "type": "string",
                    "description": "End time in ISO format (optional, uses duration if not set)",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Duration in minutes (default: 60, ignored if end_time provided)",
                },
                "location": {
                    "type": "string",
                    "description": "Event location",
                },
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of email addresses to invite",
                },
                "send_notifications": {
                    "type": "boolean",
                    "description": "Send email invites to attendees (default: true)",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Max events to return for list (default: 10)",
                },
                "time_min": {
                    "type": "string",
                    "description": "Start of time range for list (ISO format, default: now)",
                },
                "time_max": {
                    "type": "string",
                    "description": "End of time range for list (ISO format)",
                },
            },
            "required": ["command"],
        },
    },
    {
        "type": "function",
        "name": "files",
        "description": """Semantic filesystem for storing and retrieving any data.
Commands:
- read: Read file content from a path
- write: Write content to a path (with optional metadata dict)
- delete: Remove a file
- list: List files under a path prefix (default: /)
- search: Semantic search with natural language query (optionally scoped to path prefix)
- update: Replace old_str with new_str in a file""",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["read", "write", "delete", "list", "search", "update"],
                },
                "path": {
                    "type": "string",
                    "description": "File path like /notes/meeting.md or prefix like /notes/",
                },
                "content": {"type": "string", "description": "Content to write"},
                "metadata": {"type": "object", "description": "Optional metadata dict"},
                "query": {
                    "type": "string",
                    "description": "Natural language search query",
                },
                "old_str": {
                    "type": "string",
                    "description": "String to replace (for update)",
                },
                "new_str": {
                    "type": "string",
                    "description": "Replacement string (for update)",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max files to list (default: 100)",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Max search results (default: 10)",
                },
            },
            "required": ["command"],
        },
    },
]
