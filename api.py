from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from tools.semantic_fs import SemanticFS
import json
import os

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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    chat_id: str | None = None


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
    content = json.dumps(messages)
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
    print(f"Loading chat {chat_id}: {result}")
    if "error" in result:
        return {"error": "not found"}
    try:
        messages = json.loads(result.get("content", "[]"))
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
    return {"status": "deleted", "id": chat_id}


@app.post("/chat")
def chat(request: ChatRequest):
    """Send a message to the agent and get a response."""
    # Convert to the format expected by run_agent
    conversation = [{"role": m.role, "content": m.content} for m in request.messages]

    # Run the agent with tool call tracking
    result = run_agent(conversation, return_tool_calls=True)

    return {"response": result["response"], "tool_calls": result["tool_calls"]}


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    """Stream agent response with tool calls via SSE."""
    # Keep a clean copy for saving (run_agent_stream mutates input_list)
    messages_to_save = [{"role": m.role, "content": m.content} for m in request.messages]
    agent_input = [{"role": m.role, "content": m.content} for m in request.messages]

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
