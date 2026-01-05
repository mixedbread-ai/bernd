<div align="center">
  <a href="https://github.com/mixedbread-ai/bernd">
    <img src="public/logo_mb.svg" alt="Bernd" width="96" height="96" />
  </a>
  <h1>Bernd</h1>
  <p><em>An AI chief of staff with persistent, searchable memory. Built with OpenAI + Mixedbread.</em></p>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://bernd.mixedbread.com"><img src="https://img.shields.io/badge/Demo-Try%20it%20now-brightgreen" alt="Demo: Try it now" /></a>
  <a href="https://join.slack.com/t/mixedbreadcommunity/shared_invite/zt-3kagj5m36-wwM_hryIFby7B2wlcOaHaQ"><img src="https://img.shields.io/badge/Slack-Join%20Community-4A154B?logo=slack" alt="Slack Community" /></a>
</div>

<br>

## What Is Bernd

Bernd is an AI assistant that remembers everything you tell it — and lets you see exactly what it knows.

Most AI assistants are stateless. They forget everything between sessions. Bernd uses Mixedbread as a semantic filesystem to give your AI persistent, searchable memory. Ask "what was that project with Sarah?" and it finds the right context by meaning, not keywords.

This repo is both a working product and a reference implementation. The core memory system is ~200 lines of Python — see [`semantic_fs.py`](backend/tools/semantic_fs.py).

### Transparent Memory

Unlike AI agents with opaque memory systems, everything Bernd knows is stored in your Mixedbread store. Browse it, search it, edit it, or delete it anytime through the [Mixedbread dashboard](https://mixedbread.com). Full visibility and control.

## What is Mixedbread

[Mixedbread](https://mixedbread.com) is infrastructure for building AI applications with semantic understanding. Upload any file — text, images, PDFs, audio, video — and Mixedbread automatically indexes it for semantic search. Query by meaning, not keywords.

In Bernd, we use Mixedbread as the storage and retrieval layer: every todo, note, and memory is a file in a Mixedbread store, instantly searchable by the AI agent.

## How It Works

We treat a Mixedbread store like a filesystem — file paths become `external_id`s, and every file is automatically embedded and searchable by meaning.

```
/todos/                     # Todo items
/memories/user.md           # User profile (auto-loaded into system prompt)
/memories/people/           # Contacts and relationships
/notes/                     # User notes
/chats/                     # Conversation history
```

See [`semantic_fs.py`](backend/tools/semantic_fs.py) for the implementation (~200 lines).

## Key Files

| File | Purpose |
|------|---------|
| [`backend/tools/semantic_fs.py`](backend/tools/semantic_fs.py) | SemanticFS class — path-based CRUD + semantic search over Mixedbread |
| [`backend/agent/tools.py`](backend/agent/tools.py) | OpenAI function schemas |
| [`backend/agent/handlers.py`](backend/agent/handlers.py) | Tool implementations using SemanticFS |
| [`backend/agent/core.py`](backend/agent/core.py) | Agent loop managing OpenAI's tool-calling flow |
| [`backend/agent/prompts.py`](backend/agent/prompts.py) | System prompt that loads user profile from `/memories/user.md` |

## Quick Start

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv)
- [Bun](https://bun.sh) (for frontend)
- [OpenAI API key](https://platform.openai.com)
- [Mixedbread account](https://mixedbread.com) (free)
- Google Cloud OAuth credentials (optional, for calendar)

### Installation

```bash
git clone https://github.com/mixedbread-ai/bernd.git
cd bernd

# Python dependencies
uv sync

# Frontend dependencies
cd ui && bun install && cd ..
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```
OPENAI_API_KEY=your-openai-key

# Optional: Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

### Running

**CLI:**

```bash
uv run agent.py
```

**Web UI:**

```bash
# Terminal 1: API server
uv run uvicorn backend.main:app --reload

# Terminal 2: Frontend
cd ui && bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your Mixedbread account.

## Tools

| Tool | Description |
|------|-------------|
| `add_todo` | Create a todo (syncs to calendar if due date set) |
| `get_todos` | List all todos |
| `search_todos` | Semantic search across todos |
| `update_todo` | Update status, title, etc. |
| `remove_todo` | Delete a todo |
| `memory` | Store, retrieve, and search memories |
| `files` | General semantic filesystem access |
| `calendar` | Google Calendar integration |
| `web_search` | Search the web via Mixedbread |
| `fetch` | Extract content from URLs |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /chat` | Send message, get response |
| `POST /chat/stream` | Streaming chat with SSE |
| `GET /todos` | List todos |
| `GET /search?q=...` | Semantic search across all files |
| `GET /chats` | List saved conversations |

## Built With

- [OpenAI](https://openai.com) — GPT with Responses API
- [Mixedbread](https://mixedbread.com) — Semantic storage and search
- [FastAPI](https://fastapi.tiangolo.com) — Python backend
- [Next.js](https://nextjs.org) — React frontend

## License

MIT
