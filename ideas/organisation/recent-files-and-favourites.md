# Recent Files and Favourites

**Status:** Idea — partial overlap with FR-5.4 (Open Recent)  
**Category:** Organisation and navigation  
**Related:** FR-5.4, FR-1.8 (launch behaviour)

## Overview

Quick access to recently edited documents and **pinned favourites** reduces friction for returning users. macOS Open Recent exists (FR-5.4); this feature adds a richer in-app panel, pinning, and optional launch screen — extending beyond FR-1.8's "blank document on launch" default.

## User stories

- As a daily user, I want a visual recent files list with thumbnails or first-line preview.
- As a writer, I want to pin 5–10 "always open" documents for one-click access.
- As a user, I want to disable recents for privacy on shared Macs.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-RECENT-1.1 | MarkDoc must maintain **Open Recent** in the File menu (FR-5.4) with configurable list length (default 10). |
| IDEA-RECENT-1.2 | Extend: optional **Recents panel** in sidebar or start sheet showing recent files with title, path, last modified. |
| IDEA-RECENT-1.3 | **Favourites / Pinned**: user can pin files or folders; pinned items appear at top of recents and in a Favourites section. |
| IDEA-RECENT-1.4 | Pin state stored in app preferences (not modifying document files). |
| IDEA-RECENT-1.5 | Clear Recent List command (privacy); removes in-app list, optionally clears macOS recent documents. |
| IDEA-RECENT-1.6 | Optional preference: **on launch**, show recents sheet instead of blank document (overrides FR-1.8 when enabled). |
| IDEA-RECENT-1.7 | Recent entries validate on open — missing files show strikethrough and offer Remove from List. |

## Non-functional considerations

- Store recents as file paths + security-scoped bookmarks if sandboxed in future.
- Do not store document content in recents metadata (privacy).

## Open questions

- Pin folders (opens folder workspace) vs pin files only?
- iCloud Drive paths and broken bookmark recovery?

## Existing coverage

FR-5.4 requires Open Recent; FR-1.8 defers welcome screen to v1+. This doc captures enhanced recents/favourites UX.
