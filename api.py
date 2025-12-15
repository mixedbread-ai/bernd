from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from tools.semantic_fs import SemanticFS
import json
import os
import uuid
import base64

load_dotenv()

# Import agent components
from agent import run_agent, run_agent_stream

# OpenAI client for title generation
openai_client = OpenAI()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fs = SemanticFS(api_key=os.getenv("MIXEDBREAD_API_KEY"), store_name="bernd")


def save_image_to_store(chat_id: str, image_data: str, mime_type: str) -> str:
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


def load_image_from_store(image_path: str) -> str | None:
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


def process_images_for_save(chat_id: str, messages: list[dict]) -> list[dict]:
    """Replace base64 images with file paths before saving."""
    processed = []
    for msg in messages:
        new_msg = {"role": msg["role"], "content": msg["content"]}
        if msg.get("images"):
            new_images = []
            for img in msg["images"]:
                # Save image to store and keep path instead of base64
                image_path = save_image_to_store(chat_id, img["data"], img["mimeType"])
                new_images.append({
                    "type": "image",
                    "path": image_path,
                    "mimeType": img["mimeType"],
                })
            new_msg["images"] = new_images
        processed.append(new_msg)
    return processed


def process_images_for_load(messages: list[dict]) -> list[dict]:
    """Replace file paths with base64 images after loading."""
    processed = []
    for msg in messages:
        new_msg = {"role": msg["role"], "content": msg["content"]}
        if msg.get("images"):
            new_images = []
            for img in msg["images"]:
                if "path" in img:
                    # Load image from store
                    data = load_image_from_store(img["path"])
                    if data:
                        new_images.append({
                            "type": "image",
                            "data": data,
                            "mimeType": img["mimeType"],
                        })
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


@app.get("/todos")
def get_todos(n: int = 50):
    files = fs.list(prefix="/todos", limit=n)
    todos = []
    for f in files:
        path = f["path"]
        todos.append({
            "id": _path_to_id(path),
            "title": path.split("/")[-1].replace(".md", ""),
            **f["metadata"],
        })
    return todos


@app.get("/todos/search")
def search_todos(q: str):
    return fs.search(q, prefix="/todos", top_k=20)


@app.get("/todos/by-id/{todo_id:path}")
def get_todo(todo_id: str):
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
def search_all(q: str, top_k: int = 20):
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
def get_notes(n: int = 50):
    """List all notes."""
    files = fs.list(prefix="/notes", limit=n)
    notes = []
    for f in files:
        path = f["path"]
        notes.append({
            "id": _path_to_id(path),
            "title": f["metadata"].get("title", path.split("/")[-1].replace(".md", "")),
            "updated_at": f["metadata"].get("updated_at", ""),
        })
    return notes


@app.get("/notes/{note_id:path}")
def get_note(note_id: str):
    """Get a note by ID."""
    path = _id_to_path(note_id)
    result = fs.read(path)
    if "error" in result:
        return {"error": "not found"}
    return {
        "id": note_id,
        "title": result.get("metadata", {}).get("title", path.split("/")[-1].replace(".md", "")),
        "content": result.get("content", ""),
        "updated_at": result.get("metadata", {}).get("updated_at", ""),
    }


@app.post("/notes")
def create_note(note: NoteCreate):
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
def update_note(note_id: str, note: NoteUpdate):
    """Update an existing note."""
    from datetime import datetime
    path = _id_to_path(note_id)
    existing = fs.read(path)
    if "error" in existing:
        return {"error": "not found"}

    current_content = existing.get("content", "")
    current_metadata = existing.get("metadata", {})

    new_content = note.content if note.content is not None else current_content
    new_title = note.title if note.title is not None else current_metadata.get("title", "")
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
def delete_note(note_id: str):
    """Delete a note by ID."""
    path = _id_to_path(note_id)
    result = fs.delete(path)
    if "error" in result:
        return {"error": "not found"}
    return {"status": "deleted", "id": note_id}


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
        content.append({
            "type": "input_image",
            "image_url": img["data"]
        })

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
                    "content": "Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, no quotes or punctuation at the end."
                },
                {
                    "role": "user",
                    "content": conversation_text
                }
            ],
            max_tokens=20,
            temperature=0.7,
        )
        title = response.choices[0].message.content.strip()
        # Clean up any quotes or trailing punctuation
        title = title.strip('"\'').rstrip('.')
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


def save_chat(chat_id: str, messages: list[dict]):
    """Save chat to semantic filesystem."""
    title = generate_chat_title(messages)
    # Process images: save to disk and replace with paths
    processed_messages = process_images_for_save(chat_id, messages)
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
def list_chats(n: int = 50):
    """List all chats."""
    files = fs.list(prefix="/chats", limit=n)
    chats = []
    for f in files:
        chat_id = f["path"].split("/")[-1].replace(".json", "")
        chats.append({
            "id": chat_id,
            "title": f["metadata"].get("title", "Untitled"),
            "message_count": f["metadata"].get("message_count", 0),
        })
    return chats


@app.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    """Get a specific chat by ID."""
    result = fs.read(f"/chats/{chat_id}.json")
    if "error" in result:
        return {"error": "not found"}
    try:
        messages = json.loads(result.get("content", "[]"))
        # Load images from disk and convert back to base64
        messages = process_images_for_load(messages)
    except json.JSONDecodeError:
        messages = []
    return {
        "id": chat_id,
        "messages": messages,
        "title": result.get("metadata", {}).get("title", "Untitled"),
    }


@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: str):
    """Delete a chat by ID."""
    result = fs.delete(f"/chats/{chat_id}.json")
    if "error" in result:
        return {"error": "not found"}

    # Clean up associated image files from store
    fs.clear_prefix(f"/chat_assets/{chat_id}")

    return {"status": "deleted", "id": chat_id}


@app.post("/chat")
def chat(request: ChatRequest):
    """Send a message to the agent and get a response."""
    # Convert to the format expected by run_agent (with image support)
    conversation = []
    for m in request.messages:
        msg = {"role": m.role, "content": m.content}
        if m.images:
            msg["images"] = [img.model_dump() for img in m.images]
        conversation.append(convert_message_for_openai(msg))

    # Run the agent with tool call tracking
    result = run_agent(conversation, return_tool_calls=True)

    return {"response": result["response"], "tool_calls": result["tool_calls"]}


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
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
        for event in run_agent_stream(agent_input):
            if event["type"] == "response_end":
                final_content = event["content"]
            yield f"data: {json.dumps(event)}\n\n"

        # Save the chat with the assistant's response
        full_conversation = messages_to_save + [{"role": "assistant", "content": final_content}]
        save_chat(chat_id, full_conversation)

        # Send chat_id to frontend
        yield f"data: {json.dumps({'type': 'chat_saved', 'chat_id': chat_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
