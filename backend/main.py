from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from .tools.semantic_fs import SemanticFS
from .agent import run_agent, run_agent_stream
import json
import os
import uuid
import base64

load_dotenv()

# OpenAI client for title generation
openai_client = OpenAI()

# Google OAuth config (server-side, not per-user)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Cache for SemanticFS instances per API key
_fs_cache: dict[str, SemanticFS] = {}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployed API
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get user's SemanticFS from Authorization header
def get_user_fs(authorization: str = Header(None)) -> SemanticFS:
    """Extract API key from Authorization header and return cached SemanticFS."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    # Support "Bearer <key>" or just "<key>"
    if authorization.startswith("Bearer "):
        api_key = authorization[7:]
    else:
        api_key = authorization

    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")

    # Return cached instance or create new one
    if api_key not in _fs_cache:
        _fs_cache[api_key] = SemanticFS(api_key=api_key, store_name="bernd")
    return _fs_cache[api_key]


def save_image_to_store(
    fs: SemanticFS, chat_id: str, image_data: str, mime_type: str
) -> str:
    """Save base64 image to mixedbread store and return the path."""
    # Determine file extension from mime type
    ext_map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
    }
    ext = ext_map.get(mime_type, "png")

    # Generate unique filename
    filename = f"{uuid.uuid4()}.{ext}"
    path = f"/chat_assets/{chat_id}/{filename}"

    # Extract base64 data (remove data URL prefix if present)
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    # Decode and save to store
    image_bytes = base64.b64decode(image_data)
    fs.write_binary(path, image_bytes, mime_type)

    return path


def load_image_from_store(fs: SemanticFS, image_path: str) -> str | None:
    """Load image from mixedbread store and return as base64 data URL."""
    result = fs.read_binary(image_path)
    if "error" in result:
        return None

    # Determine mime type from extension
    ext = image_path.split(".")[-1].lower()
    mime_map = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    mime_type = mime_map.get(ext, "image/png")

    # Encode to base64
    b64_data = base64.b64encode(result["data"]).decode("utf-8")
    return f"data:{mime_type};base64,{b64_data}"


def process_images_for_save(
    fs: SemanticFS, chat_id: str, messages: list[dict]
) -> list[dict]:
    """Replace base64 images with file paths before saving."""
    processed = []
    for msg in messages:
        new_msg = {"role": msg["role"], "content": msg["content"]}
        if msg.get("images"):
            new_images = []
            for img in msg["images"]:
                # Save image to store and keep path instead of base64
                image_path = save_image_to_store(
                    fs, chat_id, img["data"], img["mimeType"]
                )
                new_images.append(
                    {
                        "type": "image",
                        "path": image_path,
                        "mimeType": img["mimeType"],
                    }
                )
            new_msg["images"] = new_images
        processed.append(new_msg)
    return processed


def process_images_for_load(fs: SemanticFS, messages: list[dict]) -> list[dict]:
    """Replace file paths with base64 images after loading."""
    processed = []
    for msg in messages:
        new_msg = {"role": msg["role"], "content": msg["content"]}
        if msg.get("images"):
            new_images = []
            for img in msg["images"]:
                if "path" in img:
                    # Load image from store
                    data = load_image_from_store(fs, img["path"])
                    if data:
                        new_images.append(
                            {
                                "type": "image",
                                "data": data,
                                "mimeType": img["mimeType"],
                            }
                        )
                elif "data" in img:
                    # Already has data (shouldn't happen but handle it)
                    new_images.append(img)
            if new_images:
                new_msg["images"] = new_images
        processed.append(new_msg)
    return processed


def _path_to_id(path: str) -> str:
    """Convert path to URL-safe ID."""
    path = path.strip()
    if path.startswith("/"):
        path = path[1:]
    return path.replace("/", "__")


def _id_to_path(file_id: str) -> str:
    """Convert ID back to path."""
    return "/" + file_id.replace("__", "/")


@app.post("/auth/validate")
def validate_api_key(authorization: str = Header(None)):
    """Validate that an API key is valid by attempting to use it."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    # Support "Bearer <key>" or just "<key>"
    if authorization.startswith("Bearer "):
        api_key = authorization[7:]
    else:
        api_key = authorization

    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")

    try:
        # Try to create SemanticFS and list files to validate the key
        fs = SemanticFS(api_key=api_key, store_name="bernd")
        fs.list(prefix="/", limit=1)
        # If we get here, the key is valid - cache it
        _fs_cache[api_key] = fs
        return {"valid": True}
    except Exception as e:
        error_msg = str(e).lower()
        if "unauthorized" in error_msg or "invalid" in error_msg or "401" in error_msg:
            return {"valid": False, "error": "Invalid API key"}
        # Other errors might be network issues, etc.
        return {"valid": False, "error": str(e)}


PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2, None: 3, "": 3}


def sort_todos(todos: list) -> list:
    """Sort todos by priority (high first), then by due date (earliest first)."""
    def sort_key(todo):
        # Priority: high=0, medium=1, low=2, none=3
        priority = PRIORITY_ORDER.get(todo.get("priority"), 3)
        # Due date: parse ISO date, None goes to end
        due = todo.get("due_date") or todo.get("due")
        if due:
            try:
                # Handle both date and datetime formats
                due_sort = due[:19]  # Take just the date/time part
            except:
                due_sort = "9999-99-99"
        else:
            due_sort = "9999-99-99"
        return (priority, due_sort)

    return sorted(todos, key=sort_key)


@app.get("/todos")
def get_todos(n: int = 50, fs: SemanticFS = Depends(get_user_fs)):
    files = fs.list(prefix="/todos", limit=n)
    todos = []
    for f in files:
        path = f["path"]
        todos.append(
            {
                "id": _path_to_id(path),
                "title": path.split("/")[-1].replace(".md", ""),
                **f["metadata"],
            }
        )
    return sort_todos(todos)


@app.get("/todos/search")
def search_todos(q: str, fs: SemanticFS = Depends(get_user_fs)):
    return fs.search(q, prefix="/todos", top_k=20)


@app.get("/todos/by-id/{todo_id:path}")
def get_todo(todo_id: str, fs: SemanticFS = Depends(get_user_fs)):
    """Get todo by ID (which is the path with / replaced by __)."""
    path = _id_to_path(todo_id)
    result = fs.read(path)
    if "error" in result:
        return {"error": "not found"}
    return {
        "id": todo_id,
        "title": path.split("/")[-1].replace(".md", ""),
        "content": result.get("content", ""),
        **result.get("metadata", {}),
    }


@app.get("/search")
def search_all(q: str, top_k: int = 20, fs: SemanticFS = Depends(get_user_fs)):
    """Search across all files in the semantic filesystem."""
    return fs.search(q, prefix="/", top_k=top_k)


# Notes endpoints
class NoteCreate(BaseModel):
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


@app.get("/notes")
def get_notes(n: int = 50, fs: SemanticFS = Depends(get_user_fs)):
    """List all notes."""
    files = fs.list(prefix="/notes", limit=n)
    notes = []
    for f in files:
        path = f["path"]
        notes.append(
            {
                "id": _path_to_id(path),
                "title": f["metadata"].get(
                    "title", path.split("/")[-1].replace(".md", "")
                ),
                "updated_at": f["metadata"].get("updated_at", ""),
            }
        )
    return notes


@app.get("/notes/{note_id:path}")
def get_note(note_id: str, fs: SemanticFS = Depends(get_user_fs)):
    """Get a note by ID."""
    path = _id_to_path(note_id)
    result = fs.read(path)
    if "error" in result:
        return {"error": "not found"}
    return {
        "id": note_id,
        "title": result.get("metadata", {}).get(
            "title", path.split("/")[-1].replace(".md", "")
        ),
        "content": result.get("content", ""),
        "updated_at": result.get("metadata", {}).get("updated_at", ""),
    }


@app.post("/notes")
def create_note(note: NoteCreate, fs: SemanticFS = Depends(get_user_fs)):
    """Create a new note."""
    from datetime import datetime

    note_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = f"/notes/{note_id}.md"
    updated_at = datetime.now().isoformat()
    # Ensure content is not empty (mixedbread requires valid file content)
    content = note.content if note.content else " "
    fs.write(
        path,
        content,
        {
            "type": "note",
            "title": note.title,
            "updated_at": updated_at,
        },
    )
    return {
        "id": _path_to_id(path),
        "title": note.title,
        "content": note.content,
        "updated_at": updated_at,
    }


