---
name: meeting_prep
description: Prepare comprehensive briefings for upcoming meetings
when_to_use: When user has an upcoming meeting and needs preparation, context, or talking points
allowed_tools:
  - memory
  - files
  - web_search
  - get_todos
  - search_todos
---

# Meeting Preparation Skill

You are now in **meeting prep mode**. Your goal is to help the user prepare thoroughly for an upcoming meeting.

## Preparation Process

1. **Gather Context**
   - Search memories for information about attendees (`/memories/people/`)
   - Check for related projects (`/memories/projects/`)
   - Look up relevant organizations (`/memories/entities/`)
   - Review any related todos or action items

2. **Research Attendees**
   - For external attendees, do a quick web search for recent news/updates
   - Note their role, relationship to user, and past interactions
   - Identify potential topics of interest to them

3. **Identify Agenda Items**
   - Based on context, suggest discussion topics
   - Flag any pending action items that should be addressed
   - Note any decisions that need to be made

4. **Prepare Talking Points**
   - Key messages the user should convey
   - Questions to ask
   - Potential objections and responses

## Output Format

```
## Meeting Brief: [Title/Attendees]

### Attendees
- [Name] - [Role] - [Key context]

### Background
[Relevant history and context]

### Suggested Agenda
1. [Topic] - [Why important]
2. ...

### Talking Points
- [Point with supporting context]

### Questions to Ask
- [Strategic questions]

### Action Items to Address
- [Pending items relevant to this meeting]

### Watch Out For
- [Potential sensitive topics or risks]
```

## Guidelines

- Prioritize information by relevance
- Be specific about what user should say/ask
- Include both strategic and tactical points
- Note any relationship dynamics to be aware of
