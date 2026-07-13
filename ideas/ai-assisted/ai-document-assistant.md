# AI Document Assistant

**Status:** Promoted → `functional-requirements.md` Section 18 (FR-14.x)  
**Category:** AI-assisted writing  
**Related:** [ai-inline-autocomplete](./ai-inline-autocomplete.md), [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md), [local-version-history](../versioning/local-version-history.md), [git-aware-status](../versioning/git-aware-status.md), [snippets-and-templates](../writing-polish/snippets-and-templates.md)

## Overview

A **document assistant** — a Cursor-style side panel — lets users have a multi-turn conversation about the active document: ask questions, request summaries, and ask for edits. The assistant has tools to **read** and **write** the document. Writes support two modes:

- **Suggestion** — changes appear as track-changes-style proposals the user can accept or reject individually or in bulk.
- **Auto** — changes apply directly to the document (undoable as one or more edit steps).

The assistant lives in a **right-hand panel** that can be shown, hidden, and resized — mirroring the left sidebar (outline / file tree) behaviour. Conversation history persists per document (and optionally per workspace) so users can return to prior threads.

This is the **umbrella AI integration** for MarkDoc. Inline autocomplete (see related idea) is a complementary feature that shares the same AI settings, provider, and model configuration described here. Document-level and **selection-level** tasks — summarise, rewrite, expand, fix grammar, change tone, TL;DR, commit message suggestions, inserting a summary into frontmatter — are handled via **conversation prompts** in the assistant rather than separate commands or preview sheets.

**AI is off by default.** The user must explicitly enable AI and supply a **Vercel AI Gateway** API key before any AI feature — including this assistant — becomes available.

## User stories

- As a writer, I want to ask questions about my document (“What’s the main argument in section 3?”) without leaving the editor.
- As an editor, I want the assistant to propose rewrites as suggestions I can review before they land in my file.
- As a power user, I want an auto-apply mode when I trust the assistant to make straightforward edits quickly.
- As a privacy-conscious user, I want AI disabled until I opt in and add my own gateway key.
- As a cost-aware user, I want to see which models are expensive before I select one.
- As a returning user, I want my assistant conversation history for a document preserved across sessions.
- As a reader, I want to summarise a long document or add a TL;DR at the top via a prompt — not a separate feature.
- As an editor, I want to shorten a verbose paragraph while keeping meaning — by asking the assistant about my selection.
- As a student, I want a bullet summary of selected notes via the assistant.
- As a user, I want to preview AI edits before they replace my text (Suggestion mode).

## Activation and settings

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-0.1 | **AI master toggle** in Preferences: off by default. When off, no AI UI (assistant panel, inline autocomplete) is shown and no network requests are made to AI providers. |
| IDEA-AIAS-0.2 | When AI is enabled, user must provide a **Vercel AI Gateway API key** (stored in macOS Keychain / secure credential store, never in plain-text preferences on disk). |
| IDEA-AIAS-0.3 | Preferences exposes a **model catalogue** sourced from Vercel AI Gateway (`GET /v1/models` or AI SDK `getAvailableModels`). User selects which models appear in the in-app model picker. |
| IDEA-AIAS-0.4 | Ship a **default enabled set of 8 models** — a curated mix of flagship, reasoning, and fast/cheap options. User can add or remove models from the catalogue at any time. |
| IDEA-AIAS-0.5 | User picks a **default model** for the assistant (and optionally a separate default for inline autocomplete). |
| IDEA-AIAS-0.6 | First-time enable flow: disclosure of what content is sent to the gateway, link to Vercel AI Gateway pricing, and confirmation before the first request. |

### Default model set (v1)

Curated at ship time; IDs refreshed when gateway catalogue changes. Intended mix: **2 flagship**, **2 reasoning**, **4 fast/cheap**.

| Model ID (example) | Role | Cost tier |
|--------------------|------|-----------|
| `anthropic/claude-opus-4.6` | Flagship quality | $$$ |
| `openai/gpt-5` | Flagship quality | $$$ |
| `openai/o3` | Deep reasoning | $$$ |
| `google/gemini-2.5-pro` | Reasoning / long context | $$ |
| `anthropic/claude-sonnet-4.5` | Balanced daily driver | $$ |
| `anthropic/claude-haiku-4.5` | Fast, low cost | $ |
| `openai/gpt-4o-mini` | Fast, low cost | $ |
| `google/gemini-2.5-flash` | Fast, low cost | $ |

> **Note:** Exact model IDs and tiers should be validated against the live gateway catalogue at implementation time. Relative cost tiers ($ / $$ / $$$) are derived from input + output pricing per token, normalised across the user’s enabled set.

