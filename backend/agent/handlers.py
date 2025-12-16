"""Tool handlers for the agent."""

from ..constants import FileType, TodoStatus, Priority, Paths
from ..tools.semantic_fs import SemanticFS
from ..tools.google_calendar import GoogleCalendar


def create_handlers(fs: SemanticFS, get_gcal: callable, mxb_api_key: str):
    """Create handler functions with injected dependencies."""

    def add_todo(args):
        title = args["title"]
        description = args.get("description", "")
        due_date = args.get("due_date", "")
        content = f"# {title}\n\n{description}"

        metadata = {
            "type": FileType.TODO.value,
            "due_date": due_date,
            "priority": args.get("priority", Priority.MEDIUM.value),
            "status": args.get("status", TodoStatus.PENDING.value),
            "tags": args.get("tags", []),
        }

        # Create calendar event if due_date is set and gcal is configured
        cal_result = None
        gcal = get_gcal()
        if gcal and due_date:
            cal_result = gcal.create_event(
                title=title,
                description=description,
                start_time=due_date,
                duration_minutes=30,
            )
            if cal_result.get("event_id"):
                metadata["calendar_event_id"] = cal_result["event_id"]

        # Save to semantic filesystem
        result = fs.write(f"{Paths.TODOS}/{title}.md", content, metadata)

        if cal_result:
            result["calendar"] = cal_result

        return result

    def get_todos(args):
        files = fs.list(prefix=Paths.TODOS, limit=args.get("n", 20))
        return [
            {"title": f["path"].split("/")[-1].replace(".md", ""), **f["metadata"]}
            for f in files
        ]

    def search_todos(args):
        return fs.search(args["query"], prefix=Paths.TODOS, top_k=args.get("top_k", 10))

    def remove_todo(args):
        title = args["title"]

        # Get existing todo to check for calendar event
        existing = fs.read(f"{Paths.TODOS}/{title}.md")
        event_id = existing.get("metadata", {}).get("calendar_event_id")

        # Delete calendar event if exists
        gcal = get_gcal()
        if gcal and event_id:
            gcal.delete_event(event_id)

        return fs.delete(f"{Paths.TODOS}/{title}.md")

    def update_todo(args):
        title = args["title"]
        new_title = args.get("new_title", title)
        description = args.get("description", "")
        due_date = args.get("due_date", "")
        status = args.get("status", TodoStatus.PENDING.value)
        content = f"# {new_title}\n\n{description}"

        # Get existing todo metadata
        existing = fs.read(f"{Paths.TODOS}/{title}.md")
        existing_meta = existing.get("metadata", {})
        event_id = existing_meta.get("calendar_event_id")

        metadata = {
            "type": FileType.TODO.value,
            "due_date": due_date,
            "priority": args.get("priority", Priority.MEDIUM.value),
            "status": status,
            "tags": args.get("tags", []),
        }

        # Handle calendar event
        cal_result = None
        gcal = get_gcal()
        if gcal:
            if status == TodoStatus.COMPLETED.value and event_id:
                # Delete calendar event when todo is completed
                cal_result = gcal.delete_event(event_id)
            elif event_id and due_date:
                # Update existing event
                cal_result = gcal.update_event(
                    event_id=event_id,
                    title=new_title,
                    description=description,
                    start_time=due_date,
                    duration_minutes=30,
                )
                metadata["calendar_event_id"] = event_id
            elif not event_id and due_date and status != TodoStatus.COMPLETED.value:
                # Create new event if todo didn't have one but now has due_date
                cal_result = gcal.create_event(
                    title=new_title,
                    description=description,
                    start_time=due_date,
                    duration_minutes=30,
                )
                if cal_result.get("event_id"):
                    metadata["calendar_event_id"] = cal_result["event_id"]

        if new_title != title:
            fs.delete(f"{Paths.TODOS}/{title}.md")

        result = fs.write(f"{Paths.TODOS}/{new_title}.md", content, metadata)

        if cal_result:
            result["calendar"] = cal_result

        return result

    def memory(args):
        cmd = args["command"]
        path = args.get("path", Paths.MEMORIES)

        if cmd == "view":
            if path == Paths.MEMORIES or path.endswith("/"):
                return {"files": fs.list(prefix=path)}
            return fs.read(path)
        elif cmd == "create":
            return fs.write(path, args["content"], {"type": FileType.MEMORY.value})
        elif cmd == "delete":
            return fs.delete(path)
        elif cmd == "search":
            return fs.search(
                args["query"], prefix=Paths.MEMORIES, top_k=args.get("top_k", 10)
            )
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
                path,
                "\n".join(lines),
                result.get("metadata", {"type": FileType.MEMORY.value}),
            )

        return {"error": f"Unknown command: {cmd}"}

    def web_search(args):
        from tools.websearch import WebSearch

        ws = WebSearch(api_key=mxb_api_key)
        return ws.search(args["query"], args.get("top_k", 10))

    def calendar(args):
        gcal = get_gcal()  # Get fresh instance each call
        if not gcal:
            return {"error": "Google Calendar not configured. Connect it in the sidebar."}

        cmd = args.get("command", "list")

        if cmd == "list":
            return gcal.list_events(
                max_results=args.get("max_results", 10),
                time_min=args.get("time_min"),
                time_max=args.get("time_max"),
            )
        elif cmd == "create":
            if not args.get("title"):
                return {"error": "title is required for create"}
            if not args.get("start_time"):
                return {"error": "start_time is required for create"}
            return gcal.create_event(
                title=args["title"],
                description=args.get("description", ""),
                start_time=args["start_time"],
                end_time=args.get("end_time"),
                duration_minutes=args.get("duration_minutes", 60),
                location=args.get("location", ""),
                attendees=args.get("attendees"),
                send_notifications=args.get("send_notifications", True),
            )
        elif cmd == "update":
            if not args.get("event_id"):
                return {"error": "event_id is required for update"}
            return gcal.update_event(
                event_id=args["event_id"],
                title=args.get("title"),
                description=args.get("description"),
                start_time=args.get("start_time"),
                end_time=args.get("end_time"),
                duration_minutes=args.get("duration_minutes", 60),
                location=args.get("location"),
                attendees=args.get("attendees"),
                send_notifications=args.get("send_notifications", True),
            )
        elif cmd == "delete":
            if not args.get("event_id"):
                return {"error": "event_id is required for delete"}
            return gcal.delete_event(event_id=args["event_id"])

        return {"error": f"Unknown command: {cmd}"}

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

    def notes(args):
        from datetime import datetime

        cmd = args["command"]
        notes_prefix = "/notes"

        if cmd == "list":
            files = fs.list(prefix=notes_prefix, limit=50)
            return {
                "notes": [
                    {
                        "title": f["metadata"].get(
                            "title", f["path"].split("/")[-1].replace(".md", "")
                        ),
                        "updated_at": f["metadata"].get("updated_at", ""),
                        "path": f["path"],
                    }
                    for f in files
                ]
            }

        elif cmd == "create":
            if not args.get("title"):
                return {"error": "title is required for create"}
            note_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = f"{notes_prefix}/{note_id}.md"
            content = args.get("content", "") or " "
            updated_at = datetime.now().isoformat()
            fs.write(
                path,
                content,
                {
                    "type": "note",
                    "title": args["title"],
                    "updated_at": updated_at,
                },
            )
            return {
                "status": "created",
                "title": args["title"],
                "path": path,
                "updated_at": updated_at,
            }

        elif cmd == "read":
            if not args.get("title"):
                return {"error": "title is required for read"}
            # Search for note by title
            files = fs.list(prefix=notes_prefix, limit=100)
            for f in files:
                note_title = f["metadata"].get(
                    "title", f["path"].split("/")[-1].replace(".md", "")
                )
                if note_title.lower() == args["title"].lower():
                    result = fs.read(f["path"])
                    return {
                        "title": note_title,
                        "content": result.get("content", ""),
                        "updated_at": f["metadata"].get("updated_at", ""),
                        "path": f["path"],
                    }
            return {"error": f"Note not found: {args['title']}"}

        elif cmd == "update":
            if not args.get("title"):
                return {"error": "title is required for update"}
            # Find note by title
            files = fs.list(prefix=notes_prefix, limit=100)
            for f in files:
                note_title = f["metadata"].get(
                    "title", f["path"].split("/")[-1].replace(".md", "")
                )
                if note_title.lower() == args["title"].lower():
                    existing = fs.read(f["path"])
                    new_title = args.get("new_title", note_title)
                    new_content = args.get("content", existing.get("content", ""))
                    updated_at = datetime.now().isoformat()
                    fs.write(
                        f["path"],
                        new_content if new_content else " ",
                        {
                            "type": "note",
                            "title": new_title,
                            "updated_at": updated_at,
                        },
                    )
                    return {
                        "status": "updated",
                        "title": new_title,
                        "path": f["path"],
                        "updated_at": updated_at,
                    }
            return {"error": f"Note not found: {args['title']}"}

        elif cmd == "delete":
            if not args.get("title"):
                return {"error": "title is required for delete"}
            # Find and delete note by title
            files = fs.list(prefix=notes_prefix, limit=100)
            for f in files:
                note_title = f["metadata"].get(
                    "title", f["path"].split("/")[-1].replace(".md", "")
                )
                if note_title.lower() == args["title"].lower():
                    fs.delete(f["path"])
                    return {"status": "deleted", "title": note_title}
            return {"error": f"Note not found: {args['title']}"}

        elif cmd == "search":
            if not args.get("query"):
                return {"error": "query is required for search"}
            results = fs.search(
                args["query"], prefix=notes_prefix, top_k=args.get("top_k", 10)
            )
            return {
                "results": [
                    {
                        "title": r["metadata"].get(
                            "title", r["path"].split("/")[-1].replace(".md", "")
                        ),
                        "content": r.get("content", "")[:200] + "..."
                        if len(r.get("content", "")) > 200
                        else r.get("content", ""),
                        "score": r["score"],
                        "path": r["path"],
                    }
                    for r in results
                ]
            }

        return {"error": f"Unknown command: {cmd}"}

    # Return handlers map
    return {
        "add_todo": add_todo,
        "get_todos": get_todos,
        "search_todos": search_todos,
        "remove_todo": remove_todo,
        "update_todo": update_todo,
        "memory": memory,
        "web_search": web_search,
        "calendar": calendar,
        "files": files,
        "notes": notes,
    }
