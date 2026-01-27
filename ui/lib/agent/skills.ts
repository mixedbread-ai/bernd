// Skill loader for the Bernd agent
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface Skill {
  name: string;
  description: string;
  whenToUse: string;
  allowedTools: string[];
  content: string;
  path: string;
}

// Skills directory - look in the root skills folder
const SKILLS_DIR = path.join(process.cwd(), "..", "skills");

function parseSkillFile(filePath: string): Skill | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data, content: markdownContent } = matter(content);

    return {
      name:
        (data.name as string) || path.dirname(filePath).split("/").pop() || "",
      description: (data.description as string) || "",
      whenToUse: (data.when_to_use as string) || "",
      allowedTools: (data.allowed_tools as string[]) || [],
      content: markdownContent.trim(),
      path: filePath,
    };
  } catch (e) {
    console.error(`[Skills] Error parsing ${filePath}:`, e);
    return null;
  }
}

export function discoverSkills(): Map<string, Skill> {
  const skills = new Map<string, Skill>();

  // Try both locations for skills
  const skillsDirs = [SKILLS_DIR, path.join(process.cwd(), "skills")];

  for (const skillsDir of skillsDirs) {
    if (!fs.existsSync(skillsDir)) continue;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillFile = path.join(skillsDir, entry.name, "skill.md");
      if (!fs.existsSync(skillFile)) continue;

      const skill = parseSkillFile(skillFile);
      if (skill) {
        skills.set(skill.name, skill);
      }
    }
  }

  return skills;
}

export function generateSkillDescriptions(
  skills: Map<string, Skill>,
  maxChars = 15000,
): string {
  if (skills.size === 0) {
    return "No skills available.";
  }

  const lines = ["Available skills:\n"];

  for (const [name, skill] of [...skills.entries()].sort()) {
    const desc = skill.description || "No description";
    const when = skill.whenToUse || "";

    let entry = `- "${name}": ${desc}`;
    if (when) {
      entry += ` (Use when: ${when})`;
    }

    lines.push(entry);
  }

  let result = lines.join("\n");

  // Truncate if too long
  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars - 3)}...`;
  }

  return result;
}

// Cache for loaded skills
let _loadedSkills: Map<string, Skill> | null = null;

export function getSkills(): Map<string, Skill> {
  if (!_loadedSkills) {
    _loadedSkills = discoverSkills();
  }
  return _loadedSkills;
}

export function handleSkill(skillName: string): {
  status: string;
  skill?: string;
  instructions?: string;
  allowedTools?: string[];
  message?: string;
  error?: string;
  available?: string[];
} {
  const skills = getSkills();

  const skill = skills.get(skillName);
  if (!skill) {
    return {
      status: "error",
      error: `Unknown skill: ${skillName}`,
      available: [...skills.keys()],
    };
  }

  return {
    status: "activated",
    skill: skillName,
    instructions: skill.content,
    allowedTools: skill.allowedTools,
    message: `Skill '${skillName}' activated. Follow the instructions above.`,
  };
}
