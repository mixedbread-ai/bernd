"""Shared constants and enums for the Bernd application."""

from enum import Enum


class TodoStatus(str, Enum):
    """Status values for todos."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Priority(str, Enum):
    """Priority levels for todos."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class FileType(str, Enum):
    """Type values for files in semantic filesystem."""

    TODO = "todo"
    MEMORY = "memory"
    CHAT = "chat"


# Path prefixes
class Paths:
    """Path constants for the semantic filesystem."""

    TODOS = "/todos"
    MEMORIES = "/memories"
    CHATS = "/chats"
    ENTITIES = "/memories/entities"
    PROJECTS = "/memories/projects"
    PEOPLE = "/memories/people"
    USER_PROFILE = "/memories/user.md"
