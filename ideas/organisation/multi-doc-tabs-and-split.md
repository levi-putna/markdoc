# Multi-Document Tabs and Split View

**Status:** Idea — partial overlap with FR-1.5 and FR-5.8 (multiple windows/tabs)  
**Category:** Organisation and navigation  
**Related:** FR-1.5, FR-5.8, FR-3.2 (view modes)

## Overview

While MarkDoc supports multiple windows and macOS native window tabs (FR-1.5, FR-5.8), users often want **in-window tabs** (like VS Code or Safari) and **split panes** to edit two sections or two documents side-by-side within one window.

## User stories

- As a user, I want tabs at the top of the window to switch between open documents without cluttering the Dock.
- As a researcher, I want to split the editor to reference notes on the left while writing on the right.
- As a writer, I want split view to show WYSIWYG + Preview or two cursor positions in the same document.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-TABS-1.1 | MarkDoc should offer optional **in-window document tabs** in addition to macOS native window tabs, user-selectable in Preferences. |
| IDEA-TABS-1.2 | Tabs show document title (filename or "Untitled") and unsaved indicator (dot). |
| IDEA-TABS-1.3 | Middle-click or ⌘W on tab closes document with unsaved-changes prompt (FR-5.6). |
| IDEA-TABS-1.4 | **Split editor**: View → Split Editor Right/Down opens a second pane in the same window. |
| IDEA-TABS-1.5 | Split panes may show: same document (two scroll positions), two different documents, or Editor + Preview (extends FR-3.2 side-by-side). |
| IDEA-TABS-1.6 | Each pane has independent scroll; optional **linked scroll** toggle for same-document splits. |
| IDEA-TABS-1.7 | Drag tab to split edge (VS Code-style) to open document in split pane. |
| IDEA-TABS-1.8 | Maximum split depth: 2 panes (horizontal or vertical) for v1 of this feature — avoid arbitrary tiling complexity. |

## Non-functional considerations

- Memory: each tab holds editor state; lazy-unload inactive tabs for large documents.
- Single undo stack per pane; clarify cross-pane undo behaviour in open questions.

## Open questions

- Same file open in two tabs/panes — warn about concurrent save (see FR Section 17)?
- Do in-window tabs replace or supplement macOS window tabs?

## Existing coverage

FR-1.5 (native window tabs) and FR-5.8 (multiple documents) provide baseline; this doc defines enhanced tab/split UX.