@app.put("/notes/{note_id:path}")
def update_note(note_id: str, note: NoteUpdate, fs: SemanticFS = Depends(get_user_fs)):
    """Update an existing note."""
    from datetime import datetime

    path = _id_to_path(note_id)
    existing = fs.read(path)
    if "error" in existing:
        return {"error": "not found"}

    current_content = existing.get("content", "")
    current_metadata = existing.get("metadata", {})

    new_content = note.content if note.content is not None else current_content
    new_title = (
        note.title if note.title is not None else current_metadata.get("title", "")
    )
    updated_at = datetime.now().isoformat()

    # Ensure content is not empty (mixedbread requires valid file content)
    fs.write(
        path,
        new_content if new_content else " ",
        {
            "type": "note",
            "title": new_title,
            "updated_at": updated_at,
        },
    )
    return {
        "id": note_id,
        "title": new_title,
        "content": new_content,
        "updated_at": updated_at,
    }


@app.delete("/notes/{note_id:path}")
def delete_note(note_id: str, fs: SemanticFS = Depends(get_user_fs)):
    """Delete a note by ID."""
    path = _id_to_path(note_id)
    result = fs.delete(path)
    if "error" in result:
        return {"error": "not found"}
    return {"status": "deleted", "id": note_id}


# Google Calendar OAuth endpoints
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback"
)
GOOGLE_AUTH_PATH = "/auth/google.json"


def get_google_auth_url(state: str) -> str:
    """Generate Google OAuth authorization URL with state parameter."""
    from urllib.parse import urlencode

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,  # Contains encoded API key
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for tokens."""
    import requests

    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": GOOGLE_REDIRECT_URI,
        },
    )
    return response.json()


def save_google_tokens(fs: SemanticFS, tokens: dict):
    """Save Google OAuth tokens to mixedbread."""
    from datetime import datetime

    token_data = {
        "access_token": tokens.get("access_token"),
        "refresh_token": tokens.get("refresh_token"),
        "expiry": tokens.get("expiry"),
        "connected_at": datetime.now().isoformat(),
    }
    fs.write(
        GOOGLE_AUTH_PATH, json.dumps(token_data), {"type": "auth", "provider": "google"}
    )


def get_google_tokens(fs: SemanticFS) -> dict | None:
    """Get stored Google OAuth tokens."""
    result = fs.read(GOOGLE_AUTH_PATH)
    if "error" in result:
        return None
    try:
        return json.loads(result.get("content", "{}"))
    except json.JSONDecodeError:
        return None


@app.get("/auth/google")
def google_auth_start(
    fs: SemanticFS = Depends(get_user_fs), authorization: str = Header(None)
):
    """Start Google OAuth flow - returns URL to redirect user to."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return {
            "error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        }

    # Encode API key in state parameter (base64)
    api_key = (
        authorization[7:]
        if authorization and authorization.startswith("Bearer ")
        else authorization
    )
    state = base64.b64encode(api_key.encode()).decode()

    return {"auth_url": get_google_auth_url(state)}


@app.get("/auth/google/callback")
def google_auth_callback(code: str = None, state: str = None, error: str = None):
    """Handle Google OAuth callback."""
    from fastapi.responses import HTMLResponse

    if error:
        return HTMLResponse(f"""
            <html><body>
            <h2>Authorization failed</h2>
            <p>{error}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        """)

    if not code or not state:
        return HTMLResponse("""
            <html><body>
            <h2>No authorization code received</h2>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        """)

    # Decode API key from state parameter
    try:
        api_key = base64.b64decode(state).decode()
        fs = SemanticFS(api_key=api_key, store_name="bernd")
    except Exception:
        return HTMLResponse("""
            <html><body>
            <h2>Invalid state parameter</h2>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        """)

    # Exchange code for tokens
    tokens = exchange_code_for_tokens(code)

    if "error" in tokens:
        return HTMLResponse(f"""
            <html><body>
            <h2>Token exchange failed</h2>
            <p>{tokens.get("error_description", tokens.get("error"))}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        """)

    # Calculate expiry
    from datetime import datetime, timedelta

    if tokens.get("expires_in"):
        expiry = (datetime.now() + timedelta(seconds=tokens["expires_in"])).isoformat()
        tokens["expiry"] = expiry

    # Save tokens to user's store
    save_google_tokens(fs, tokens)

    return HTMLResponse("""
        <html><body>
        <h2>Google Calendar connected!</h2>
        <p>You can close this window.</p>
        <script>
            setTimeout(() => {
                window.opener?.postMessage('google-auth-success', '*');
                window.close();
            }, 1500);
        </script>
        </body></html>
    """)


