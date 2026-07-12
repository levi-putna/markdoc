# Find and Replace

**Status:** Partial — FR-2.4 mentions find & replace; this doc specifies the full feature  
**Category:** Writing polish  
**Related:** FR-2.4, [SearchOverlay](../../src/renderer/components/SearchOverlay.tsx) (document search)

## Overview

In-document find and replace is essential for editing long documents, refactoring terminology, and fixing repeated typos. MarkDoc should offer macOS-native find UX: incremental search, match highlighting, replace one/all, and optional regex.

## User stories

- As an editor, I want Cmd+F to find text with live highlight as I type.
- As an author, I want Cmd+Option+F to replace words across the document safely.
- As a developer, I want regex find/replace for bulk Markdown cleanup.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-FIND-1.1 | MarkDoc must provide **Find** (⌘F) with incremental, case-insensitive search by default. |
| IDEA-FIND-1.2 | Matches must be highlighted in the active editing surface (WYSIWYG and raw source mode). |
| IDEA-FIND-1.3 | Find UI must support **Next** / **Previous** match navigation with keyboard shortcuts (⌘G / ⇧⌘G). |
| IDEA-FIND-1.4 | MarkDoc must provide **Find and Replace** (⌘⌥F) with Replace, Replace All, and Replace & Find. |
| IDEA-FIND-1.5 | Replace All must require confirmation when match count exceeds a threshold (e.g. 10) to prevent accidental mass replacement. |
| IDEA-FIND-1.6 | Optional **regex mode** with capture groups for power users; invalid regex must show inline error without breaking the editor. |
| IDEA-FIND-1.7 | Options: match case, whole word, search in selection only. |
| IDEA-FIND-1.8 | Find/replace state must be scoped per document window; closing the find bar clears highlights. |
| IDEA-FIND-1.9 | In WYSIWYG mode, find/replace operates on the **serialized Markdown text** or equivalent plain-text projection so results match saved file content. |

## Non-functional considerations

- Find must perform adequately on 10k-word documents; degrade gracefully in Large Document Mode (may limit live highlight frequency).
- Undo after Replace All must be a single undo step.

## Open questions

- Should find span Preview (read-only highlight only)?
- Relationship to document search overlay (Section 13) — merge UI or keep separate?

## Existing coverage

FR-2.4 lists find & replace among standard editing conventions. This document defines the expected behaviour for promotion into detailed requirements and test cases.
