"""CLI interface for the agent."""

import json
from datetime import datetime
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from prompt_toolkit import prompt
from prompt_toolkit.history import FileHistory

console = Console()

# Lazy-loaded OpenAI client
_openai_client = None


def get_openai_client():
    """Get OpenAI client, creating it lazily."""
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI()
    return _openai_client


def show_cost(token_usage: dict):
    """Display token usage statistics."""
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


def generate_chat_title(messages: list) -> str:
    """Generate a title using LLM to summarize the conversation."""
    if not messages:
        return "New chat"

    # Filter to only include dict messages with role and content
    valid_messages = [
        msg for msg in messages
        if isinstance(msg, dict) and "role" in msg and "content" in msg
    ]

    if not valid_messages:
        return "New chat"

    conversation_text = "\n".join(
        f"{msg['role'].upper()}: {msg['content'][:500]}"
        for msg in valid_messages[:6]
    )

    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, no quotes or punctuation at the end."
                },
                {
                    "role": "user",
                    "content": conversation_text
                }
            ],
            max_tokens=20,
            temperature=0.7,
        )
        title = response.choices[0].message.content.strip()
        title = title.strip('"\'').rstrip('.')
        return title[:50]
    except Exception as e:
        console.print(f"[dim]Title generation failed: {e}[/dim]")
        for msg in valid_messages:
            if msg["role"] == "user":
                title = msg["content"][:50]
                if len(msg["content"]) > 50:
                    title += "..."
                return title
        return "New chat"


def save_chat(fs, chat_id: str, messages: list):
    """Save chat to semantic filesystem."""
    # Filter to only include serializable dict messages
    valid_messages = [
        msg for msg in messages
        if isinstance(msg, dict) and "role" in msg and "content" in msg
    ]
    title = generate_chat_title(valid_messages)
    content = json.dumps(valid_messages)
    fs.write(
        f"/chats/{chat_id}.json",
        content,
        {
            "type": "chat",
            "title": title,
            "message_count": len(valid_messages),
        },
    )
    return title


def load_chat(fs, chat_id: str) -> list[dict] | None:
    """Load a chat from semantic filesystem."""
    result = fs.read(f"/chats/{chat_id}.json")
    if "error" in result:
        return None
    try:
        return json.loads(result.get("content", "[]"))
    except json.JSONDecodeError:
        return None


def list_chats(fs, limit: int = 20) -> list[dict]:
    """List recent chats."""
    files = fs.list(prefix="/chats", limit=limit)
    chats = []
    for f in files:
        chat_id = f["path"].split("/")[-1].replace(".json", "")
        chats.append({
            "id": chat_id,
            "title": f["metadata"].get("title", "Untitled"),
            "message_count": f["metadata"].get("message_count", 0),
        })
    return chats


def show_chats(fs):
    """Display list of chats."""
    chats = list_chats(fs)
    if not chats:
        console.print("[dim]No saved chats[/dim]")
        return

    table = Table(show_header=True, header_style="bold", box=None)
    table.add_column("#", style="dim", width=3)
    table.add_column("Title")
    table.add_column("Messages", justify="right", width=8)
    table.add_column("ID", style="dim")

    for i, chat in enumerate(chats, 1):
        table.add_row(
            str(i),
            chat["title"],
            str(chat["message_count"]),
            chat["id"]
        )

    console.print()
    console.print(Panel(table, title="Saved Chats", border_style="dim"))
    console.print("[dim]Use '/load <#>' or '/load <id>' to load a chat[/dim]")


def show_help():
    """Display help information."""
    help_text = """
[bold]Commands:[/bold]
  /new          Start a new chat
  /chats        List saved chats
  /load <#|id>  Load a chat by number or ID
  /cost         Show token usage
  /help         Show this help
  quit          Exit
"""
    console.print(help_text)


def main(run_agent_fn, token_usage: dict, fs=None):
    """Run the CLI interface."""
    console.print()
    console.print("[bold]Bernd[/bold] [dim]— Chief of Staff[/dim]")
    console.print("[dim]Type '/help' for commands, 'quit' to exit[/dim]")

    conversation = []
    chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    history = FileHistory(".bernd_history")
    cached_chats = None  # For /load by number

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

        # Handle commands
        if user_input.startswith("/"):
            cmd = user_input.lower().split()[0]
            args = user_input.split()[1:] if len(user_input.split()) > 1 else []

            if cmd == "/cost":
                show_cost(token_usage)
                continue

            if cmd == "/help":
                show_help()
                continue

            if cmd == "/new":
                conversation = []
                chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")
                console.print("[dim]Started new chat[/dim]")
                continue

            if cmd == "/chats":
                if fs:
                    cached_chats = list_chats(fs)
                    show_chats(fs)
                else:
                    console.print("[dim]Chat persistence not available[/dim]")
                continue

            if cmd == "/load":
                if not fs:
                    console.print("[dim]Chat persistence not available[/dim]")
                    continue
                if not args:
                    console.print("[dim]Usage: /load <#> or /load <chat_id>[/dim]")
                    continue

                load_id = args[0]

                # Check if it's a number (reference to cached list)
                if load_id.isdigit() and cached_chats:
                    idx = int(load_id) - 1
                    if 0 <= idx < len(cached_chats):
                        load_id = cached_chats[idx]["id"]
                    else:
                        console.print(f"[dim]Invalid number. Use 1-{len(cached_chats)}[/dim]")
                        continue

                loaded = load_chat(fs, load_id)
                if loaded:
                    conversation = loaded
                    chat_id = load_id
                    console.print(f"[dim]Loaded chat: {load_id} ({len(conversation)} messages)[/dim]")
                    # Show last few messages for context
                    if conversation:
                        console.print("[dim]--- Recent messages ---[/dim]")
                        for msg in conversation[-4:]:
                            role = "[bold]You:[/bold]" if msg["role"] == "user" else "[bold]Bernd:[/bold]"
                            preview = msg["content"][:100] + "..." if len(msg["content"]) > 100 else msg["content"]
                            console.print(f"  {role} {preview}")
                        console.print("[dim]--- End ---[/dim]")
                else:
                    console.print(f"[dim]Chat not found: {load_id}[/dim]")
                continue

            # Unknown command
            console.print(f"[dim]Unknown command: {cmd}. Type '/help' for commands.[/dim]")
            continue

        # Regular message
        conversation.append({"role": "user", "content": user_input})

        console.print()
        console.print("[bold]Bernd:[/bold] ", end="")
        response = run_agent_fn(conversation)
        console.print(Markdown(response))

        # Add assistant response and save
        conversation.append({"role": "assistant", "content": response})

        if fs:
            title = save_chat(fs, chat_id, conversation)
            console.print(f"[dim]Chat saved: {title}[/dim]")
