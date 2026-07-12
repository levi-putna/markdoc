# Custom CSS Themes

**Status:** Partial — Section 10 (Per-Document Style Overrides) exists  
**Category:** Publishing  
**Related:** Section 10, FR-3.5 (preview theme), Section 12 (Export)

## Overview

Section 10 covers per-document style overrides. **Custom CSS themes** extend this with a **library of reusable themes** (Typora-style) applied globally or per document — controlling typography, colours, spacing for editor, preview, and export from one CSS file.

## User stories

- As a designer, I want to write CSS once and apply it to all my blog drafts.
- As a user, I want built-in themes (GitHub, Newsprint, Night) plus import community themes.
- As an author, I want editor and preview to share the same theme for WYSIWYG fidelity.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-THEME-1.1 | MarkDoc must support **global theme** selection in Preferences affecting Preview and export. |
| IDEA-THEME-1.2 | **Per-document theme** override via frontmatter (`theme: newsprint`) or Section 10 sidecar — resolves open question in Section 17. |
| IDEA-THEME-1.3 | Themes are CSS files in `~/Library/Application Support/MarkDoc/Themes/` with a documented variable schema (CSS custom properties for fonts, colours, margins). |
| IDEA-THEME-1.4 | Built-in themes: Default (design-guide), GitHub-like, Serif (iA Writer), Dark code-focused. |
| IDEA-THEME-1.5 | **Import theme…** copies CSS into Themes folder; theme picker shows live preview thumbnail. |
| IDEA-THEME-1.6 | Editor chrome uses app theme (FR-1.6); **content area** optionally styled by document theme for closer preview match. |
| IDEA-THEME-1.7 | Export (PDF/HTML/DOCX) respects active theme where format allows; DOCX maps CSS to styles where possible. |

## Non-functional considerations

- Sanitise theme CSS — no `javascript:` URLs or external network fetches without consent.
- Theme load must not break editor if CSS invalid (fallback to default).

## Open questions

- Single sidecar vs shared palette (Section 17 open question)?
- Typora `.css` theme import compatibility?

## Existing coverage

Section 10 (Per-Document Style Overrides) and FR-3.5. Promote unified theme system when consolidating style architecture.