@app.get("/auth/google/status")
def google_auth_status(fs: SemanticFS = Depends(get_user_fs)):
    """Check if Google Calendar is connected."""
    tokens = get_google_tokens(fs)
    if tokens and tokens.get("access_token"):
        return {
            "connected": True,
            "connected_at": tokens.get("connected_at"),
        }
    return {"connected": False}


@app.delete("/auth/google")
def google_auth_disconnect(fs: SemanticFS = Depends(get_user_fs)):
    """Disconnect Google Calendar."""
    result = fs.delete(GOOGLE_AUTH_PATH)
    if "error" in result:
        return {"status": "not_connected"}
    return {"status": "disconnected"}


class ImageAttachment(BaseModel):
    type: str
    data: str  # base64 data URL
    mimeType: str


class ChatMessage(BaseModel):
    role: str
    content: str
    images: list[ImageAttachment] | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    chat_id: str | None = None


def convert_message_for_openai(msg: dict) -> dict:
    """Convert a message with images to OpenAI Responses API format."""
    if not msg.get("images"):
        return {"role": msg["role"], "content": msg["content"]}

    # Build content array with text and images for Responses API
    content = []

    # Add text if present
    if msg["content"]:
        content.append({"type": "input_text", "text": msg["content"]})

    # Add images
    for img in msg["images"]:
        content.append({"type": "input_image", "image_url": img["data"]})

    return {"role": msg["role"], "content": content}


def generate_chat_title(messages: list[dict]) -> str:
    """Generate a title using LLM to summarize the conversation."""
    if not messages:
        return "New chat"

    # Build a summary of the conversation for the LLM
    conversation_text = "\n".join(
        f"{msg['role'].upper()}: {msg['content'][:500]}"
        for msg in messages[:6]  # Limit to first 6 messages
    )

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, no quotes or punctuation at the end.",
                },
                {"role": "user", "content": conversation_text},
            ],
            max_tokens=20,
            temperature=0.7,
        )
        title = response.choices[0].message.content.strip()
        # Clean up any quotes or trailing punctuation
        title = title.strip("\"'").rstrip(".")
        return title[:50]  # Ensure max length
    except Exception as e:
        print(f"[API] Title generation failed: {e}")
        # Fallback to first user message
        for msg in messages:
            if msg["role"] == "user":
                title = msg["content"][:50]
                if len(msg["content"]) > 50:
                    title += "..."
                return title
        return "New chat"


def save_chat(fs: SemanticFS, chat_id: str, messages: list[dict]):
    """Save chat to semantic filesystem."""
    title = generate_chat_title(messages)
    # Process images: save to disk and replace with paths
    processed_messages = process_images_for_save(fs, chat_id, messages)
    content = json.dumps(processed_messages)
    fs.write(
        f"/chats/{chat_id}.json",
        content,
        {
            "type": "chat",
            "title": title,
            "message_count": len(messages),
        },
    )


@app.get("/chats")
def list_chats(n: int = 50, fs: SemanticFS = Depends(get_user_fs)):
    """List all chats."""
    files = fs.list(prefix="/chats", limit=n)
    chats = []
    for f in files:
        chat_id = f["path"].split("/")[-1].replace(".json", "")
        chats.append(
            {
                "id": chat_id,
                "title": f["metadata"].get("title", "Untitled"),
                "message_count": f["metadata"].get("message_count", 0),
            }
        )
    return chats


