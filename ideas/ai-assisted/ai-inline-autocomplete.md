# AI Inline Autocomplete

**Status:** Promoted → `functional-requirements.md` Section 18.7 (FR-14.41–FR-14.46)  
**Category:** AI-assisted writing  
**Related:** Section 16 (Out of Scope — no cloud dependency for v1 core), [ai-document-assistant](./ai-document-assistant.md)

## Overview

**Inline autocomplete** (ghost text) suggests the next few words or sentences as the user types — similar to GitHub Copilot for prose. This is increasingly expected in writing tools but requires careful privacy, opt-in, and offline options.

## User stories

- As a writer, I want optional continue-writing suggestions I can accept with Tab.
- As a privacy-conscious user, I want to use a local model or bring my own API key.
- As a user, I want AI disabled by default with clear data handling disclosure.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-AIA-1.1 | MarkDoc may offer **inline autocomplete** as an **opt-in** feature (default off). |
| IDEA-AIA-1.2 | Suggestions appear as ghost text after cursor; **Tab** accepts, **Esc** dismisses. |
| IDEA-AIA-1.3 | Provider options: user API key (OpenAI-compatible, Anthropic, etc.), local model (Ollama/LM Studio), or disabled. |
| IDEA-AIA-1.4 | Context sent to provider: configurable window (current paragraph, section, or full document) with max token limit disclosed in Preferences. |
| IDEA-AIA-1.5 | Never send content without explicit enable per workspace or globally; status indicator when AI active. |
| IDEA-AIA-1.6 | Autocomplete disabled in code blocks by default. |
| IDEA-AIA-1.7 | Accepting suggestion is undoable as one step. |

## Non-functional considerations

- Debounce requests; cancel in-flight on continued typing.
- Offline: graceful disable when provider unreachable.

## Open questions

- On-device Apple Intelligence API when available?
- Rate limiting and cost estimation UI?

## Out of scope

- Full document generation without user prompt.
- Training on user documents by MarkDoc (vendor).

## Privacy

Requires standalone privacy policy section and Preferences disclosure before first use.
