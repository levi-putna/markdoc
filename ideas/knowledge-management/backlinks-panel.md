# Backlinks Panel

**Status:** Idea  
**Category:** Knowledge management  
**Related:** [wikilinks](./wikilinks.md), [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md)

## Overview

A **backlinks panel** shows all other documents that link to the current note — the complement to outbound wikilinks. This is a signature Obsidian feature for discovering relationships in a knowledge base.

## User stories

- As a researcher, I want to see which notes link to the current one without manual search.
- As a writer, I want backlink context snippets to decide if I need to update related notes.
- As a user, I want backlinks to update when I add wikilinks in other files.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-BACK-1.1 | When a folder workspace is open, MarkDoc must provide a **Backlinks** panel (sidebar tab or bottom panel) for the active document. |
| IDEA-BACK-1.2 | Backlinks list documents containing wikilinks or local Markdown links pointing to the current file. |
| IDEA-BACK-1.3 | Each backlink entry shows source file name and a **context snippet** around the link. |
| IDEA-BACK-1.4 | Clicking a backlink opens the source file at the linking location. |
| IDEA-BACK-1.5 | Backlink index updates incrementally on file save and external filesystem changes (watcher). |
| IDEA-BACK-1.6 | **Unlinked mentions** (optional v2): plain-text occurrences of the note title without a link — show as "Suggested links". |
| IDEA-BACK-1.7 | Empty state: "No backlinks yet" with hint to add `[[wikilinks]]` in other notes. |

## Non-functional considerations

- Backlink index stored alongside global search index; rebuild on demand.
- Performance: backlink query for one file < 100ms with 1000-file vault.

## Open questions

- Include backlinks from standard `[text](./file.md)` links only, or also HTML `<a href>`?
- Show backlink count badge on file tree nodes?

## Dependencies

- [wikilinks](./wikilinks.md) or local link syntax; [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md).

## Out of scope

- Semantic "related notes" via AI embedding similarity.
