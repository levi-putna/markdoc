# Smart Typography

**Status:** Idea — partial overlap with FR-2.11 (macOS text substitutions)  
**Category:** Writing polish  
**Related:** FR-2.11, Section 14 (Preferences)

## Overview

Smart typography goes beyond macOS system substitutions: Markdown-aware transforms like turning `--` into em-dashes outside code spans, `...` into ellipses, straight quotes to curly quotes, and automatic list continuation. Typora, iA Writer, and Ulysses users expect these polish features.

## User stories

- As a writer, I want `--` to become an em-dash when typing prose, but not inside code.
- As an author, I want smart quotes without breaking Markdown link syntax.
- As a user, I want to disable individual smart typography rules in Preferences.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-TYPE-1.1 | MarkDoc must offer optional **smart punctuation** transforms on space/Enter: `--` → em-dash, `...` → ellipsis, straight quotes → curly quotes — **disabled inside code spans, code blocks, and URLs**. |
| IDEA-TYPE-1.2 | Smart typography must coexist with FR-2.11 macOS substitutions; MarkDoc-specific rules take precedence inside the editor when enabled. |
| IDEA-TYPE-1.3 | Each rule must be individually toggleable in Preferences (em-dash, ellipsis, smart quotes). |
| IDEA-TYPE-1.4 | **List continuation**: pressing Enter in a list continues numbering/bullets (partially covered by FR-2.5; extend to task lists and nested lists). |
| IDEA-TYPE-1.5 | **Hard break vs soft break**: Shift+Enter inserts line break without new paragraph; behaviour documented and consistent in WYSIWYG and source. |
| IDEA-TYPE-1.6 | Transforms must be **undoable** as a single keystroke undo step. |
| IDEA-TYPE-1.7 | On paste, optional "smart paste" normalises straight quotes in plain text without breaking pasted Markdown structure. |

## Non-functional considerations

- Must not corrupt Markdown link/image syntax `[text](url)` or autolinks during quote conversion.
- Performance: transforms run synchronously on input; no perceptible lag.

## Open questions

- Support `<<` / `>>` guillemets for French typography?
- Per-document override via frontmatter?

## Existing coverage

FR-2.11 covers macOS spellcheck and standard text substitutions. This doc covers Markdown-aware extensions.
