"""CLI interface for the agent."""

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from prompt_toolkit import prompt
from prompt_toolkit.history import FileHistory


console = Console()


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


def main(run_agent_fn, token_usage: dict):
    """Run the CLI interface."""
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
            show_cost(token_usage)
            continue

        conversation.append({"role": "user", "content": user_input})

        console.print()
        console.print("[bold]Bernd:[/bold] ", end="")
        response = run_agent_fn(conversation)
        console.print(Markdown(response))
