# Presentation Slide Mode

**Status:** Idea  
**Category:** Publishing  
**Related:** Section 9 (Diagrams), Section 12 (Export), Mermaid

## Overview

**Presentation mode** turns a Markdown document into a slideshow — typically split on `---` horizontal rules (Marp) or H1 boundaries. Speakers preview slides full-screen and export to PDF or HTML deck.

## User stories

- As a presenter, I want to write slides in Markdown and present full-screen from MarkDoc.
- As a teacher, I want speaker notes in HTML comments rendered only in presenter view.
- As a user, I want to export slide deck PDF with one action.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-SLIDE-1.1 | MarkDoc must support **Presentation mode** toggled from View menu or export flow. |
| IDEA-SLIDE-1.2 | Slide boundaries defined by `---` on its own line (Marp-compatible default) with optional "split on H1" mode. |
| IDEA-SLIDE-1.3 | **Present** opens full-screen slide viewer with keyboard navigation (←/→, space, escape). |
| IDEA-SLIDE-1.4 | Slides render Mermaid, code blocks, images, and math (if [footnotes-and-inline-math](../writing-polish/footnotes-and-inline-math.md) exists). |
| IDEA-SLIDE-1.5 | Optional **speaker notes** from `<!-- notes: ... -->` or second column — presenter view shows notes, audience view does not. |
| IDEA-SLIDE-1.6 | Export: PDF (one slide per page), HTML deck (reveal.js-style static bundle). |
| IDEA-SLIDE-1.7 | Theme: default slide CSS + link to [custom-css-themes](./custom-css-themes.md). |

## Non-functional considerations

- Full-screen uses separate BrowserWindow or dedicated view; ESC always exits.
- Large decks (100+ slides) lazy-render adjacent slides.

## Open questions

- Native Marp CLI compatibility vs built-in renderer?
- Slide aspect ratio 16:9 vs 4:3 preference?

## Out of scope

- Remote audience sync or slide laser pointer beyond macOS cursor.
