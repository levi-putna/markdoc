# Local Version History

**Status:** Idea  
**Category:** Versioning and sharing  
**Related:** FR-5.5 (explicit save), FR-5.11 (crash recovery)

## Overview

**Local version history** snapshots document content over time so users can compare, restore, or copy from earlier versions — without cloud sync or multi-user collaboration (explicitly out of scope in Section 16). Complements git for users who do not use version control.

## User stories

- As a writer, I want to restore a paragraph I deleted yesterday.
- As a cautious editor, I want to see a diff before reverting to an older version.
- As a user, I want version history stored locally without sending content to the cloud.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-HIST-1.1 | MarkDoc must maintain **local snapshots** of saved document versions in Application Support (or `.markdoc/history/` sidecar per document — open question). |
| IDEA-HIST-1.2 | Snapshots created on: explicit Save, timed interval (optional, default every 5 min while editing), and before Revert to Saved. |
| IDEA-HIST-1.3 | **Version History** UI (File → Version History…) lists snapshots with timestamp and optional label (auto: "Before save", "Auto-save"). |
| IDEA-HIST-1.4 | Selecting a snapshot shows **diff view** (side-by-side or unified) against current document. |
| IDEA-HIST-1.5 | Actions: **Restore** (replace current; undoable), **Copy to clipboard**, **Export snapshot as file**. |
| IDEA-HIST-1.6 | Retention policy configurable: max snapshots per file (default 50) and max age (default 30 days). |
| IDEA-HIST-1.7 | Version history must work for untitled documents keyed by crash-recovery session ID until first save. |

## Non-functional considerations

- Storage cap per document (e.g. 10MB history); prune oldest when exceeded.
- Diff performance on large files — may compare Markdown text, not WYSIWYG DOM.

## Open questions

- Sidecar folder next to document vs central app storage (git-friendly sidecar may pollute repos)?
- Integrate with macOS Versions API despite FR-5.5 choosing explicit save?

## Out of scope

- Multi-user real-time collaboration history.
