from datetime import datetime
from openai import OpenAI
import json
import os
from dotenv import load_dotenv
from tools.semantic_fs import SemanticFS
from tools.google_calendar import GoogleCalendar
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from prompt_toolkit import prompt
from prompt_toolkit.history import FileHistory

console = Console()

load_dotenv()

client = OpenAI()

MXB_API_KEY = "mxb_1vSxuB164YolnL3weMAdLoHsc7tS"

# Token tracking
token_usage = {"input": 0, "output": 0}

# Initialize semantic filesystem
fs = SemanticFS(api_key=MXB_API_KEY, store_name="bernd")

# Initialize Google Calendar (if configured)
gcal_email = os.getenv("GOOGLE_CALENDAR_EMAIL")
gcal = GoogleCalendar(gcal_email) if gcal_email else None


# ─────────────────────────────────────────────────────────────
# Tool handlers
# ─────────────────────────────────────────────────────────────


def add_todo(args):
    title = args["title"]
    description = args.get("description", "")
    due_date = args.get("due_date", "")
    content = f"# {title}\n\n{description}"

    metadata = {
        "type": "todo",
        "due_date": due_date,
        "priority": args.get("priority", "medium"),
        "status": args.get("status", "pending"),
        "tags": args.get("tags", []),
    }

    # Create calendar event if due_date is set and gcal is configured
    cal_result = None
    if gcal and due_date:
        cal_result = gcal.create_event(
            title=title,
            description=description,
            due_date=due_date,
        )
        if cal_result.get("event_id"):
            metadata["calendar_event_id"] = cal_result["event_id"]

    # Save to semantic filesystem
    result = fs.write(f"/todos/{title}.md", content, metadata)

    if cal_result:
        result["calendar"] = cal_result

    return result


def get_todos(args):
    files = fs.list(prefix="/todos", limit=args.get("n", 20))
    return [
        {"title": f["path"].split("/")[-1].replace(".md", ""), **f["metadata"]}
        for f in files
    ]


def search_todos(args):
    return fs.search(args["query"], prefix="/todos", top_k=args.get("top_k", 10))


def remove_todo(args):
    title = args["title"]

    # Get existing todo to check for calendar event
    existing = fs.read(f"/todos/{title}.md")
    event_id = existing.get("metadata", {}).get("calendar_event_id")

    # Delete calendar event if exists
    if gcal and event_id:
        gcal.delete_event(event_id)

    return fs.delete(f"/todos/{title}.md")


def update_todo(args):
    title = args["title"]
    new_title = args.get("new_title", title)
    description = args.get("description", "")
    due_date = args.get("due_date", "")
    status = args.get("status", "pending")
    content = f"# {new_title}\n\n{description}"

    # Get existing todo metadata
    existing = fs.read(f"/todos/{title}.md")
    existing_meta = existing.get("metadata", {})
    event_id = existing_meta.get("calendar_event_id")

    metadata = {
        "type": "todo",
        "due_date": due_date,
        "priority": args.get("priority", "medium"),
        "status": status,
        "tags": args.get("tags", []),
    }

    # Handle calendar event
    cal_result = None
    if gcal:
        if status == "completed" and event_id:
            # Delete calendar event when todo is completed
            cal_result = gcal.delete_event(event_id)
        elif event_id and due_date:
            # Update existing event
            cal_result = gcal.update_event(
                event_id=event_id,
                title=new_title,
                description=description,
                due_date=due_date,
            )
            metadata["calendar_event_id"] = event_id
        elif not event_id and due_date and status != "completed":
            # Create new event if todo didn't have one but now has due_date
            cal_result = gcal.create_event(
                title=new_title,
                description=description,
                due_date=due_date,
            )
            if cal_result.get("event_id"):
                metadata["calendar_event_id"] = cal_result["event_id"]

    if new_title != title:
        fs.delete(f"/todos/{title}.md")

    result = fs.write(f"/todos/{new_title}.md", content, metadata)

    if cal_result:
        result["calendar"] = cal_result

    return result


def memory(args):
    cmd = args["command"]
    path = args.get("path", "/memories")

    if cmd == "view":
        if path == "/memories" or path.endswith("/"):
            return {"files": fs.list(prefix=path)}
        return fs.read(path)
    elif cmd == "create":
        return fs.write(path, args["content"], {"type": "memory"})
    elif cmd == "delete":
        return fs.delete(path)
    elif cmd == "search":
        return fs.search(args["query"], prefix="/memories", top_k=args.get("top_k", 10))
    elif cmd == "str_replace":
        result = fs.read(path)
        if "error" in result:
            return result
        new_content = result["content"].replace(args["old_str"], args["new_str"], 1)
        return fs.write(path, new_content, result.get("metadata", {}))
    elif cmd == "insert":
        result = fs.read(path)
        content = result.get("content", "") if "error" not in result else ""
        lines = content.split("\n")
        idx = max(0, min(args.get("insert_line", 1) - 1, len(lines)))
        lines.insert(idx, args["new_str"])
        return fs.write(
            path, "\n".join(lines), result.get("metadata", {"type": "memory"})
        )

    return {"error": f"Unknown command: {cmd}"}


