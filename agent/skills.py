"""
Skill loader and meta-tool for the Bernd agent.

Skills are modular capabilities that inject specialized instructions into
the agent's context when activated. Each skill is a folder containing a
skill.md file with YAML frontmatter and markdown instructions.

Based on Claude Agent Skills architecture:
https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/
"""

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

# Skills directory relative to project root
SKILLS_DIR = Path(__file__).parent.parent / "skills"


@dataclass
class Skill:
    """Represents a loaded skill."""

    name: str
    description: str
    when_to_use: str
    allowed_tools: list[str]
    content: str  # Full markdown instructions
    path: Path

    def get_prompt(self) -> str:
        """Get the full prompt to inject when skill is activated."""
        return self.content


def parse_skill_file(path: Path) -> Skill | None:
    """Parse a skill.md file into a Skill object.

    Format:
    ---
    name: skill-name
    description: What the skill does
    when_to_use: When to activate this skill
    allowed_tools:
      - tool1
      - tool2
    ---

    # Skill Instructions
    [markdown content]
    """
    try:
        content = path.read_text()

        # Parse YAML frontmatter
        frontmatter_match = re.match(r"^---\n(.*?)\n---\n(.*)$", content, re.DOTALL)
        if not frontmatter_match:
            return None

        frontmatter_text = frontmatter_match.group(1)
        markdown_content = frontmatter_match.group(2).strip()

        # Simple YAML parsing (avoiding external dependency)
        metadata = {}
        current_key = None
        current_list = None

        for line in frontmatter_text.split("\n"):
            line = line.rstrip()
            if not line:
                continue

            # Check for list item
            if line.startswith("  - "):
                if current_list is not None:
                    current_list.append(line[4:].strip())
                continue

            # Check for key: value
            if ":" in line:
                key, _, value = line.partition(":")
                key = key.strip()
                value = value.strip()

                if value:
                    metadata[key] = value
                    current_key = None
                    current_list = None
                else:
                    # Start of a list
                    current_key = key
                    current_list = []
                    metadata[key] = current_list

        return Skill(
            name=metadata.get("name", path.parent.name),
            description=metadata.get("description", ""),
            when_to_use=metadata.get("when_to_use", ""),
            allowed_tools=metadata.get("allowed_tools", []),
            content=markdown_content,
            path=path,
        )

    except Exception as e:
        print(f"[Skills] Error parsing {path}: {e}")
        return None


def discover_skills(skills_dir: Path = SKILLS_DIR) -> dict[str, Skill]:
    """Discover all skills from the skills directory.

    Returns:
        Dict mapping skill name to Skill object
    """
    skills = {}

    if not skills_dir.exists():
        return skills

    for skill_folder in skills_dir.iterdir():
        if not skill_folder.is_dir():
            continue

        skill_file = skill_folder / "skill.md"
        if not skill_file.exists():
            continue

        skill = parse_skill_file(skill_file)
        if skill:
            skills[skill.name] = skill
            print(f"[Skills] Loaded: {skill.name}")

    return skills


def generate_skill_descriptions(skills: dict[str, Skill], max_chars: int = 15000) -> str:
    """Generate a formatted list of skill descriptions for the tool prompt.

    Args:
        skills: Dict of loaded skills
        max_chars: Maximum characters for the description (token budget)

    Returns:
        Formatted string describing available skills
    """
    if not skills:
        return "No skills available."

    lines = ["Available skills:\n"]

    for name, skill in sorted(skills.items()):
        desc = skill.description or "No description"
        when = skill.when_to_use or ""

        entry = f'- "{name}": {desc}'
        if when:
            entry += f" (Use when: {when})"

        lines.append(entry)

    result = "\n".join(lines)

    # Truncate if too long
    if len(result) > max_chars:
        result = result[: max_chars - 3] + "..."

    return result


def create_skill_tool(skills: dict[str, Skill]) -> dict:
    """Create the Skill meta-tool definition.

    This tool allows the agent to activate skills by name.
    When invoked, it returns instructions to inject the skill's
    prompt into the conversation.
    """
    skill_list = generate_skill_descriptions(skills)

    return {
        "type": "function",
        "name": "skill",
        "description": f"""Activate a specialized skill to handle complex tasks.

Skills inject expert instructions and workflows into the conversation.
Use this when a task matches a skill's purpose.

{skill_list}

To use: call skill(name="skill-name")
The skill's instructions will guide subsequent actions.""",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Name of the skill to activate",
                    "enum": list(skills.keys()) if skills else ["none"],
                },
            },
            "required": ["name"],
        },
    }


def create_skill_handler(skills: dict[str, Skill]):
    """Create the handler function for the skill tool.

    Returns a function that, when called with a skill name,
    returns the skill's prompt to be injected into the conversation.
    """

    def handle_skill(args: dict) -> dict:
        skill_name = args.get("name", "")

        if skill_name not in skills:
            return {
                "error": f"Unknown skill: {skill_name}",
                "available": list(skills.keys()),
            }

        skill = skills[skill_name]

        return {
            "status": "activated",
            "skill": skill_name,
            "instructions": skill.get_prompt(),
            "allowed_tools": skill.allowed_tools,
            "message": f"Skill '{skill_name}' activated. Follow the instructions above.",
        }

    return handle_skill


# Load skills on module import
_loaded_skills: dict[str, Skill] = {}


def get_skills() -> dict[str, Skill]:
    """Get loaded skills, discovering them if not already loaded."""
    global _loaded_skills
    if not _loaded_skills:
        _loaded_skills = discover_skills()
    return _loaded_skills


def get_skill_tool() -> dict:
    """Get the skill tool definition."""
    return create_skill_tool(get_skills())


def get_skill_handler():
    """Get the skill handler function."""
    return create_skill_handler(get_skills())
