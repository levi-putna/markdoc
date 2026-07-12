# Tags and Tag Browser

**Status:** Idea  
**Category:** Knowledge management  
**Related:** gray-matter (frontmatter), [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md)

## Overview

**Tags** organise notes by topic (`#project`, `#todo`) in body text or YAML frontmatter. A **tag browser** lets users filter and browse all notes with a given tag — common in Bear, Obsidian, and Notion exports.

## User stories

- As a note-taker, I want `#tags` in text autocompleted from existing tags in my vault.
- As a user, I want a tag list sidebar to open all notes tagged `meeting`.
- As an author, I want tags in frontmatter (`tags: [a, b]`) indexed alongside inline tags.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-TAG-1.1 | MarkDoc must recognise **inline hashtags** `#tag` and **YAML frontmatter tags** as metadata (not rendered as headings). |
| IDEA-TAG-1.2 | Typing `#` in prose offers **autocomplete** from tags used in the active workspace. |
| IDEA-TAG-1.3 | **Tag browser** panel lists all tags with note counts; clicking filters the file tree or opens a tag search result list. |
| IDEA-TAG-1.4 | Tags normalised: case-insensitive storage, display preserves first-seen casing; no spaces (use `#kebab-case` or `#multi-word` conventions documented). |
| IDEA-TAG-1.5 | Nested tags optional: `#project/markdoc` hierarchy in browser (Obsidian-style). |
| IDEA-TAG-1.6 | Clicking a tag in Preview navigates to tag browser filtered view. |
| IDEA-TAG-1.7 | Tag index rebuilds on workspace file changes (same pipeline as global search). |

## Non-functional considerations

- Do not confuse `# heading` syntax with tags — tags require non-whitespace after `#` and valid tag character set.
- Hash in code blocks ignored.

## Open questions

- Support `@person` or other sigil types?
- Tag colours assigned automatically or user-defined?

## Dependencies

- [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md) for vault-wide tag index.

## Out of scope

- Tag sync across devices (no cloud).
