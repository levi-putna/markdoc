# Auto Table of Contents

**Status:** Idea  
**Category:** Writing polish  
**Related:** Section 5 (Outline), FR-4.x

## Overview

Many Markdown authors embed a `[TOC]` or `<!-- toc -->` block that renders as a clickable table of contents in preview and export. Unlike the sidebar outline (navigation chrome), an in-document TOC is part of the published content — common in README files, wikis, and long reports.

## User stories

- As an author, I want to insert a TOC block that auto-updates when headings change.
- As a reader of exported HTML/PDF, I want in-document jump links to sections.
- As a writer, I want to exclude certain heading levels from the TOC.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-TOC-1.1 | MarkDoc must support an **auto TOC** block inserted via menu, slash command, or Markdown convention (e.g. `[TOC]` on its own line). |
| IDEA-TOC-1.2 | The TOC must regenerate from document headings (H1–H6) on edit, debounced like preview updates. |
| IDEA-TOC-1.3 | TOC entries must be **clickable** in Preview and export (HTML, PDF) jumping to the corresponding heading anchor. |
| IDEA-TOC-1.4 | User-configurable **minimum/maximum heading depth** included in the TOC (default H2–H3 for `[TOC]`, all levels optional). |
| IDEA-TOC-1.4a | Optional: exclude headings tagged with a special class or `<!-- no-toc -->` HTML comment adjacent to the heading. |
| IDEA-TOC-1.5 | In WYSIWYG mode, the TOC renders as a styled block (not raw `[TOC]` text) while serializing back to the agreed Markdown convention on save. |
| IDEA-TOC-1.6 | Exported DOCX should include a native Word TOC field where feasible, or a static linked list as fallback. |

## Non-functional considerations

- Heading anchor IDs must be stable across edits where possible (slug from heading text + disambiguation suffix).
- TOC block must not appear in the sidebar outline as a duplicate tree root.

## Open questions

- Which Markdown TOC syntax to standardise on (`[TOC]`, `{% toc %}`, Kramdown `{:toc}`)?
- Should the sidebar outline offer "Insert TOC at cursor" as a one-click action?

## Out of scope

- Multi-document combined TOC across a folder.
