"""Bernd agent module."""

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

from ..tools.semantic_fs import SemanticFS
from ..tools.google_calendar import GoogleCalendar

from .tools import TOOLS
from .handlers import create_handlers
from .prompts import get_system_prompt
from .core import run_agent as _run_agent, run_agent_stream as _run_agent_stream
from .cli import main as _cli_main, show_cost
from .skills import get_skills, get_skill_tool, get_skill_handler

load_dotenv()

# Initialize OpenAI client
client = OpenAI()

# Default API key (for CLI usage)
MXB_API_KEY = os.getenv("MIXEDBREAD_API_KEY")

# Google OAuth config
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_AUTH_PATH = "/auth/google.json"

# Token tracking
token_usage = {"input": 0, "output": 0}

# Load skills (shared across all users)
_skills = get_skills()

# Build complete tools list (base tools + skill tool if skills exist)
ALL_TOOLS = TOOLS.copy()
if _skills:
    ALL_TOOLS.append(get_skill_tool())

# Cache for user contexts (fs + handlers) per API key
_user_context_cache: dict[str, tuple] = {}


def create_user_context(api_key: str):
    """Create or return cached agent context for a specific user's API key."""
    if api_key in _user_context_cache:
        return _user_context_cache[api_key]

    user_fs = SemanticFS(api_key=api_key, store_name="bernd")

    def get_google_calendar() -> GoogleCalendar | None:
        """Get GoogleCalendar instance using stored OAuth tokens."""
        from ..tools.crypto import decrypt_token, encrypt_token

        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            return None

        # Load tokens from user's mixedbread store
        result = user_fs.read(GOOGLE_AUTH_PATH)
        if "error" in result:
            return None

        try:
            tokens = json.loads(result.get("content", "{}"))
        except json.JSONDecodeError:
            return None

        # Decrypt tokens if encrypted
        if tokens.get("access_token"):
            tokens["access_token"] = decrypt_token(tokens["access_token"])
        if tokens.get("refresh_token"):
            tokens["refresh_token"] = decrypt_token(tokens["refresh_token"])

        if not tokens.get("access_token") or not tokens.get("refresh_token"):
            return None

        def on_token_refresh(new_tokens: dict):
            """Callback to save refreshed tokens (encrypted)."""
            tokens.update(new_tokens)
            encrypted_tokens = {
                **tokens,
                "access_token": encrypt_token(tokens["access_token"]),
                "refresh_token": encrypt_token(tokens["refresh_token"]),
            }
            user_fs.write(GOOGLE_AUTH_PATH, json.dumps(encrypted_tokens), {"type": "auth", "provider": "google"})

        return GoogleCalendar(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            token_expiry=tokens.get("expiry"),
            on_token_refresh=on_token_refresh,
        )

    # Create handlers for this user
    handlers = create_handlers(user_fs, get_google_calendar, api_key)

    # Add skill handler if skills exist
    if _skills:
        handlers["skill"] = get_skill_handler()

    # Cache and return
    _user_context_cache[api_key] = (user_fs, handlers)
    return user_fs, handlers


# Default context for CLI usage
fs = SemanticFS(api_key=MXB_API_KEY, store_name="bernd") if MXB_API_KEY else None


def _get_default_google_calendar() -> GoogleCalendar | None:
    """Get GoogleCalendar for default/CLI context."""
    from ..tools.crypto import decrypt_token, encrypt_token

    if not fs or not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return None

    result = fs.read(GOOGLE_AUTH_PATH)
    if "error" in result:
        return None

    try:
        tokens = json.loads(result.get("content", "{}"))
    except json.JSONDecodeError:
        return None

    # Decrypt tokens if encrypted
    if tokens.get("access_token"):
        tokens["access_token"] = decrypt_token(tokens["access_token"])
    if tokens.get("refresh_token"):
        tokens["refresh_token"] = decrypt_token(tokens["refresh_token"])

    if not tokens.get("access_token") or not tokens.get("refresh_token"):
        return None

    def on_token_refresh(new_tokens: dict):
        """Callback to save refreshed tokens (encrypted)."""
        tokens.update(new_tokens)
        encrypted_tokens = {
            **tokens,
            "access_token": encrypt_token(tokens["access_token"]),
            "refresh_token": encrypt_token(tokens["refresh_token"]),
        }
        fs.write(GOOGLE_AUTH_PATH, json.dumps(encrypted_tokens), {"type": "auth", "provider": "google"})

    return GoogleCalendar(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        token_expiry=tokens.get("expiry"),
        on_token_refresh=on_token_refresh,
    )


# Default handlers for CLI usage
HANDLERS = create_handlers(fs, _get_default_google_calendar, MXB_API_KEY) if fs else {}
if _skills and HANDLERS:
    HANDLERS["skill"] = get_skill_handler()


def run_agent(input_list: list, max_iterations: int = 15, return_tool_calls: bool = False, api_key: str = None):
    """Run the agent. If api_key provided, uses user-specific context."""
    if api_key:
        user_fs, user_handlers = create_user_context(api_key)
        return _run_agent(
            client=client,
            fs=user_fs,
            handlers=user_handlers,
            input_list=input_list,
            token_usage=token_usage,
            tools=ALL_TOOLS,
            max_iterations=max_iterations,
            return_tool_calls=return_tool_calls,
        )
    else:
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


def run_agent_stream(input_list: list, max_iterations: int = 15, api_key: str = None):
    """Run the agent and yield events for streaming. If api_key provided, uses user-specific context."""
    if api_key:
        user_fs, user_handlers = create_user_context(api_key)
        yield from _run_agent_stream(
            client=client,
            fs=user_fs,
            handlers=user_handlers,
            input_list=input_list,
            token_usage=token_usage,
            tools=ALL_TOOLS,
            max_iterations=max_iterations,
        )
    else:
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
