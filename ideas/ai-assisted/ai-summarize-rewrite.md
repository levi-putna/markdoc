# AI Summarise and Rewrite

**Status:** Idea  
**Category:** AI-assisted writing  
**Related:** [ai-inline-autocomplete](./ai-inline-autocomplete.md)

## Overview

Users select text and ask AI to **summarise**, **rewrite**, **expand**, or **change tone** — common in Notion AI, Word Copilot, and iA Writer 3. Implemented as contextual menu actions with preview-before-replace.

## User stories

- As an editor, I want to shorten a verbose paragraph while keeping meaning.
- As a student, I want a bullet summary of selected notes.
- As a user, I want to preview AI output before it replaces my text.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-AIR-1.1 | With AI enabled (see [ai-inline-autocomplete](./ai-inline-autocomplete.md)), MarkDoc must offer selection actions: **Summarise**, **Rewrite**, **Expand**, **Fix grammar**, **Change tone** (formal/casual/concise). |
| IDEA-AIR-1.2 | AI output shown in **preview sheet** with Insert, Replace selection, or Cancel. |
| IDEA-AIR-1.3 | Replace preserves Markdown structure where possible (headings, lists not flattened to plain text without warning). |
| IDEA-AIR-1.4 | Keyboard shortcut for last-used AI action (optional). |
| IDEA-AIR-1.5 | Custom user prompts saved as snippets (extends [snippets-and-templates](../writing-polish/snippets-and-templates.md)). |
| IDEA-AIR-1.6 | Log of AI requests optional for debugging (local only, clearable). |

## Non-functional considerations

- Timeout and retry with user-visible error.
- Streaming response into preview for long outputs.

## Open questions

- Diff view between original and AI suggestion?
- Per-language tone rules?

## Out of scope

- AI chat sidebar for whole-document Q&A (separate feature).

## Privacy

Same opt-in and provider rules as inline autocomplete.
