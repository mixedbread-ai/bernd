# Bernd - AI Chief of Staff with Semantic Memory

Your AI assistant that actually remembers. Built with OpenAI + [Mixedbread](https://mixedbread.com).

## Why This Exists

Most AI assistants are stateless - they forget everything between sessions. Bernd uses Mixedbread as a **semantic filesystem** to give your AI persistent, searchable memory.

Your todos, notes, memories, and files are stored semantically - meaning the AI can find relevant context using natural language, not just exact keyword matches. Ask "what was that project with Sarah?" and it finds the right context.

**Transparent memory** Unlike most AI agents with opaque, hidden memory systems, everything Bernd knows is stored in one place - your Mixedbread store. You can browse it, search it, edit it, or delete it anytime through the [Mixedbread platform](https://mixedbread.com). Full visibility and control over what your AI remembers.

## The Semantic Filesystem

The core idea: treat a [Mixedbread store](https://mixedbread.com) like a filesystem where every file is automatically embedded and searchable by meaning.

### How It Works

Mixedbread stores let you upload files with an `external_id` and `metadata`. We use this to build a filesystem abstraction:

1. **Path as external_id** - The file path (e.g., `/todos/buy-groceries.md`) becomes the `external_id`, enabling direct CRUD operations by path
2. **Path in metadata** - We also store the path in metadata, enabling prefix filtering on search (e.g., search only within `/memories/`)
3. **Automatic indexing** - Once uploaded, files are automatically embedded and indexed by Mixedbread
4. **Flexible search scope** - Agents can search a subfolder (`prefix="/todos/"`) or the entire store (`prefix="/"`)

```python
# From backend/tools/semantic_fs.py

def write(self, path: str, content: str, metadata: dict = None):
    file_id = path.replace("/", "__")  # /todos/task.md -> todos__task.md

    meta = metadata or {}
    meta["path"] = path  # Store path for search filtering

    self.mixedbread.stores.files.upload(
        store_identifier=self.store_name,
        file=(filename, content, mime_type),
        metadata=meta,
        external_id=file_id,  # Path as external_id for direct access
    )

def search(self, query: str, prefix: str = "/", top_k: int = 10):
    # Filter by path prefix using metadata
    metadata_filter = {"key": "path", "operator": "starts_with", "value": prefix}

    return self.mixedbread.stores.search(
        store_identifiers=[self.store_name],
        query=query,
        filters=metadata_filter,
    )
```

### Store Structure

```
/todos/                     # Todo items with metadata (status, priority, due_date)
/memories/                  # Persistent user knowledge
    user.md                 # Core profile (auto-loaded into system prompt)
    people/                 # Contacts and relationships
    projects/               # Ongoing projects
/notes/                     # User notes
/files/                     # General file storage
/chats/                     # Conversation history
```

### Operations

| Method | What it does |
|--------|--------------|
| `write(path, content, metadata)` | Upload with path as external_id, auto-indexed |
| `read(path)` | Retrieve by external_id (path) |
| `list(prefix)` | List files matching path prefix |
| `search(query, prefix)` | Semantic search with metadata filter on path |
| `delete(path)` | Remove by external_id |

The magic is in `search()` - it uses Mixedbread's semantic search to find files by meaning, scoped to any folder. Search for "Q4 planning" in `/notes/` and find notes that mention "fourth quarter strategy" even without exact keyword matches.

## Architecture

```
User Message
    │
    ▼
Agent Loop (backend/agent/core.py)
    │
    ▼
OpenAI Responses API (function calling)
    │
    ▼
Tool Handlers (backend/agent/handlers.py)
    │
    ▼
SemanticFS (backend/tools/semantic_fs.py)
    │
    ▼
Mixedbread API (storage + semantic search)
```

The agent loop receives a user message, calls OpenAI with available tools, executes any tool calls through handlers that use SemanticFS, and returns the response. SemanticFS abstracts Mixedbread's API into simple filesystem-like operations.

## Key Files for Developers

If you want to understand how this works, study these files:

| File | Purpose |
|------|---------|
| `backend/tools/semantic_fs.py` | The SemanticFS class - abstracts Mixedbread into path-based CRUD + semantic search |
| `backend/agent/tools.py` | Tool schemas that tell OpenAI what functions are available |
| `backend/agent/handlers.py` | Implements each tool using SemanticFS |
| `backend/agent/core.py` | The agent loop managing OpenAI's tool-calling flow |
| `backend/agent/prompts.py` | System prompt that loads user profile from `/memories/user.md` |

## Quick Start

### Prerequisites

- Python 3.12+
- [Bun](https://bun.sh) (for frontend)
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- OpenAI API key
- Google Cloud OAuth credentials (optional, for calendar)

### Installation

```bash
# Install Python dependencies
uv sync

# Install UI dependencies
cd ui && bun install && cd ..
```

### Configuration

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```
OPENAI_API_KEY=your-openai-key

# Optional: Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

### Running

**Option 1: CLI**

```bash
uv run agent.py
```

**Option 2: Web UI**

```bash
# Terminal 1: API server
uv run uvicorn backend.main:app --reload

# Terminal 2: Frontend
cd ui && bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tools

| Tool | Description |
|------|-------------|
| `add_todo` | Create a todo (auto-syncs to calendar if due date set) |
| `get_todos` | List all todos |
| `search_todos` | Semantic search across todos |
| `update_todo` | Update status, title, etc. |
| `remove_todo` | Delete a todo |
| `memory` | Store/retrieve/search memories about the user |
| `files` | General semantic filesystem access |
| `calendar` | Google Calendar integration |
| `web_search` | Search the web via Mixedbread public store "mixedbread/web" |
| `fetch` | Extract content from URLs |

## Why Mixedbread

Mixedbread makes this architecture possible:

- **Multi-modal file support** - Text, images, PDFs, videos, audio - [all automatically indexed](https://www.mixedbread.com/docs/stores/ingest/file-types). Agents can dump any file type just like a real filesystem should work.

- **Semantic search with filtering** - [Full semantic search](https://www.mixedbread.com/docs/stores/search) over text, images, video, and audio using natural language. Filter by metadata (path prefix, status, tags) to scope searches to exactly what you need.

- **Global transparency** - One store for everything about you, controlled by you. Browse, search, and edit your AI's memory anytime through the Mixedbread platform. No black-box memory systems.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /chat` | Send message, get response |
| `POST /chat/stream` | Streaming chat with SSE |
| `GET /todos` | List todos |
| `GET /search?q=...` | Semantic search across all files |
| `GET /chats` | List saved conversations |

## Built With

- [OpenAI](https://openai.com) - GPT with Responses API for function calling
- [Mixedbread](https://mixedbread.com) - Semantic storage and search
- [FastAPI](https://fastapi.tiangolo.com) - Python backend
- [Next.js](https://nextjs.org) - React frontend
