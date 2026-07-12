# Folder Workspace Sidebar

**Status:** Idea  
**Category:** Organisation and navigation  
**Related:** FR-5.x (File Management), [folder-workspace-sidebar](./folder-workspace-sidebar.md), [global-folder-search](./global-folder-search.md)

## Overview

MarkDoc today opens individual Markdown files. A **folder workspace** sidebar lets users open a directory (vault, project, notes folder) and browse, create, rename, and open `.md` files from a tree — the foundation for wiki-style workflows without cloud sync.

## User stories

- As a note-taker, I want to open my `~/Notes` folder and browse all Markdown files in a sidebar.
- As a developer, I want MarkDoc as a lightweight editor for a git-tracked `docs/` folder.
- As a user, I want to create new notes in the current folder without a separate Save As dialog every time.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-FOLDER-1.1 | MarkDoc must support **Open Folder…** to attach a directory as the active workspace. |
| IDEA-FOLDER-1.2 | A **file tree sidebar** lists `.md` and registered extensions (FR-5.1) recursively or to a configurable depth. |
| IDEA-FOLDER-1.3 | Clicking a file opens it in the current window (tab) or new window per preference. |
| IDEA-FOLDER-1.4 | Context menu: New File, New Folder, Rename, Reveal in Finder, Delete (with confirmation). |
| IDEA-FOLDER-1.5 | The workspace root path persists in app state restoration (FR-5.9) and reopens on relaunch. |
| IDEA-FOLDER-1.6 | External file changes (FR-5.10) update the tree (new/deleted/renamed files) via filesystem watcher. |
| IDEA-FOLDER-1.7 | Optional: pin multiple root folders (multi-root workspace) — defer to v2 of this feature; single root for v1. |
| IDEA-FOLDER-1.8 | Folder sidebar collapsible independently of outline sidebar (two sidebar modes or combined tabs: Files / Outline). |

## Non-functional considerations

- Index large folders (1000+ files) incrementally; virtualise tree rendering.
- Respect `.gitignore` or hidden file filters (configurable: show dotfiles yes/no).

## Open questions

- Default new note naming: `Untitled.md`, timestamp, or prompt?
- Exclude `node_modules`, `.git` by default?

## Dependencies

- Enables [wikilinks](../knowledge-management/wikilinks.md), [global-folder-search](./global-folder-search.md), [backlinks](../knowledge-management/backlinks-panel.md).

## Out of scope

- Cloud sync, remote filesystems, or non-local volumes beyond macOS support.