def web_search(args):
    from tools.websearch import WebSearch

    ws = WebSearch(api_key=MXB_API_KEY)
    return ws.search(args["query"], args.get("top_k", 10))


def files(args):
    cmd = args["command"]
    path = args.get("path", "/")

    if cmd == "read":
        return fs.read(path)
    elif cmd == "write":
        metadata = args.get("metadata", {})
        return fs.write(path, args["content"], metadata)
    elif cmd == "delete":
        return fs.delete(path)
    elif cmd == "list":
        return {"files": fs.list(prefix=path, limit=args.get("limit", 100))}
    elif cmd == "search":
        return fs.search(args["query"], prefix=path, top_k=args.get("top_k", 10))
    elif cmd == "update":
        result = fs.read(path)
        if "error" in result:
            return result
        new_content = result["content"].replace(args["old_str"], args["new_str"], 1)
        return fs.write(path, new_content, result.get("metadata", {}))

    return {"error": f"Unknown command: {cmd}"}


# Tool handlers map
HANDLERS = {
    "add_todo": add_todo,
    "get_todos": get_todos,
    "search_todos": search_todos,
    "remove_todo": remove_todo,
    "update_todo": update_todo,
    "memory": memory,
    "web_search": web_search,
    "files": files,
}

# Tool schemas for the model
tools = [
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
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
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
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
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

USER_PROFILE_PATH = "/memories/user.md"


def load_user_profile() -> str:
    """Load the user profile from memory. Returns empty string if not found."""
    result = fs.read(USER_PROFILE_PATH)
    if "error" in result:
        return ""
    return result.get("content", "")


def get_system_prompt() -> str:
    """Build system prompt with user profile injected."""
    user_profile = load_user_profile()

    profile_section = ""
    if user_profile:
        profile_section = f"""
## User Profile
{user_profile}
"""

    return f"""You are Bernd, a personal chief of staff. Today is {datetime.now().strftime("%A, %Y-%m-%d")}.

You help your principal stay organized and productive.

## CRITICAL: Always Search First

When the user asks about ANYTHING specific to them – "my project", "my case", "my meeting", a person's name, their company, etc. – you MUST search before responding:

1. Use `files(command="search", query="...")` to search ALL stored files under /memories/.
2. Optionally use `memory(command="search", query="...")` if legacy memory files exist.

Read the most relevant files (e.g. user.md, entities/*, projects/*, people/*) before answering.

NEVER give a generic answer when the user asks about their own stuff. Search first, then answer using that context.

## Tools Available
- Todos: add_todo, get_todos, search_todos, update_todo, remove_todo
- Memory: memory tool for /memories/* (search, view, create, update, delete)
- Files: files tool for any path (search, read, write, list, update, delete)
- Web: web_search for current information

{profile_section}
## User Profile

The user profile at {USER_PROFILE_PATH} is automatically loaded above.
- Update it when you learn important facts (name, role, preferences, key contacts)
- Use xml format: <name>...</name>, <role>...</role>, <contacts>...</contacts>

## Memory Usage

You have access to a semantic memory store under /memories/.

Core files:
- /memories/user.md
  - User identity, role, key contacts, and stable preferences.

You may also create and use:
- /memories/entities/<name>_org.md
  - For organizations the user is closely involved with (e.g. their company, a major client).
- /memories/projects/<name>.md
  - For long-running projects or initiatives.
- /memories/people/<name>.md
  - For important recurring people (team members, investors, key clients, etc).

### When to Store

Store information when:
- It is likely to remain relevant for weeks or months.
- It concerns the user’s identity, preferences, ongoing work, organizations, projects, or key relationships.
- It is not trivial small talk or one-off logistics.

Do NOT store:
- Ephemeral feelings ("I'm tired today").
- One-off details that will not matter later, unless the user explicitly asks.

### Where to Store (Routing)

When deciding where to write:

1. If it’s about who the user is, how they like to work, or their close network in general:
   - Update /memories/user.md.

2. If it’s about an organization (e.g. the user’s company or a major client):
   - Create or update /memories/entities/<org_name>_org.md.

3. If it’s about a specific ongoing project or initiative:
   - Create or update /memories/projects/<project_name>.md.

4. If it’s about a recurring person (collaborator, investor, key customer):
   - Create or update /memories/people/<person_name>.md.

Keep entries concise and factual (bullets or short paragraphs), not raw conversation transcripts.

Be concise, direct, and action-oriented."""


def execute_function(name: str, args: dict):
    handler = HANDLERS.get(name)
    if handler:
        return handler(args)
    return {"error": f"Unknown function: {name}"}


def run_agent(
    input_list: list, max_iterations: int = 15, return_tool_calls: bool = False
):
    """Run the agent. If return_tool_calls=True, returns dict with response and tool_calls."""
    global token_usage
    tool_calls_log = []

    for _ in range(max_iterations):
        response = client.responses.create(
            model="gpt-5.1",
            instructions=get_system_prompt(),
            tools=tools,
            input=input_list,
            reasoning={"effort": "medium"},
        )

        if hasattr(response, "usage") and response.usage:
            token_usage["input"] += response.usage.input_tokens
            token_usage["output"] += response.usage.output_tokens

        input_list.extend(response.output)

        has_function_calls = False
        for item in response.output:
            if item.type == "function_call":
                has_function_calls = True
                args = json.loads(item.arguments)
                console.print(f"  [dim]→ {item.name}[/dim]", end="")
                console.print(f"[dim]({json.dumps(args, default=str)})[/dim]")

                result = execute_function(item.name, args)

                # Log tool call
                tool_calls_log.append(
                    {
                        "name": item.name,
                        "args": args,
                    }
                )

                input_list.append(
                    {
                        "type": "function_call_output",
                        "call_id": item.call_id,
                        "output": json.dumps(result, default=str),
                    }
                )

        if not has_function_calls:
            if return_tool_calls:
                return {"response": response.output_text, "tool_calls": tool_calls_log}
            return response.output_text

    result_text = "Max iterations reached."
    if return_tool_calls:
        return {"response": result_text, "tool_calls": tool_calls_log}
    return result_text


def run_agent_stream(input_list: list, max_iterations: int = 15):
    """Run the agent and yield events for streaming."""
    global token_usage

    for _ in range(max_iterations):
        # Track function calls and text during streaming
        function_calls = {}  # call_id -> {name, arguments}
        final_text = ""
        has_function_calls = False

        with client.responses.stream(
            model="gpt-5.1",
            instructions=get_system_prompt(),
            tools=tools,
            input=input_list,
            reasoning={"effort": "medium"},
        ) as stream:
            for event in stream:
                # Handle text deltas - stream them immediately
                if event.type == "response.output_text.delta":
                    yield {"type": "text_delta", "delta": event.delta}
                    final_text += event.delta

                # Handle function call arguments being streamed
                elif event.type == "response.function_call_arguments.delta":
                    call_id = event.item_id
                    if call_id not in function_calls:
                        function_calls[call_id] = {"name": None, "arguments": ""}
                    function_calls[call_id]["arguments"] += event.delta

                # Handle function call output item added (get the function name)
                elif event.type == "response.output_item.added":
                    if (
                        hasattr(event.item, "type")
                        and event.item.type == "function_call"
                    ):
                        has_function_calls = True
                        call_id = event.item.id
                        function_calls[call_id] = {
                            "name": event.item.name,
                            "arguments": "",
                            "call_id": event.item.call_id,
                        }

            # Get the final response for adding to input_list
            response = stream.get_final_response()

        if hasattr(response, "usage") and response.usage:
            token_usage["input"] += response.usage.input_tokens
            token_usage["output"] += response.usage.output_tokens

        input_list.extend(response.output)

        # Process function calls if any
        if has_function_calls:
            for item in response.output:
                if item.type == "function_call":
                    args = json.loads(item.arguments)

                    # Yield tool call event
                    yield {"type": "tool_call", "name": item.name, "args": args}

                    result = execute_function(item.name, args)

                    input_list.append(
                        {
                            "type": "function_call_output",
                            "call_id": item.call_id,
                            "output": json.dumps(result, default=str),
                        }
                    )
        else:
            # No function calls - we're done, final text was already streamed
            yield {"type": "response_end", "content": final_text}
            return

    yield {"type": "response_end", "content": "Max iterations reached."}


def show_cost():
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(style="dim")
    table.add_column(justify="right")
    table.add_row("Input tokens", f"{token_usage['input']:,}")
    table.add_row("Output tokens", f"{token_usage['output']:,}")
    table.add_row(
        "Total", f"[bold]{token_usage['input'] + token_usage['output']:,}[/bold]"
    )
    console.print()
    console.print(Panel(table, title="Token Usage", border_style="dim"))


def main():
    console.print()
    console.print("[bold]Bernd[/bold] [dim]— Chief of Staff[/dim]")
    console.print("[dim]Type 'quit' to exit, '/cost' for token usage[/dim]")

    conversation = []
    history = FileHistory(".bernd_history")

    while True:
        try:
            console.print()
            user_input = prompt("You: ", history=history).strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Goodbye![/dim]")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "q"):
            console.print("[dim]Goodbye![/dim]")
            break

        if user_input.lower() == "/cost":
            show_cost()
            continue

        conversation.append({"role": "user", "content": user_input})

        console.print()
        console.print("[bold]Bernd:[/bold] ", end="")
        response = run_agent(conversation)
        console.print(Markdown(response))


if __name__ == "__main__":
    main()