## Assistant panel (UI)

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-1.1 | **Assistant panel** docks on the **right** side of the document window, adjacent to the editor/preview area. |
| IDEA-AIAS-1.2 | Panel is **collapsible** and **resizable** with the same interaction model as the left sidebar (drag handle, min/max width, persisted per window in window state restoration). |
| IDEA-AIAS-1.3 | Menu item and keyboard shortcut: **View → Assistant** (or toggle alongside sidebar). |
| IDEA-AIAS-1.4 | Panel shows: conversation thread, composer input, model selector, edit-mode toggle (Suggestion / Auto), and a clear “AI active” indicator when enabled. |
| IDEA-AIAS-1.5 | **Streaming responses** — assistant text streams into the thread; tool activity (e.g. “Reading document…”, “Proposing edit…”) shown as lightweight status lines. |
| IDEA-AIAS-1.6 | When AI is disabled or no key is configured, panel shows an empty state with a link to Preferences — not a broken chat UI. |
| IDEA-AIAS-1.7 | **New / empty conversation state** shows contextual **suggested prompts** (tap to send). For the full document: “Summarise this document”, “Add a one-paragraph summary at the top”, “What are the main points?”, “Suggest improvements”. With [git-aware-status](../versioning/git-aware-status.md): optional “Suggest a commit message for my changes”. |
| IDEA-AIAS-1.8 | Suggested prompts adapt lightly to context (e.g. long doc → emphasise summarise; empty doc → “Help me outline this document”; **text selected** → “Summarise selection”, “Rewrite”, “Expand”, “Fix grammar”, “Make more formal/concise”). User can dismiss suggestions; they reappear on new conversation. |
| IDEA-AIAS-1.9 | **Context menu** with text selected: **Ask Assistant** opens (or focuses) the assistant panel with selection attached as context; composer may pre-fill a sensible prompt. Optional keyboard shortcut for the same action. |

## Conversation and history

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-2.1 | Multi-turn **conversation** scoped to the active document by default. |
| IDEA-AIAS-2.2 | **History persisted locally** (Application Support, not committed to git). Keyed by document path (and content hash or session id for unsaved docs). |
| IDEA-AIAS-2.3 | User can start a **new conversation** (clears thread for current doc; prior thread archived or discarded per preference). |
| IDEA-AIAS-2.4 | Optional: show last N messages in context; older messages summarised or omitted with a “context truncated” notice when token limits apply. |
| IDEA-AIAS-2.5 | User can delete conversation history per document or clear all AI history from Preferences. |

## Assistant tools

The assistant runs as an **agent** with tool use (Vercel AI SDK). Tools are invoked server-side in the Electron main process or a dedicated worker — API key never exposed to renderer.

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-3.1 | **`read_document`** — returns full markdown (or a range: headings, line range, section by heading id) for the active document. Respects current unsaved buffer, not only on-disk file. |
| IDEA-AIAS-3.2 | **`read_selection`** — returns currently selected text and surrounding context (paragraph or configurable window). |
| IDEA-AIAS-3.3 | **`read_outline`** — returns document outline (headings hierarchy) for navigation and section-scoped questions. |
| IDEA-AIAS-3.4 | **`search_document`** — find text or regex matches within the active document (supports “where did I mention X?”). |
| IDEA-AIAS-3.5 | **`propose_edit`** — applies a change in **Suggestion** mode (see below). Parameters: target range or section, replacement markdown, optional rationale. |
| IDEA-AIAS-3.6 | **`apply_edit`** — applies a change in **Auto** mode. Same parameters as `propose_edit`; honours global edit-mode default unless user overrides per message. |
| IDEA-AIAS-3.7 | Tool calls are **visible in the thread** (collapsible): tool name, brief summary, and link to affected document region where applicable. |
| IDEA-AIAS-3.8 | Assistant must not call write tools when the document is **read-only** or during an active collaborative lock (future); read tools still allowed. |

## Selection-based editing

Selection workflows (summarise, rewrite, expand, fix grammar, change tone) are **not** separate menu commands or preview sheets — they flow through the assistant using `read_selection` and write tools.

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-3.9 | When the user asks to change selected text, assistant uses **`read_selection`** first, then **`propose_edit`** (Suggestion) or **`apply_edit`** (Auto) scoped to the selection range. |
| IDEA-AIAS-3.10 | **Suggestion mode** is the default review path for selection edits — equivalent to the old “preview before replace”; user accepts or rejects in the editor, not a separate sheet. |
| IDEA-AIAS-3.11 | Edits preserve **Markdown structure** where possible (headings, lists not flattened to plain text without warning in the thread). |
| IDEA-AIAS-3.12 | User **custom prompts** for common selection tasks may be saved as snippets (extends [snippets-and-templates](../writing-polish/snippets-and-templates.md)) and invoked from the assistant composer or suggested prompts. |
| IDEA-AIAS-3.13 | Optional **debug log** of AI requests (local only, clearable from Preferences). |

## Edit modes: Suggestion vs Auto

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-4.1 | **Suggestion mode (default):** writes produce **track-changes-style** proposals in the editor — insertions and deletions visually distinct from committed text (e.g. green/red or underline/strikethrough). |
| IDEA-AIAS-4.2 | Each suggestion is **independently actionable**: Accept, Reject, or Accept all / Reject all for a batch from the assistant or editor gutter. |
| IDEA-AIAS-4.3 | Accepting a suggestion merges it into the document; rejecting removes the proposal with no document change. |
| IDEA-AIAS-4.4 | **Auto mode:** writes apply immediately to the document buffer with **markdown-aware merge** (preserve structure where possible; warn in thread if structure would be lost). |
| IDEA-AIAS-4.5 | Auto edits are **undoable** via standard Undo (one logical edit per tool call, or batched per user preference). |
| IDEA-AIAS-4.6 | Switching from Auto to Suggestion does not retroactively convert applied edits; only affects subsequent tool calls. |
| IDEA-AIAS-4.7 | Status bar or panel shows count of **pending suggestions** when any exist. |

