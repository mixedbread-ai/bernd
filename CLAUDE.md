# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bernd is a personal AI chief of staff that manages todos, memories, calendar, and more. It uses OpenAI's GPT models with function calling to provide an intelligent assistant with persistent semantic memory via Mixedbread.

## Development Commands

```bash
# Install dependencies
uv sync                      # Python dependencies
cd ui && npm install         # Frontend dependencies

# Run CLI agent
uv run agent.py

# Run Web UI (requires two terminals)
uv run uvicorn backend.main:app --reload  # API server on port 8000
cd ui && npm run dev                      # Next.js frontend on port 3000

# Lint frontend
cd ui && npm run lint
```

## Architecture

### Backend (Python)

**Entry Points:**
- `agent.py` - CLI entry point with REPL interface
- `backend/main.py` - FastAPI server with REST endpoints and SSE streaming

**Core Agent Logic (`agent/`):**
- `core.py` - Agent runner with `run_agent()` and `run_agent_stream()` that manage the OpenAI tool-calling loop
- `handlers.py` - Tool handler implementations with dependency injection pattern
- `tools.py` - OpenAI function schemas (TOOLS list)
- `prompts.py` - System prompt builder that injects user profile from semantic filesystem
- `skills.py` - Skill loader that parses skill.md files with YAML frontmatter and creates the meta-tool

**Tools (`tools/`):**
- `semantic_fs.py` - SemanticFS class wrapping Mixedbread API for CRUD + semantic search
- `google_calendar.py` - Google Calendar API integration
- `websearch.py` - Web search via Mixedbread

**Key Design Patterns:**
- SemanticFS uses path-like identifiers (e.g., `/todos/task.md`) converted to Mixedbread file IDs
- Handlers are created via factory function with injected dependencies (fs, gcal, api_key)
- Skills are modular markdown files that inject specialized prompts when activated

### Frontend (`ui/`)

Next.js 16 app with React 19 and Tailwind CSS 4.

**Structure:**
- `app/page.tsx` - Todo list homepage
- `app/chat/` - Chat interface
- `app/search/` - Semantic search page
- `app/components/` - Shared React components
- `app/context/` - React context providers
- `app/hooks/` - Custom React hooks

### Data Storage

All data is stored in Mixedbread semantic filesystem under these paths:
- `/todos/` - Todo items as markdown files
- `/memories/` - User profile and knowledge
  - `/memories/user.md` - Core user profile
  - `/memories/entities/` - Organizations
  - `/memories/projects/` - Projects
  - `/memories/people/` - Key contacts
- `/chats/` - Conversation history
- `/chat_assets/` - Image attachments

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

Optional:
- `GOOGLE_CALENDAR_EMAIL` - Email for Google Calendar impersonation (requires service account JSON in `secrets/`)

## API Endpoints

- `POST /chat` - Non-streaming chat
- `POST /chat/stream` - SSE streaming chat with auto-save
- `GET /todos` - List todos
- `GET /search?q=...` - Semantic search across all files
- `GET /chats` - List saved chats
- `GET /chats/{id}` - Get chat by ID
- `DELETE /chats/{id}` - Delete chat
