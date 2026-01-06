# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bernd is a personal AI chief of staff that manages todos, memories, calendar, and more. It uses OpenAI's GPT models (gpt-5.2 with Responses API) with function calling to provide an intelligent assistant with persistent semantic memory via Mixedbread.

## Development Commands

```bash
# Install dependencies
uv sync                      # Python dependencies
cd ui && bun install         # Frontend dependencies

# Run CLI agent
uv run agent.py

# Run Web UI (requires two terminals)
uv run uvicorn backend.main:app --reload  # API server on port 8000
cd ui && bun run dev                      # Next.js frontend on port 3000

# Lint frontend
cd ui && bun run lint
```

### CLI Commands

When running the CLI agent (`uv run agent.py`):
- `/new` - Start a new chat
- `/chats` - List saved chats
- `/load <#|id>` - Load a chat by number or ID
- `/cost` - Show token usage
- `/help` - Show help
- `quit` - Exit

## Architecture

### Backend (Python)

**Entry Points:**
- `agent.py` - CLI entry point (thin wrapper, calls `backend.agent.main()`)
- `backend/main.py` - FastAPI server with REST endpoints and SSE streaming

**Core Agent Logic (`backend/agent/`):**
- `__init__.py` - Module interface, exports `run_agent()` and `run_agent_stream()`, manages per-user context caching
- `core.py` - Core agent runner functions that manage the OpenAI Responses API tool-calling loop
- `handlers.py` - Tool handler implementations with dependency injection pattern
- `tools.py` - OpenAI function schemas (TOOLS list)
- `prompts.py` - System prompt builder that injects user profile from semantic filesystem
- `skills.py` - Skill loader that parses skill.md files with YAML frontmatter
- `cli.py` - CLI REPL interface with command handling

**Tools (`backend/tools/`):**
- `semantic_fs.py` - SemanticFS class wrapping Mixedbread API for CRUD + semantic search
- `google_calendar.py` - Google Calendar API integration with OAuth token refresh
- `websearch.py` - Web search via Mixedbread

**Key Design Patterns:**
- SemanticFS uses path-like identifiers (e.g., `/todos/task.md`) converted to Mixedbread file IDs
- Per-user context caching: `_user_context_cache` stores (fs, handlers) tuples keyed by API key
- Handlers are created via `create_handlers()` factory with injected dependencies (fs, get_gcal_fn, api_key)
- Skills are modular markdown files that inject specialized prompts when activated via the `skill` tool

### Frontend (`ui/`)

Next.js 16 app with React 19 and Tailwind CSS 4.

**Key Pages:**
- `app/page.tsx` - Todo list homepage
- `app/chat/` - Chat interface with streaming support
- `app/search/` - Semantic search page
- `app/notes/` - Notes management
- `app/files/` - File manager
- `app/settings/` - Settings (Google Calendar OAuth)
- `app/sign-in/` - API key authentication

**Shared Code:**
- `app/components/` - React components (Navbar, FloatingChat, AuthGate, etc.)
- `app/context/` - React context providers (AuthContext, ThemeContext)

### Data Storage

All data is stored in Mixedbread semantic filesystem under these paths:
- `/todos/` - Todo items as markdown files
- `/memories/` - User profile and knowledge
- `/chats/` - Conversation history (JSON)
- `/chat_assets/` - Image attachments for chats
- `/notes/` - User notes
- `/files/` - General file storage
- `/auth/google.json` - Google OAuth tokens

### Skills System

Skills are in `skills/<name>/skill.md` with YAML frontmatter:
```yaml
---
name: skill-name
description: What the skill does
when_to_use: Trigger condition
allowed_tools:
  - tool1
  - tool2
---
# Skill instructions (markdown)
```

## Environment Variables

Required in `.env`:
- `OPENAI_API_KEY` - OpenAI API key
- `MIXEDBREAD_API_KEY` - Mixedbread API for semantic search/storage

Optional (for Google Calendar):
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL (default: `http://localhost:8000/auth/google/callback`)

## API Endpoints

**Chat:**
- `POST /chat` - Non-streaming chat
- `POST /chat/stream` - SSE streaming chat with auto-save
- `GET /chats` - List saved chats
- `GET /chats/{id}` - Get chat by ID
- `DELETE /chats/{id}` - Delete chat

**Todos:**
- `GET /todos` - List todos
- `POST /todos` - Create todo
- `PATCH /todos/by-id/{id}` - Update todo
- `DELETE /todos/by-id/{id}` - Delete todo

**Notes:**
- `GET /notes` - List notes
- `POST /notes` - Create note
- `PUT /notes/{id}` - Update note
- `DELETE /notes/{id}` - Delete note

**Files:**
- `GET /files?path=...` - List files in directory
- `POST /files/upload` - Upload file
- `POST /files/folder` - Create folder
- `GET /files/download/{path}` - Download file
- `DELETE /files/{path}` - Delete file/folder

**Other:**
- `GET /search?q=...` - Semantic search across all files
- `POST /auth/validate` - Validate API key
- `GET /auth/google` - Start Google OAuth flow
- `GET /auth/google/status` - Check Google Calendar connection
