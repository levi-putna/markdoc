# Word Count and Reading Stats

**Status:** Partial — FR-2.8 requires a word/character/reading-time indicator; this doc expands the idea  
**Category:** Writing polish  
**Related:** FR-2.8, Section 14 (Preferences)

## Overview

Writers expect live document statistics: word count, character count (with and without spaces), paragraph count, and estimated reading time. Selection-aware stats are equally important for excerpts, abstracts, and blog post limits.

## User stories

- As a writer, I want to see total word count and reading time while I edit.
- As a blogger, I want selection stats so I know how long an excerpt is.
- As a user, I want to choose which metrics appear in the status bar.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-STATS-1.1 | MarkDoc must display **document word count** live in a status bar or footer region. |
| IDEA-STATS-1.2 | MarkDoc must display **estimated reading time** based on a configurable words-per-minute rate (default 200 WPM). |
| IDEA-STATS-1.3 | When text is selected, the status area must show **selection word count** and character count alongside (or instead of) document totals — clearly labelled. |
| IDEA-STATS-1.4 | Optional metrics the user can enable: character count (with/without spaces), paragraph count, sentence count. |
| IDEA-STATS-1.5 | Word count must update on edit with debouncing suitable for large documents (consistent with FR-2.12 tiers). |
| IDEA-STATS-1.6 | Word count rules must be documented: footnotes, code blocks, and frontmatter handling (exclude YAML frontmatter from body count by default). |
| IDEA-STATS-1.7 | A **Word Count…** menu command must open a detail panel or sheet with full breakdown and copy-to-clipboard. |

## Non-functional considerations

- Counting must run off the main thread or be incremental for documents in Large Document Mode.
- Reading time and counts must match between WYSIWYG and raw source mode for the same underlying Markdown.

## Open questions

- Include or exclude text inside Mermaid/code blocks in word count?
- Show stats in exported PDF metadata?

## Existing coverage

FR-2.8 already requires word count / character count / reading-time indicator. Promote remaining IDEA-STATS items into main requirements when implementing the full stats UX.
