"""Bernd agent module."""

import os
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

# Token tracking
token_usage = {"input": 0, "output": 0}

# Initialize semantic filesystem
fs = SemanticFS(api_key=MXB_API_KEY, store_name="bernd")

# Initialize Google Calendar (if configured)
gcal_email = os.getenv("GOOGLE_CALENDAR_EMAIL")
gcal = GoogleCalendar(gcal_email) if gcal_email else None

# Create handlers with injected dependencies
HANDLERS = create_handlers(fs, gcal, MXB_API_KEY)

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
    "gcal",
    "show_cost",
    "get_skills",
]
