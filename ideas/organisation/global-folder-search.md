# Global Folder Search

**Status:** Idea  
**Category:** Organisation and navigation  
**Related:** Section 13 (Document Search), minisearch, [folder-workspace-sidebar](./folder-workspace-sidebar.md)

## Overview

In-document search (Section 13) helps navigate a single file. **Global folder search** finds text across all Markdown files in a workspace — essential for note vaults, documentation repos, and personal wikis.

## User stories

- As a researcher, I want to search all notes for a term and jump to the matching file/line.
- As a developer, I want regex search across `docs/` to refactor API names.
- As a user, I want ranked results with heading context snippets.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-GSEARCH-1.1 | When a folder workspace is open, MarkDoc must provide **Search in Folder** (⇧⌘F) across all indexed Markdown files. |
| IDEA-GSEARCH-1.2 | Search indexes: file name, headings, body text, optional frontmatter tags/title. |
| IDEA-GSEARCH-1.3 | Results list shows file path, match snippet, line number; selecting opens file at match location. |
| IDEA-GSEARCH-1.4 | Index built with **minisearch** (or equivalent) incrementally on folder open and on filesystem changes. |
| IDEA-GSEARCH-1.5 | Options: case sensitivity, whole word, regex, filter by tag or path glob. |
| IDEA-GSEARCH-1.6 | Performance target: folders up to 500 files / 50MB index under 2s initial build on Apple Silicon; background indexing with progress indicator for larger vaults. |
| IDEA-GSEARCH-1.7 | Without folder workspace, global search disabled or prompts to open a folder. |

## Non-functional considerations

- Index stored locally in Application Support; rebuild on corruption.
- Exclude binary assets and non-Markdown files; honour ignore patterns (`.gitignore` optional).

## Open questions

- Merge with in-document search UI (single palette with scope toggle)?
- Full-text fuzzy matching vs prefix-only for v1?

## Dependencies

- Strongly depends on [folder-workspace-sidebar](./folder-workspace-sidebar.md).

## Out of scope

- Spotlight integration (system-wide search).
