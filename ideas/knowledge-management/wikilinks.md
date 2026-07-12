# Wikilinks

**Status:** Idea  
**Category:** Knowledge management  
**Related:** [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md), FR-2.7 (round-trip), Section 8 (Markdown)

## Overview

**Wikilinks** (`[[Note Title]]` or `[[path/to/note|Display Text]]`) connect documents in a personal knowledge base. Obsidian, Logseq, and Roam popularised this syntax. MarkDoc can support wikilinks as an optional extension while preserving standard Markdown portability.

## User stories

- As a note-taker, I want to type `[[` and autocomplete existing note titles in my vault.
- As a reader, I want clicking a wikilink to open the target document in MarkDoc.
- As an author, I want unresolved links styled differently so I know what to create.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-WIKI-1.1 | MarkDoc must support **wikilink syntax** `[[target]]` and `[[target|alias]]` as an optional extension (toggle in Preferences or per workspace). |
| IDEA-WIKI-1.2 | **Autocomplete** on `[[` shows matching files in the active folder workspace (requires folder sidebar). |
| IDEA-WIKI-1.3 | Clicking a resolved wikilink opens the target file; ⌘+click opens in new tab/window. |
| IDEA-WIKI-1.4 | **Unresolved links** render with distinct styling (e.g. dashed underline) and offer "Create note" on click. |
| IDEA-WIKI-1.5 | Link resolution rules documented: match by filename (without extension), relative path, or unique title; disambiguation UI when multiple matches. |
| IDEA-WIKI-1.6 | Wikilinks round-trip in saved Markdown; serialisation preserves `[[...]]` syntax (FR-2.7). |
| IDEA-WIKI-1.7 | Optional: treat standard Markdown links to local `.md` files as wikilinks in the UI without syntax change. |

## Non-functional considerations

- Index note titles/paths for autocomplete on workspace open.
- Case sensitivity configurable (default case-insensitive on macOS).

## Open questions

- Support block references `[[note#^block-id]]`?
- Embed transclusion `![[note]]` — separate feature?

## Dependencies

- [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md) for full value; limited mode with manual path resolution possible without it.

## Out of scope

- Synced graph database or block-level IDs (Roam-style).