## Model selector and cost indicator

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-5.1 | In-panel **model selector** lists only models the user enabled in Preferences. |
| IDEA-AIAS-5.2 | Each model shows a **lightweight cost indicator** — relative tier ($ / $$ / $$$) derived from gateway pricing (input + output per 1M tokens). Optional tooltip with approximate $/1M input and output. |
| IDEA-AIAS-5.3 | Models tagged in gateway metadata (e.g. `reasoning`, `vision`) may show subtle badges where relevant; vision models noted if image tools are added later. |
| IDEA-AIAS-5.4 | If a selected model is removed from the user’s enabled set or disappears from the catalogue, fall back to the configured default with a one-time notice. |

## Error handling

| ID | Requirement |
|----|-------------|
| IDEA-AIAS-6.1 | **Insufficient credit / quota exceeded** — detect gateway errors (e.g. 402, 403 with billing message, “insufficient credits”). Show a clear, non-technical message in the thread with a link to Vercel AI Gateway billing / add credits. Do not retry automatically. |
| IDEA-AIAS-6.2 | **Invalid or missing API key** — prompt user to update key in Preferences; no content sent until fixed. |
| IDEA-AIAS-6.3 | **Rate limited (429)** — show “rate limited” message with optional retry after backoff; do not spin indefinitely. |
| IDEA-AIAS-6.4 | **Network / timeout** — user-visible error; partial streamed content preserved where possible; user can retry the last message. |
| IDEA-AIAS-6.5 | **Model unavailable** — suggest choosing another enabled model; log technical detail locally (optional debug log; see IDEA-AIAS-3.13). |
| IDEA-AIAS-6.6 | Errors must never leave the document in a half-applied suggestion state without explicit user action — failed `apply_edit` rolls back; failed `propose_edit` does not leave orphan decorations. |

## Relationship to other AI features

| Feature | Relationship |
|---------|----------------|
| [ai-inline-autocomplete](./ai-inline-autocomplete.md) | Shares AI toggle, gateway key, and model prefs. Independent UI; can use a cheaper default model. |
| Document summaries, TL;DR, frontmatter `summary:` | In-assistant via prompts and write tools. Empty-state suggestions surface common summary workflows. |
| Selection summarise / rewrite / tone | In-assistant via `read_selection` + write tools; Suggestion mode replaces a standalone preview sheet. Context menu **Ask Assistant** when text is selected. |

## Non-functional considerations

- **Streaming:** Responses stream into the thread; long selection rewrites stream before `propose_edit` is applied.
- **Security:** API key in Keychain; requests from main process only; no document content in logs unless optional debug mode enabled (IDEA-AIAS-3.13).
- **Performance:** Debounce rapid messages; cancel in-flight generation on new send or document close; virtualise long conversation threads.
- **Token limits:** For long documents, use outline + section reads and summarised context rather than sending full file every turn.
- **Offline:** Assistant disabled when gateway unreachable; clear offline state in UI.
- **Accessibility:** Panel keyboard-navigable; VoiceOver labels for suggestions accept/reject; streaming updates announced without overwhelming chatter.

## Open questions

- Per-workspace vs per-document conversation threads when multiple files are open in tabs?
- Export conversation as markdown note in the vault?
- Slash commands in composer (`/fix grammar`, `/summarise`, `/shorter`, `/rewrite`)?
- Diff view between original and a pending suggestion in the editor?
- Per-language tone rules for rewrite prompts?
- Should Suggestion mode use the same diff engine as [local-version-history](../versioning/local-version-history.md)?
- Pin assistant open across document switches or reset thread when file changes?
- Team / shared gateway key vs per-user key (v1: single user key only)?

## Out of scope

- Multi-file agent that edits the whole vault without explicit user scope per file (v1 assistant is **active document** scoped; folder search is a future extension).
- Standalone selection actions (Summarise, Rewrite, etc.) with a separate preview sheet — use assistant + Suggestion mode instead.
- Training on user documents by MarkDoc or storing content on Vercel beyond gateway request handling.
- Built-in payment / credit top-up inside MarkDoc (user manages credits on Vercel).
- Local model providers (Ollama, etc.) in v1 — gateway only; BYOK via Vercel documented as the path for provider keys.

## Privacy

- AI off by default; no requests until user enables AI and provides a key.
- Disclosure before first use: document excerpts and conversation are sent to Vercel AI Gateway and routed to the selected model provider per Vercel’s terms.
- Conversation history stored **locally only** unless user explicitly exports.
- Align with privacy rules in [ai-inline-autocomplete](./ai-inline-autocomplete.md): status indicator when AI active, clear disable path, optional local-only debug log.
