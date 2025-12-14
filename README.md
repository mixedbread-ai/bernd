# Bernd

Personal AI chief of staff. Manages todos, memories, calendar, and more.

## Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- OpenAI API key
- Mixedbread API key (for semantic search)
- Google Cloud service account (for calendar integration)

## Setup

### 1. Clone and install dependencies

```bash
# Install Python dependencies
uv sync

# Install UI dependencies
cd ui && npm install && cd ..
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT |
| `MIXEDBREAD_API_KEY` | Mixedbread API key for semantic search/embeddings |
| `GOOGLE_CALENDAR_EMAIL` | Email to impersonate for Google Calendar (optional) |

### 3. Google Calendar Setup (Optional)

To enable calendar integration:

1. Create a Google Cloud project
2. Enable the Google Calendar API
3. Create a service account with domain-wide delegation
4. Download the service account JSON key
5. Place it in `secret/` directory (the path is configured in `tools/google_calendar.py`)
6. Set `GOOGLE_CALENDAR_EMAIL` in `.env` to the email you want to impersonate

## Running

### Option 1: CLI

```bash
uv run agent.py
```

Commands:
- Type your message and press Enter
- `/chats` - List saved chats
- `/load <id>` - Load a chat
- `/save` - Save current chat
- `/new` - Start new chat
- `/quit` - Exit

### Option 2: Web UI

Start both the API server and the frontend:

```bash
# Terminal 1: Start API server
uvicorn api:app --reload

# Terminal 2: Start UI
cd ui && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Features:
- Chat interface at `/chat`
- Todo list at `/`
- Semantic search at `/search`
- Quick chat: `Cmd+K` (or `Ctrl+K`)
- Dark mode toggle in sidebar

## Project Structure

```
bernd/
├── agent/              # Agent core logic
│   ├── core.py         # Agent runner (streaming & non-streaming)
│   ├── handlers.py     # Tool handlers
│   ├── tools.py        # Tool schemas for OpenAI
│   └── prompts.py      # System prompts
├── tools/              # Tool implementations
│   ├── semantic_fs.py  # Mixedbread semantic filesystem
│   ├── google_calendar.py
│   └── websearch.py
├── ui/                 # Next.js frontend
│   └── app/
│       ├── chat/       # Chat page
│       ├── search/     # Search page
│       └── components/ # Shared components
├── api.py              # FastAPI backend
├── agent.py            # CLI entry point
└── constants.py        # Shared constants
```

## Tools Available to the Agent

| Tool | Description |
|------|-------------|
| `add_todo` | Create a new todo (auto-creates calendar event if due date set) |
| `get_todos` | List all todos |
| `search_todos` | Semantic search across todos |
| `update_todo` | Update todo status, title, etc. |
| `remove_todo` | Delete a todo |
| `memory` | Store/retrieve/search memories about the user |
| `files` | General semantic filesystem for any data |
| `calendar` | List, create, update, delete calendar events (with attendee invites) |
| `web_search` | Search the web |

## Development

### API Endpoints

- `POST /chat` - Send message, get response
- `POST /chat/stream` - Streaming chat with SSE
- `GET /chats` - List all chats
- `GET /chats/{id}` - Get chat by ID
- `DELETE /chats/{id}` - Delete chat
- `GET /todos` - List todos
- `GET /search?q=...` - Semantic search
