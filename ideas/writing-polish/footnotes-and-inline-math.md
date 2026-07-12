# Footnotes and Inline Math

**Status:** Idea  
**Category:** Writing polish  
**Related:** Section 8 (Markdown Format), Section 9 (Diagrams), FR-2.7 (round-trip)

## Overview

Academic, technical, and scientific writers need **footnotes** and **inline/display math** (LaTeX via KaTeX or MathJax). These complement existing Mermaid diagram support and broaden MarkDoc beyond general prose into technical documentation and research notes.

## User stories

- As a researcher, I want `[^1]` footnotes that render at the bottom of the document with backlinks.
- As an engineer, I want `$E=mc^2$` inline and `$$...$$` display math rendered in preview and export.
- As an author, I need round-trip fidelity so files remain readable in other Markdown tools.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-MATH-1.1 | MarkDoc must support **GFM-style footnotes**: `[^id]` references and `[^id]: text` definitions. |
| IDEA-MATH-1.2 | Footnotes must render in Preview with superscript links and a footnotes section; WYSIWYG editing should show footnote markers without exposing raw syntax except on the active line (FR-2.2a). |
| IDEA-MATH-1.3 | MarkDoc must support **inline math** delimited by `$...$` (or `\(...\)`) and **display math** by `$$...$$` (or `\[...\]`), rendered via KaTeX (preferred for speed) or equivalent. |
| IDEA-MATH-1.4 | Invalid LaTeX must show a non-blocking error with the raw source visible in Preview, not crash the renderer. |
| IDEA-MATH-1.5 | Math and footnotes must round-trip through save/load without loss (FR-2.7), documented in Section 8 extension list. |
| IDEA-MATH-1.6 | Export to HTML and PDF must include rendered math (KaTeX CSS/fonts embedded or linked); DOCX export may use OMML conversion or fall back to PNG for complex expressions. |
| IDEA-MATH-1.7 | Input rules: typing `[^` or `$` should offer sensible completion or literal escape when not intended as math/footnote. |

## Non-functional considerations

- KaTeX bundle size impact on app packaging; lazy-load math renderer.
- Security: never execute arbitrary LaTeX packages; KaTeX safe subset only.

## Open questions

- Support `$` inside code spans without math parsing (requires context-aware lexer)?
- Numbered footnotes vs named IDs — support both?

## Out of scope

- BibTeX citation management and reference manager integration (Zotero).
