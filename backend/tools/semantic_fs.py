from __future__ import annotations
from typing import Optional, Any, Callable
from mixedbread import Mixedbread
from datetime import datetime
import json


class SemanticFS:
    """
    A semantic filesystem backed by mixedbread.

    Paths like:
      /todos/buy-groceries.md
      /memories/user.md
      /tools/add_todo.md

    Supports CRUD operations and semantic search across all or filtered paths.
    """

    def __init__(self, api_key: str, store_name: str = "bernd"):
        self.mixedbread = Mixedbread(api_key=api_key)
        self.store_name = store_name
        self._setup_store()

        # For toolbox functionality
        self._tool_handlers: dict[str, Callable] = {}
        self._tool_schemas: dict[str, dict] = {}

    def _setup_store(self):
        """Create store if it doesn't exist."""
        store = self.mixedbread.stores.list(q=self.store_name)
        if not store.data:
            self.mixedbread.stores.create(
                name=self.store_name,
                description="Semantic filesystem for Bernd",
                config={
                    "contextualization": {
                        "with_metadata": [
                            "type",
                            "created_at",
                            "updated_at",
                            "priority",
                            "status",
                            "due_date",
                            "tags",
                        ]
                    }
                },
            )

    def _path_to_id(self, path: str) -> str:
        """Convert path to file identifier."""
        path = path.strip()
        if path.startswith("/"):
            path = path[1:]
        return path.replace("/", "__")

    def _id_to_path(self, file_id: str) -> str:
        """Convert file identifier back to path."""
        return "/" + file_id.replace("__", "/")

    # Core filesystem operations

    def write(self, path: str, content: str, metadata: Optional[dict] = None) -> dict:
        """Write content to a path."""
        file_id = self._path_to_id(path)
        now = datetime.now().isoformat()

        # Preserve created_at if file exists
        created_at = now
        try:
            existing = self.mixedbread.stores.files.get(
                file_identifier=file_id,
                store_identifier=self.store_name,
            )
            created_at = existing.metadata.get("created_at", now)
            self.mixedbread.stores.files.delete(
                file_identifier=file_id,
                store_identifier=self.store_name,
            )
        except Exception:
            pass

        meta = metadata or {}
        meta["path"] = path  # Store path for search retrieval
        meta["created_at"] = created_at
        meta["updated_at"] = now

        filename = path.split("/")[-1]
        mime_type = "text/plain" if filename.endswith(".json") else "text/markdown"

        self.mixedbread.stores.files.upload(
            store_identifier=self.store_name,
            file=(filename, content, mime_type),
            metadata=meta,
            external_id=file_id,
            overwrite=True,
        )
        return {"status": "ok", "path": path}

    def read(self, path: str) -> dict:
        """Read content from a path."""
        file_id = self._path_to_id(path)

        try:
            # Get file metadata
            resp = self.mixedbread.stores.files.retrieve(
                file_identifier=file_id,
                store_identifier=self.store_name,
            )
            # Download actual content
            content_resp = self.mixedbread.files.content(file_id=resp.id)
            content = content_resp.read().decode("utf-8")

            return {
                "path": path,
                "content": content,
                "metadata": resp.metadata if hasattr(resp, "metadata") else {},
            }
        except Exception as e:
            print(f"[SemanticFS] Error reading {path}: {e}")
            return {"error": f"Not found: {path}"}

    def delete(self, path: str) -> dict:
        """Delete a file at path."""
        file_id = self._path_to_id(path)
        try:
            self.mixedbread.stores.files.delete(
                file_identifier=file_id,
                store_identifier=self.store_name,
            )
            return {"status": "deleted", "path": path}
        except Exception:
            return {"error": f"Not found: {path}"}

    def list(self, prefix: str = "/", limit: int = 100) -> list[dict]:
        """List files under a path prefix."""
        prefix_id = self._path_to_id(prefix) if prefix != "/" else ""
        files = []
        cursor = None

        while len(files) < limit:
            resp = self.mixedbread.stores.files.list(
                store_identifier=self.store_name,
                limit=min(100, limit - len(files)),
                after=cursor,
            )
            for item in resp.data:
                file_id = item.external_id or ""
                if prefix == "/" or file_id.startswith(prefix_id):
                    files.append(
                        {
                            "path": self._id_to_path(file_id),
                            "metadata": item.metadata
                            if hasattr(item, "metadata")
                            else {},
                        }
                    )
            if not resp.pagination.has_more:
                break
            cursor = resp.pagination.last_cursor

        return files

    def search(self, query: str, prefix: str = "/", top_k: int = 10) -> list[dict]:
        """Semantic search, optionally filtered by path prefix."""
        # Build metadata filter for prefix
        metadata_filter = None
        if prefix != "/":
            metadata_filter = {
                "key": "path",
                "operator": "starts_with",
                "value": prefix,
            }

        try:
            resp = self.mixedbread.stores.search(
                store_identifiers=[self.store_name],
                query=query,
                top_k=top_k,
                filters=metadata_filter,
            )
        except Exception as e:
            print(f"[SemanticFS] Search error: {e}")
            return []

        results = []
        for item in resp.data:
            metadata = item.metadata if hasattr(item, "metadata") else {}
            path = metadata.get("path", "/" + (item.filename or ""))

            results.append(
                {
                    "path": path,
                    "content": item.text if hasattr(item, "text") else "",
                    "score": item.score,
                    "metadata": metadata,
                }
            )

        return results

    def clear_prefix(self, prefix: str) -> dict:
        """Delete all files under a prefix."""
        files = self.list(prefix=prefix, limit=1000)
        deleted = 0
        for f in files:
            self.delete(f["path"])
            deleted += 1
        return {"status": "cleared", "prefix": prefix, "deleted": deleted}

    def write_binary(self, path: str, data: bytes, mime_type: str, metadata: Optional[dict] = None) -> dict:
        """Write binary data (like images) to a path."""
        file_id = self._path_to_id(path)
        now = datetime.now().isoformat()

        # Delete existing file if present
        try:
            self.mixedbread.stores.files.delete(
                file_identifier=file_id,
                store_identifier=self.store_name,
            )
        except Exception:
            pass

        meta = metadata or {}
        meta["path"] = path
        meta["created_at"] = now
        meta["type"] = "binary"

        filename = path.split("/")[-1]

        self.mixedbread.stores.files.upload(
            store_identifier=self.store_name,
            file=(filename, data, mime_type),
            metadata=meta,
            external_id=file_id,
            overwrite=True,
        )
        return {"status": "ok", "path": path}

    def read_binary(self, path: str) -> dict:
        """Read binary data from a path."""
        file_id = self._path_to_id(path)

        try:
            resp = self.mixedbread.stores.files.retrieve(
                file_identifier=file_id,
                store_identifier=self.store_name,
            )
            content_resp = self.mixedbread.files.content(file_id=resp.id)
            data = content_resp.read()

            return {
                "path": path,
                "data": data,
                "metadata": resp.metadata if hasattr(resp, "metadata") else {},
            }
        except Exception as e:
            print(f"[SemanticFS] Error reading binary {path}: {e}")
            return {"error": f"Not found: {path}"}

    # Toolbox functionality (tools are stored at /tools/*)

    def register_tool(
        self, name: str, description: str, parameters: dict, handler: Callable
    ):
        """Register a tool, storing its schema in the filesystem."""
        self._tool_handlers[name] = handler
        self._tool_schemas[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
        }

        # Store in filesystem for semantic search
        content = f"Tool: {name}\n\n{description}\n\nParameters:\n{json.dumps(parameters, indent=2)}"
        self.write(f"/tools/{name}.md", content, {"type": "tool"})

    def search_tools(self, query: str, top_k: int = 5) -> list[dict]:
        """Search for tools by intent."""
        results = self.search(query, prefix="/tools", top_k=top_k)
        tools = []
        for r in results:
            name = r["path"].split("/")[-1].replace(".md", "")
            if name in self._tool_schemas:
                tools.append(
                    {
                        "name": name,
                        "description": self._tool_schemas[name]["description"],
                        "score": r["score"],
                    }
                )
        return tools

    def get_tool(self, name: str) -> dict:
        """Get tool schema."""
        if name not in self._tool_schemas:
            return {"error": f"Tool not found: {name}"}
        return self._tool_schemas[name]

    def use_tool(self, name: str, arguments: dict) -> Any:
        """Execute a tool."""
        if name not in self._tool_handlers:
            return {"error": f"Tool not found: {name}"}
        try:
            return self._tool_handlers[name](arguments)
        except Exception as e:
            return {"error": str(e)}

    def get_toolbox_schema(self) -> list[dict]:
        """Get the toolbox tool definition for the model."""
        return [
            {
                "type": "function",
                "name": "toolbox",
                "description": """Access the toolbox to find and use tools.

Actions:
- search: Find tools by describing what you want to do
- get: Get full parameter details for a tool
- use: Execute a tool with arguments

Use 'search' to find the right tool, 'get' to see its parameters, then 'use' to execute.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["search", "get", "use"],
                            "description": "The action to perform",
                        },
                        "query": {
                            "type": "string",
                            "description": "Search query (for 'search' action)",
                        },
                        "tool_name": {
                            "type": "string",
                            "description": "Tool name (for 'get' and 'use' actions)",
                        },
                        "arguments": {
                            "type": "object",
                            "description": "Arguments for the tool (for 'use' action)",
                        },
                    },
                    "required": ["action"],
                },
            },
        ]
