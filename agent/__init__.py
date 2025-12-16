"""Bernd agent module."""

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

from tools.semantic_fs import SemanticFS
from tools.google_calendar import GoogleCalendar

from .tools import TOOLS
from .handlers import create_handlers
from .prompts import get_system_prompt
from .core import run_agent as _run_agent, run_agent_stream as _run_agent_stream
from .cli import main as _cli_main, show_cost
from .skills import get_skills, get_skill_tool, get_skill_handler

load_dotenv()

# Initialize OpenAI client
client = OpenAI()

# Get API key
MXB_API_KEY = os.getenv("MIXEDBREAD_API_KEY")

# Google OAuth config
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_AUTH_PATH = "/auth/google.json"

# Token tracking
token_usage = {"input": 0, "output": 0}

# Initialize semantic filesystem
fs = SemanticFS(api_key=MXB_API_KEY, store_name="bernd")


def get_google_calendar() -> GoogleCalendar | None:
    """Get GoogleCalendar instance using stored OAuth tokens."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return None

    # Load tokens from mixedbread
    result = fs.read(GOOGLE_AUTH_PATH)
    if "error" in result:
        return None

    try:
        tokens = json.loads(result.get("content", "{}"))
    except json.JSONDecodeError:
        return None

    if not tokens.get("access_token") or not tokens.get("refresh_token"):
        return None

    def on_token_refresh(new_tokens: dict):
        """Callback to save refreshed tokens."""
        tokens.update(new_tokens)
        fs.write(GOOGLE_AUTH_PATH, json.dumps(tokens), {"type": "auth", "provider": "google"})

    return GoogleCalendar(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        token_expiry=tokens.get("expiry"),
        on_token_refresh=on_token_refresh,
    )


# Create handlers with injected dependencies (pass function for lazy gcal loading)
HANDLERS = create_handlers(fs, get_google_calendar, MXB_API_KEY)

# Load skills and add skill handler
_skills = get_skills()
if _skills:
    HANDLERS["skill"] = get_skill_handler()

# Build complete tools list (base tools + skill tool if skills exist)
ALL_TOOLS = TOOLS.copy()
if _skills:
    ALL_TOOLS.append(get_skill_tool())


def run_agent(input_list: list, max_iterations: int = 15, return_tool_calls: bool = False):
    """Run the agent. If return_tool_calls=True, returns dict with response and tool_calls."""
    return _run_agent(
        client=client,
        fs=fs,
        handlers=HANDLERS,
        input_list=input_list,
        token_usage=token_usage,
        tools=ALL_TOOLS,
        max_iterations=max_iterations,
        return_tool_calls=return_tool_calls,
    )


def run_agent_stream(input_list: list, max_iterations: int = 15):
    """Run the agent and yield events for streaming."""
    yield from _run_agent_stream(
        client=client,
        fs=fs,
        handlers=HANDLERS,
        input_list=input_list,
        token_usage=token_usage,
        tools=ALL_TOOLS,
        max_iterations=max_iterations,
    )


def main():
    """CLI entry point."""
    _cli_main(run_agent, token_usage, fs=fs)


# Export for backwards compatibility
__all__ = [
    "run_agent",
    "run_agent_stream",
    "main",
    "token_usage",
    "TOOLS",
    "ALL_TOOLS",
    "HANDLERS",
    "fs",
    "get_google_calendar",
    "show_cost",
    "get_skills",
]
