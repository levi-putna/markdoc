# Share as HTML Export

**Status:** Idea  
**Category:** Versioning and sharing  
**Related:** Section 12 (Export)

## Overview

Full export (Section 12) targets PDF, DOCX, and polished HTML. **Share as HTML** is a fast path: one click to generate a self-contained or minimal HTML file for email, Slack, or browser preview — optimised for speed over print layout.

## User stories

- As a blogger, I want to copy rendered HTML to paste into a CMS.
- As a colleague, I want to share a quick HTML preview of my doc without configuring export options.
- As a user, I want Share → Copy HTML to clipboard.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-SHTML-1.1 | MarkDoc must offer **Share as HTML** (Share menu or Export submenu) distinct from full HTML export. |
| IDEA-SHTML-1.2 | Output modes: **Copy HTML to clipboard**, **Save HTML file…**, **Open in Browser** (temp file). |
| IDEA-SHTML-1.3 | Default: single-file HTML with inlined CSS (current preview theme); images embedded as data URLs or relative paths user-selectable. |
| IDEA-SHTML-1.4 | Optional **minimal HTML** (body fragment only) for CMS paste. |
| IDEA-SHTML-1.5 | Sanitise output (DOMPurify consistent with preview pipeline). |
| IDEA-SHTML-1.6 | macOS **Share sheet** integration (Section 16 deferred Services menu — revisit here as Share extension). |

## Non-functional considerations

- Generate in < 2s for typical documents.
- Large images: warn before data-URL embedding inflates size.

## Open questions

- Relationship to Section 12 HTML export — merge or keep separate quick action?
- Publish to Pastebin-style services — out of scope?

## Out of scope

- Hosted sharing URLs (requires server).
