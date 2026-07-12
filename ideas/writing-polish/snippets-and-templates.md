# Snippets and Templates

**Status:** Idea  
**Category:** Writing polish  
**Related:** FR-5.4 (New), gray-matter (frontmatter), Section 14 (Preferences)

## Overview

Snippets and templates speed up repetitive authoring: meeting notes, blog post skeletons, API doc sections, and YAML frontmatter presets. Users insert boilerplate via menu, shortcut, or autocomplete trigger.

## User stories

- As a user, I want "New from template" when creating a document.
- As a writer, I want to type `;mtg` and expand to a meeting notes template.
- As a team lead, I want to share a folder of `.md` template files the app discovers automatically.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-SNIP-1.1 | MarkDoc must support **document templates** applied on File → New from Template… and optionally as the default for File → New. |
| IDEA-SNIP-1.2 | Templates are Markdown files stored in a user-configurable **Templates folder** (default: `~/Library/Application Support/MarkDoc/Templates/`). |
| IDEA-SNIP-1.3 | MarkDoc must support **text snippets** with a trigger string (e.g. `;sig` → signature block) inserted at cursor in WYSIWYG and source mode. |
| IDEA-SNIP-1.4 | Snippet triggers must not fire inside code blocks unless explicitly prefixed with escape. |
| IDEA-SNIP-1.5 | Snippets may include **placeholder fields** (`${date}`, `${title}`, `${cursor}`) expanded on insert. |
| IDEA-SNIP-1.6 | Built-in starter templates: blank, meeting notes, blog post (title + frontmatter), README skeleton. |
| IDEA-SNIP-1.7 | Templates and snippets manageable from Preferences (add, edit, delete, reorder). |

## Non-functional considerations

- Template list loads asynchronously; large template libraries (50+) still usable.
- Snippet expansion is one undo step.

## Open questions

- Import templates from Obsidian / VS Code snippet format?
- Variable `${clipboard}` for paste buffer?

## Out of scope

- Cloud template marketplace or sync.
