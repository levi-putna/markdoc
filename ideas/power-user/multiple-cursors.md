# Multiple Cursors and Block Selection

**Status:** Idea  
**Category:** Power user and accessibility  
**Related:** FR-2.4 (select all), Tiptap/ProseMirror capabilities

## Overview

**Multiple cursors** let users edit the same text in many places at once (⌥+click, ⌘⌥↓). **Block/column selection** helps bulk-edit lists and tables. These are common in VS Code and Sublime; less common in WYSIWYG but valued by power users.

## User stories

- As an editor, I want to rename a repeated term in multiple places simultaneously.
- As a author, I want column selection in a table to paste values down a column.
- As a user, I want ⌘⌥↓ to add cursor on next matching word (Sublime-style).

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-MCUR-1.1 | **Raw source mode** should support multiple cursors via CodeMirror (if CM6 migration) or equivalent. |
| IDEA-MCUR-1.2 | WYSIWYG editor: support **add cursor above/below** (⌥⌘↑/↓) at minimum; full multi-cursor optional based on ProseMirror plugin feasibility. |
| IDEA-MCUR-1.3 | **Select next occurrence** (⌘⌘G or ⌘D) adds selection match to multi-selection. |
| IDEA-MCUR-1.4 | All cursors type and delete in sync; undo is single step. |
| IDEA-MCUR-1.5 | Block selection in source mode for rectangular edits. |
| IDEA-MCUR-1.6 | Multi-cursor disabled inside Mermaid/diagram blocks and complex tables if unsupported — show tooltip. |

## Non-functional considerations

- ProseMirror multi-cursor is non-trivial; may ship source-mode-first.
- Performance cap on cursor count (e.g. 100) to avoid lag.

## Open questions

- Ship source-only multi-cursor as v1 of this feature?
- Table column select requires custom table plugin?

## Out of scope

- Simultaneous collaborative cursors (multiplayer).
