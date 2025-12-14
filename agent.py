"""
Bernd agent - backwards compatibility shim.

This module re-exports from the new modular agent package.
The original agent.py has been refactored into:
- agent/tools.py - Tool schemas
- agent/handlers.py - Tool handler functions
- agent/prompts.py - System prompt management
- agent/core.py - Agent execution logic
- agent/cli.py - CLI interface
- agent/__init__.py - Package exports
"""

from agent import (
    run_agent,
    run_agent_stream,
    main,
    token_usage,
    TOOLS as tools,
    HANDLERS,
    fs,
    gcal,
    show_cost,
)

# Re-export for backwards compatibility
__all__ = [
    "run_agent",
    "run_agent_stream",
    "main",
    "token_usage",
    "tools",
    "HANDLERS",
    "fs",
    "gcal",
    "show_cost",
]

if __name__ == "__main__":
    main()