@app.get("/chats/{chat_id}")
def get_chat(chat_id: str, fs: SemanticFS = Depends(get_user_fs)):
    """Get a specific chat by ID."""
    result = fs.read(f"/chats/{chat_id}.json")
    if "error" in result:
        return {"error": "not found"}
    try:
        messages = json.loads(result.get("content", "[]"))
        # Load images from disk and convert back to base64
        messages = process_images_for_load(fs, messages)
    except json.JSONDecodeError:
        messages = []
    return {
        "id": chat_id,
        "messages": messages,
        "title": result.get("metadata", {}).get("title", "Untitled"),
    }


@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: str, fs: SemanticFS = Depends(get_user_fs)):
    """Delete a chat by ID."""
    result = fs.delete(f"/chats/{chat_id}.json")
    if "error" in result:
        return {"error": "not found"}

    # Clean up associated image files from store
    fs.clear_prefix(f"/chat_assets/{chat_id}")

    return {"status": "deleted", "id": chat_id}


def get_api_key_from_header(authorization: str = Header(None)) -> str:
    """Extract API key from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return authorization


@app.post("/chat")
def chat(request: ChatRequest, api_key: str = Depends(get_api_key_from_header)):
    """Send a message to the agent and get a response."""
    # Convert to the format expected by run_agent (with image support)
    conversation = []
    for m in request.messages:
        msg = {"role": m.role, "content": m.content}
        if m.images:
            msg["images"] = [img.model_dump() for img in m.images]
        conversation.append(convert_message_for_openai(msg))

    # Run the agent with tool call tracking (using user's API key)
    result = run_agent(conversation, return_tool_calls=True, api_key=api_key)

    return {"response": result["response"], "tool_calls": result["tool_calls"]}


@app.post("/chat/stream")
def chat_stream(
    request: ChatRequest,
    api_key: str = Depends(get_api_key_from_header),
    fs: SemanticFS = Depends(get_user_fs),
):
    """Stream agent response with tool calls via SSE."""
    # Keep a clean copy for saving (without OpenAI content format)
    messages_to_save = []
    for m in request.messages:
        msg = {"role": m.role, "content": m.content}
        if m.images:
            msg["images"] = [img.model_dump() for img in m.images]
        messages_to_save.append(msg)

    # Convert to OpenAI format for the agent
    agent_input = [convert_message_for_openai(msg) for msg in messages_to_save]

    # Generate chat_id if not provided
    chat_id = request.chat_id
    if not chat_id:
        from datetime import datetime

        chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    def event_stream():
        final_content = ""
        for event in run_agent_stream(agent_input, api_key=api_key):
            if event["type"] == "response_end":
                final_content = event["content"]
            yield f"data: {json.dumps(event)}\n\n"

        # Save the chat with the assistant's response (using user's fs)
        full_conversation = messages_to_save + [
            {"role": "assistant", "content": final_content}
        ]
        save_chat(fs, chat_id, full_conversation)

        # Send chat_id to frontend
        yield f"data: {json.dumps({'type': 'chat_saved', 'chat_id': chat_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# File management endpoints
ALLOWED_FILE_TYPES = {
    "application/pdf": ".pdf",
    "text/markdown": ".md",
    "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


@app.get("/files")
def list_files(path: str = "/files", fs: SemanticFS = Depends(get_user_fs)):
    """List files and folders in a directory."""
    # Ensure path starts with /files
    if not path.startswith("/files"):
        path = f"/files{path}" if path.startswith("/") else f"/files/{path}"

    files = fs.list(prefix=path, limit=200)

    items = []
    seen_folders = set()

    for f in files:
        file_path = f["path"]

        # Skip if not under the requested path
        if not file_path.startswith(path):
            continue

        # Get the relative path after the prefix
        relative = file_path[len(path):].lstrip("/")

        if "/" in relative:
            # This is inside a subfolder - extract folder name
            folder_name = relative.split("/")[0]
            if folder_name and folder_name not in seen_folders:
                seen_folders.add(folder_name)
                items.append({
                    "name": folder_name,
                    "path": f"{path}/{folder_name}".replace("//", "/"),
                    "type": "folder",
                })
        elif relative:
            # Skip folder marker files
            if relative == "folder_meta.json":
                continue
            # This is a file directly in this folder
            items.append({
                "name": relative,
                "path": file_path,
                "type": "file",
                "size": f["metadata"].get("size"),
                "mime_type": f["metadata"].get("mime_type"),
                "created_at": f["metadata"].get("created_at"),
            })

    # Sort: folders first, then files alphabetically
    items.sort(key=lambda x: (0 if x["type"] == "folder" else 1, x["name"].lower()))

    return {"path": path, "items": items}


@app.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form("/files"),
    fs: SemanticFS = Depends(get_user_fs),
):
    """Upload a file."""
    from datetime import datetime
    import base64

    # Validate file type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_FILE_TYPES and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed: {content_type}. Allowed: PDF, Markdown, DOCX, images",
        )

    # Read file content
    content = await file.read()

    # Ensure path starts with /files
    if not path.startswith("/files"):
        path = f"/files{path}" if path.startswith("/") else f"/files/{path}"

    # Build full file path
    filename = file.filename or "unnamed"
    file_path = f"{path}/{filename}".replace("//", "/")

    # For binary files (images, PDFs, etc.), store as base64
    is_text = content_type in ["text/markdown", "text/plain"]

    if is_text:
        file_content = content.decode("utf-8")
    else:
        file_content = base64.b64encode(content).decode("utf-8")

    # Write to SemanticFS
    fs.write(
        file_path,
        file_content,
        {
            "type": "file",
            "mime_type": content_type,
            "size": len(content),
            "is_base64": not is_text,
            "original_name": filename,
            "created_at": datetime.now().isoformat(),
        },
    )

    return {
        "status": "uploaded",
        "path": file_path,
        "name": filename,
        "size": len(content),
    }


class FolderCreate(BaseModel):
    name: str
    parent_path: str = "/files"


@app.post("/files/folder")
def create_folder(folder: FolderCreate, fs: SemanticFS = Depends(get_user_fs)):
    """Create a folder (by creating a folder_meta.json marker file)."""
    from datetime import datetime

    parent = folder.parent_path
    if not parent.startswith("/files"):
        parent = f"/files{parent}" if parent.startswith("/") else f"/files/{parent}"

    folder_path = f"{parent}/{folder.name}/folder_meta.json".replace("//", "/")
    created_at = datetime.now().isoformat()

    fs.write(
        folder_path,
        json.dumps({"type": "folder", "name": folder.name, "created_at": created_at}),
        {
            "type": "folder_marker",
            "created_at": created_at,
        },
    )

    return {"status": "created", "path": f"{parent}/{folder.name}".replace("//", "/")}


@app.get("/files/download/{file_path:path}")
def download_file(file_path: str, fs: SemanticFS = Depends(get_user_fs)):
    """Get file content for download."""
    import base64

    path = f"/{file_path}" if not file_path.startswith("/") else file_path
    if not path.startswith("/files"):
        path = f"/files{path}"

    result = fs.read(path)
    if "error" in result:
        raise HTTPException(status_code=404, detail="File not found")

    metadata = result.get("metadata", {})
    content = result.get("content", "")

    # If base64 encoded, decode it
    if metadata.get("is_base64"):
        content = base64.b64decode(content)
        return StreamingResponse(
            iter([content]),
            media_type=metadata.get("mime_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f'attachment; filename="{metadata.get("original_name", "file")}"'
            },
        )

    return {
        "content": content,
        "mime_type": metadata.get("mime_type", "text/plain"),
        "name": metadata.get("original_name", path.split("/")[-1]),
    }


@app.delete("/files/{file_path:path}")
def delete_file(file_path: str, fs: SemanticFS = Depends(get_user_fs)):
    """Delete a file or folder."""
    path = f"/{file_path}" if not file_path.startswith("/") else file_path
    if not path.startswith("/files"):
        path = f"/files{path}"

    # Check if it's a folder (delete all contents)
    files = fs.list(prefix=path, limit=100)
    if len(files) > 1 or (len(files) == 1 and files[0]["path"] != path):
        # It's a folder with contents - delete all
        for f in files:
            fs.delete(f["path"])
        return {"status": "deleted", "path": path, "type": "folder"}

    # Single file
    result = fs.delete(path)
    if "error" in result:
        raise HTTPException(status_code=404, detail="File not found")

    return {"status": "deleted", "path": path, "type": "file"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
