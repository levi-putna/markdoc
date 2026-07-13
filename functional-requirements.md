# MarkDoc — Functional Requirements

## 1. Overview

MarkDoc is a macOS desktop application for authoring, previewing, and exporting Markdown documents. It is a local-first editor — no accounts, no sync services, no cloud dependency — built with **Electron** and packaged as a native macOS app bundle so it still integrates with Finder, the Dock, native menus, and the Terminal like any other Mac app, even though its UI is implemented with web technologies.

This document describes the **functional requirements** (what the app must do). See [`technical-requirements.md`](./technical-requirements.md) for the architecture, technology stack, data formats, and detailed non-functional/technical specifications that implement these requirements; [`design-guide.md`](./design-guide.md) for the visual/interaction design language (typography, colour, layout, native chrome, and how to achieve it in Tiptap) that these requirements should look like in practice; and [`testing-requirements.md`](./testing-requirements.md) for how the app will be verified against them. **AI-assisted writing** (opt-in, Vercel AI Gateway) is specified in Section 18.

---

## 2. Platform

| ID | Requirement |
|----|-------------|
| FR-1.1 | MarkDoc must be built with Electron and packaged into a signed, notarized native macOS `.app` bundle (e.g. via electron-builder or Electron Forge), providing a Dock icon, native application menu bar, and standard window chrome. |
| FR-1.2 | The Tiptap/ProseMirror-based editing surface (Section 3) runs directly inside the Electron renderer process as standard web content — no separate embedded WebView or native/web bridge is required, since the entire UI shares Electron's Chromium runtime. |
| FR-1.3 | MarkDoc must support the current and previous two macOS major releases at time of launch. |
| FR-1.4 | MarkDoc must ship as a universal build supporting both Apple Silicon (arm64) and Intel (x64) Macs, per Electron's multi-arch packaging support. |
| FR-1.5 | MarkDoc must support standard window management: multiple windows, native macOS window tabs (via Electron's `tabbingIdentifier`), full screen, and Split View. |
| FR-1.6 | MarkDoc must respect system-wide Light/Dark mode (via Electron's `nativeTheme` API) and update its UI — including the editor and preview themes — automatically when the system appearance changes. |
| FR-1.7 | MarkDoc must use a native-style unified title bar/toolbar (inset window controls, no separate web-styled header bar) that houses the app's primary chrome: the sidebar visibility toggle, the Edit/Preview/Split view toggle, and document search — styled and positioned to match native macOS toolbar conventions (e.g. segmented controls, toolbar icon buttons) rather than looking like an embedded web page. |
| FR-1.8 | When MarkDoc launches with nothing to open (no CLI/Finder argument, no restorable session per FR-5.9), it must immediately open a single blank untitled document — no separate Welcome/Recent-Files screen for v1. This matches the no-argument CLI behavior in FR-6.5. |

---

## 3. Editing (Tiptap-Based WYSIWYG Markdown Editor)

MarkDoc's editing surface is built on [Tiptap](https://tiptap.dev/) (ProseMirror), running as part of the same Electron renderer/web UI as the rest of the app. Rather than showing raw Markdown syntax with highlighting, the editor renders formatting visually as it is applied — headings look like headings, bold text looks bold, lists show real bullets/numbers, tables render as a grid — while the document the user is editing, and the file saved to disk, remains standard Markdown text at all times.

| ID | Requirement |
|----|-------------|
| FR-2.1 | The editor must be implemented using Tiptap with a Markdown serialization layer (e.g. `tiptap-markdown` or an equivalent bidirectional converter), so the in-memory document model round-trips losslessly to and from plain Markdown text on load/save. |
| FR-2.2 | The editor must visually render Markdown formatting as it is typed or applied — e.g. `# Heading` displays as a styled heading, `**bold**` displays as bold text, list markers render as real bullets/numbers, blockquotes render indented with a rule — without requiring the user to see raw syntax characters to understand the formatting. |
| FR-2.2a | Syntax characters are hidden by default, and revealed (in a muted secondary colour) only on the line(s) containing the current cursor/selection — Typora's behaviour, not a fully-hidden-always approach — per `design-guide.md` Section 10. This resolves the visibility question previously left open in Section 17. |
| FR-2.3 | Typing recognized Markdown shorthand (e.g. `## `, `- `, `1. `, `> `, `` ``` ``) must trigger live "input rules" that convert the shorthand into the corresponding rich node, matching familiar WYSIWYG-Markdown behavior (as in Notion, Bear, Typora). |
| FR-2.4 | The editor must support standard text editing conventions: undo/redo, cut/copy/paste (including pasting Markdown or rich text from other apps and converting it to MarkDoc's model), find & replace, and select all. |
| FR-2.5 | The editor must support common list authoring affordances: auto-continuation of ordered/unordered/task lists on Enter, smart indent/outdent (Tab/Shift-Tab), and exiting a list via double-Enter or Backspace at an empty item. |
| FR-2.6 | The editor must support keyboard shortcuts and a formatting toolbar/bubble menu for common actions (bold, italic, strikethrough, inline code, links, heading level, blockquote, lists, code block, tables). |
| FR-2.7 | On save, the editor's document model must serialize back to clean Markdown consistent with the elements defined in Section 8 (GFM), without introducing extraneous HTML or lossy conversions, so files remain portable and readable in any other Markdown tool. |
| FR-2.8 | The editor must support a word count / character count / reading-time indicator. |
| FR-2.9 | The editor must support adjustable font family, font size, and line spacing for the editing surface, persisted as a user preference. |
| FR-2.10 | The app should offer an optional "View Source" mode that displays the raw Markdown text for the current document (read-only or editable) for power users, distinct from the default WYSIWYG editing mode. |
| FR-2.11 | The editor must support native macOS spellcheck (red squiggly underline, right-click suggestions) and standard macOS text substitutions (smart quotes, dashes, auto-correction) via Chromium's built-in spellchecker and the system dictionary, matching the behavior users expect from any native Mac text-editing surface. This can be toggled off in Preferences (Section 14). |
| FR-2.12 | MarkDoc must handle very large Markdown documents without freezing, crashing, or becoming unusable. Concretely: full-fidelity live behavior (diagram auto-render, syntax-reveal, live outline/search) for documents up to 10,000 words / ~2MB; beyond that, an automatic "Large Document Mode" trades some live-feature freshness for typing responsiveness, with a visible (non-blocking) indicator so the user understands why; documents beyond ~100,000 words / 20MB must still open, edit, and save successfully, without a commitment to feel as snappy as smaller documents. See `technical-requirements.md` Section 13 for the concrete size tiers and rendering strategy. |

---

## 4. Preview

The Preview is distinct from the WYSIWYG editor described in Section 3: it is a **read-only, final-form rendering** of the document with no editing affordances and no Markdown syntax visible anywhere — just the fully typeset content (headings, formatted text, lists, tables, images, diagrams), matching how the document would look when exported.

| ID | Requirement |
|----|-------------|
| FR-3.1 | The app must provide a fully rendered, read-only preview of the current document, generated from the same underlying Markdown as the editor, with all Markdown syntax markers (`#`, `**`, `` ` ``, etc.) and all editing UI (cursors, toolbars, node handles) absent — only final content is shown. |
| FR-3.2 | The user must be able to toggle between at least: Edit only (WYSIWYG), Markdown only (raw source, FR-2.10), Preview only, and Side-by-side (split), via a native-style segmented control in the app's header/toolbar (FR-1.7), in addition to a View menu item and keyboard shortcut. |
| FR-3.3 | Side-by-side view pairs the raw Markdown source (not the WYSIWYG editor) with the Preview, and must support synchronized scrolling between the two. |
| FR-3.4 | Preview updates must occur live as the user edits, with debouncing to avoid performance degradation on large documents. |
| FR-3.5 | The preview must respect the document's applied style overrides (see Section 10) and, in their absence, a sensible default theme. |

---

## 5. Document Structure Tree (Outline)

| ID | Requirement |
|----|-------------|
| FR-4.1 | The app must provide a left-hand sidebar panel showing a hierarchical outline of the current document, derived from the heading nodes in the editor's document model (equivalent to Markdown headings `#` through `######`). |
| FR-4.2 | Each outline node must be clickable, scrolling/jumping the WYSIWYG editor (and preview, if visible) to the corresponding heading. |
| FR-4.3 | The outline tree must update live as headings are added, removed, edited, or reordered in the document. |
| FR-4.4 | Outline nodes must be individually collapsible/expandable, and the sidebar must support "Expand All" / "Collapse All" actions. |
| FR-4.5 | The current editor cursor position must be reflected in the outline (e.g. the nearest enclosing heading is highlighted), keeping the tree in sync with scroll position. |
| FR-4.6 | The sidebar must be resizable and collapsible/hideable in its entirety, toggled via a dedicated sidebar button in the app's header/toolbar (FR-1.7) — matching the sidebar-toggle convention used by Mail, Notes, and Xcode — as well as a View menu item and keyboard shortcut. |
| FR-4.7 | Outline nodes must be draggable to reorder and reposition (re-nest) them within the tree, using pointer drag or keyboard. Dragging a heading moves that heading **and its entire section** — all content nested beneath it, down to the next heading of the same or shallower level — to the new position in the underlying Markdown document, so the tree and the document's actual structure always match exactly. |
| FR-4.8 | When a dragged heading is dropped at a different nesting depth than it started at, its heading level (and the relative levels of any headings nested within its moved section) is automatically adjusted to match the new depth, so the document's heading hierarchy stays valid (e.g. an `H2` dropped as a child of an `H3` becomes `H4`; its own child headings shift by the same amount). The user drives this via the same indent/outdent drag gesture used by comparable outliner apps (Notion, Linear, Workflowy), not a separate control. |
| FR-4.9 | Outline drag-and-drop reordering must be a single undoable/redoable step via the standard Undo command (FR-2.4), and must be fully operable via keyboard alone (not pointer-only), consistent with accessible tree-reordering conventions. |
| FR-4.10 | Invalid drop targets — dropping a heading into its own descendant section, or nesting deeper than heading level 6 (Markdown's maximum) — must be visually prevented during the drag itself, not allowed and rejected afterwards. |

Document search (a related but distinct navigation feature — full-text/heading quick-jump rather than a heading-only tree) is covered separately in Section 13.

---

## 6. File Management & Finder Integration

| ID | Requirement |
|----|-------------|
| FR-5.1 | The app must register itself as a handler for common Markdown file extensions (`.md`, `.markdown`, `.mdown`, `.mkd`) via the packaging tool's file-association config (e.g. electron-builder's `fileAssociations`), which generates the underlying `Info.plist`/`UTType` declarations. |
| FR-5.2 | The user must be able to right-click a Markdown file in Finder and select "Open With → MarkDoc," and optionally set MarkDoc as the default application for these file types. |
| FR-5.3 | Double-clicking a registered Markdown file in Finder must open it in MarkDoc, handled via Electron's `open-file` app event. |
| FR-5.4 | The app must support standard File menu operations: New, Open…, Open Recent, Save, Save As…, Duplicate, Rename, Move To…, Revert to Saved, and Close. |
| FR-5.5 | MarkDoc uses **traditional explicit Save**, not macOS Auto Save/versioning. This fits the target workflow better: `.md` files are commonly shared with git, synced by third-party tools, or edited by other apps, so an explicit, predictable save point (with an unsaved-changes indicator, FR-5.6) is more appropriate than silent continuous auto-save/versioning. |
| FR-5.6 | The app must track and display unsaved-changes state (e.g. dot in the close button/window title, per macOS convention), and prompt to save on close/quit if there are unsaved changes. |
| FR-5.7 | The app must support drag-and-drop of a Markdown file from Finder onto the app icon or an open window to open it. |
| FR-5.8 | The app must support opening multiple documents concurrently, each in its own window or tab. |
| FR-5.9 | The app must support relaunch/state restoration, reopening previously open documents/windows after an app or system restart (standard macOS resume behavior). |
| FR-5.10 | If the file backing an open document changes on disk outside MarkDoc (edited by another app, `git checkout`, sync tool, etc.), MarkDoc must detect this and always prompt the user — offering to reload the on-disk version (discarding in-app unsaved changes) or keep editing the in-app version (and overwrite the external change on next save) — rather than silently picking one side. |
| FR-5.11 | MarkDoc must maintain a periodic crash-recovery snapshot of unsaved changes (independent of the explicit-save file itself, per FR-5.5) so that unsaved work survives an app crash or forced quit, offered back to the user the next time that document is opened. |

---

## 7. Command Line Interface

In addition to Finder-based opening, MarkDoc must be operable from the Terminal, similar to the `code`, `subl`, or `mate` command-line helpers shipped by VS Code, Sublime Text, and TextMate.

**Chosen approach:** the CLI helper is a thin, fast-launching binary/script (not a custom URL scheme). It resolves the given path(s) and hands them to the app process. The Electron main process owns a single-instance lock (`app.requestSingleInstanceLock`) and a `second-instance` handler; if MarkDoc is already running, the CLI's launch attempt is detected by the existing instance, which receives the forwarded `argv`, opens the requested file(s) in-process, and focuses itself — the CLI-triggered process then exits immediately rather than becoming a second GUI instance. If MarkDoc is not running, the CLI launches it normally with the file path(s) as startup arguments.

| ID | Requirement |
|----|-------------|
| FR-6.1 | MarkDoc must provide a command-line helper executable (e.g. `markdoc`) that can be invoked from Terminal (zsh/bash) to open one or more Markdown files, e.g. `markdoc notes.md`. |
| FR-6.2 | The CLI helper must be installable onto the user's `$PATH` (e.g. `/opt/homebrew/bin` or `/usr/local/bin`), either via an in-app "Install Command Line Tool" action (with the user's consent, similar to VS Code's "Shell Command: Install 'code' command in PATH") or a documented manual install step. |
| FR-6.3 | Running `markdoc <path>` must open the specified file in MarkDoc, resolving relative paths against the shell's current working directory. |
| FR-6.4 | Running `markdoc <path1> <path2> …` must open multiple files, each in its own window or tab (consistent with FR-5.8). |
| FR-6.5 | Running `markdoc` with no arguments must activate the app — bringing it to the foreground if already running, or opening a new untitled document if not. |
| FR-6.6 | MarkDoc's main process must hold a single-instance lock at all times it is running. When the CLI helper launches the app binary with file arguments while an instance is already running, the existing instance must receive those arguments via the `second-instance` event, open the requested file(s) in-process, and bring itself to the foreground; the newly spawned process must then exit immediately rather than presenting a duplicate GUI. |
| FR-6.7 | The CLI must exit with a non-zero status and print a clear error message if a given path does not exist or does not have a supported Markdown extension (FR-5.1). |
| FR-6.8 | The CLI should support a `--new-window` flag to force a file to open in a new window even if it is already open elsewhere. |
| FR-6.9 | The CLI's behavior (opening a file, activating the app) must be functionally equivalent to double-clicking the file in Finder or using "Open With → MarkDoc" (FR-5.2/FR-5.3) — just accessible from the terminal, and should launch quickly enough (sub-second hand-off when an instance is already running) to feel like a native CLI tool rather than a full app relaunch. |

---

## 8. Markdown Format Support

The editor and preview must support the CommonMark spec plus the following GitHub-Flavored-Markdown (GFM) and common extensions:

| ID | Requirement |
|----|-------------|
| FR-7.1 | Headings (levels 1–6). |
| FR-7.2 | Paragraphs, line breaks, and horizontal rules. |
| FR-7.3 | Emphasis: bold, italic, bold+italic, strikethrough. |
| FR-7.4 | Ordered lists, unordered lists, nested lists, and GFM task lists (`- [ ]` / `- [x]`) with interactive checkboxes in preview. |
| FR-7.5 | Blockquotes, including nested blockquotes. |
| FR-7.6 | Inline code spans and fenced code blocks with language-aware syntax highlighting in the preview (e.g. via a highlighting library covering common languages). |
| FR-7.7 | Tables (GFM table syntax), including column alignment. |
| FR-7.8 | Links (inline, reference-style, and autolinks) and images (inline Markdown image syntax). |
| FR-7.9 | Footnotes. |
| FR-7.10 | Definition lists. |
| FR-7.11 | HTML passthrough for common inline/block HTML embedded in Markdown, rendered safely in preview. |
| FR-7.12 | Front matter (YAML) at the top of the document, parsed and made available to the app (e.g. for title, tags, custom metadata) without breaking rendering. |

---

## 9. Diagrams & Charts

| ID | Requirement |
|----|-------------|
| FR-8.1 | The preview must render Mermaid diagrams from fenced code blocks tagged `mermaid` (flowcharts, sequence diagrams, class diagrams, state diagrams, Gantt charts, and ER diagrams at minimum). |
| FR-8.2 | In the WYSIWYG editor, a Mermaid/code block must be represented as a distinct, clearly delineated node showing the raw code in monospace (directly editable), with an inline rendered diagram preview shown alongside or beneath it so the user can see the result without switching to Preview mode. |
| FR-8.3 | Mermaid rendering errors (invalid syntax) must be surfaced inline — in both the editor's live diagram preview and the Preview pane — without crashing or blanking the rest of the document. |
| FR-8.4 | The app should support chart rendering (e.g. via a Mermaid-compatible or complementary charting syntax) for basic chart types such as pie, bar, and line charts, embedded the same way as other fenced code blocks. |
| FR-8.5 | Diagrams must be included when exporting to PDF/Word (rendered as static images at export time). |

---

## 10. Per-Document Style Overrides (Optional/Advanced)

| ID | Requirement |
|----|-------------|
| FR-9.1 | The app must ship with a default base stylesheet controlling preview/export appearance (typography, spacing, colors, code block theme, table styling). |
| FR-9.2 | The user must be able to optionally define style overrides scoped to an individual document, without affecting other documents. |
| FR-9.3 | Overridable style properties must include, at minimum: font family/size/color for body text and for each heading level; image sizing/alignment defaults; code block theme; table borders/striping; and block quote styling. |
| FR-9.4 | Style overrides must be stored in a way that travels with the document (e.g. a sidecar config file or a project-style bundle) so the document renders consistently if opened on another machine with MarkDoc installed. |
| FR-9.5 | The user must be able to reset a document's style overrides back to the base/default style. |
| FR-9.6 | Style overrides must apply consistently across Preview and Export (PDF/Word) output. |

---

## 11. Image Management

| ID | Requirement |
|----|-------------|
| FR-10.1 | The user must be able to insert images into a document via drag-and-drop, paste from clipboard, or an "Insert Image…" file picker, with the image rendered inline in the WYSIWYG editor immediately (not as raw `![]()` syntax). |
| FR-10.2 | When an image is inserted, MarkDoc must store a copy of the image file alongside the Markdown document (e.g. in a co-located `assets/` or `<document-name>-images/` folder) rather than requiring the user to manage paths manually. |
| FR-10.3 | Inserted images must be serialized in the saved Markdown source using a relative path to the stored copy, so the document remains portable (e.g. moving/copying the `.md` file and its asset folder together keeps images working) and renders correctly in other Markdown tools, not just MarkDoc. |
| FR-10.4 | The app must detect and warn about broken/missing image references (e.g. path no longer resolves) when opening or previewing a document. |
| FR-10.5 | The app should provide basic image handling controls at insertion/edit time: display size (width), and alt text. |
| FR-10.6 | Moving, renaming, or duplicating a Markdown document via MarkDoc's file operations (Section 6) should offer to move/copy its associated asset folder along with it, keeping references intact. |

---

## 12. Export

| ID | Requirement |
|----|-------------|
| FR-11.1 | The user must be able to export the current document to PDF, honoring the document's active style (base or overridden) and rendering diagrams/images/tables as they appear in Preview. |
| FR-11.2 | The user must be able to export the current document to Word (`.docx`) format, with headings, formatting, tables, and images converted to native Word equivalents where possible. |
| FR-11.3 | Export must be available via File menu ("Export To…"), keyboard shortcut, and should support choosing a destination and file name via a standard macOS save panel. |
| FR-11.4 | Export must support pagination-appropriate output for PDF (e.g. page size selection such as A4/US Letter, margins). PDF export can leverage Electron's built-in `printToPDF` capability or a dedicated rendering pipeline. |
| FR-11.5 | Mermaid diagrams and charts must be rasterized/vectorized into the exported PDF/Word file, since target formats do not execute JavaScript. |
| FR-11.6 | Export failures (e.g. unsupported construct) must produce a clear error/warning rather than a silently corrupted file. |
| FR-11.7 | The user must be able to export the current document as standalone HTML (self-contained, with styles inlined or embedded so it renders correctly outside MarkDoc), reusing the same styled rendering pipeline as PDF/Preview at negligible extra implementation cost. |

---

## 13. Document Search & Navigation

In addition to the heading-based outline tree (Section 5), MarkDoc must provide a fast, native-feeling way to search the current document and jump straight to a matching location — similar to VS Code's "Go to Symbol" or Bear/Notion's quick-search overlay. This is distinct from in-editor Find & Replace (FR-2.4), which operates on exact text occurrences for editing purposes rather than navigation.

| ID | Requirement |
|----|-------------|
| FR-12.1 | The app must provide a document search entry point in the header/toolbar (FR-1.7) — a search field or icon that opens one — plus a global keyboard shortcut, to quickly locate and jump to a section or passage of the current document. |
| FR-12.2 | As the user types a query, the app must show a live-filtered list of matches, with heading/section-title matches ranked above matches found only in body text. |
| FR-12.3 | Search results must be navigable via the keyboard (arrow keys to move between results, Enter to jump to the selected one) as well as by mouse click. |
| FR-12.4 | Selecting a result must scroll/jump the WYSIWYG editor (and preview, if visible) to that location, consistent with the outline's jump behavior (FR-4.2). |
| FR-12.5 | The matched query text must be visually highlighted within the results list, and, where feasible, briefly highlighted at the destination once jumped to. |
| FR-12.6 | The search overlay must be dismissible via Escape or by clicking outside it, returning focus to the editor at its previous cursor position if no result was selected. |
| FR-12.7 | For v1, search is scoped to the current document only — no cross-document or multi-window search — consistent with MarkDoc being a per-document editor rather than a project-wide tool. |

---

## 14. Preferences & Settings

Several requirements above imply user-configurable settings but don't specify where they live. MarkDoc must provide a standard macOS Preferences window (⌘,) consolidating them, rather than leaving them scattered or undiscoverable.

| ID | Requirement |
|----|-------------|
| FR-13.1 | A Preferences window must expose: editor font family/size/line-spacing (FR-2.9), spellcheck on/off (FR-2.11), appearance override (system-follow vs. force light/dark, in addition to the automatic behavior in FR-1.6), sidebar row density (`design-guide.md` Section 8), CLI helper install/uninstall (FR-6.2), and **AI settings** (FR-14.1–FR-14.3): master AI toggle, Vercel AI Gateway API key management, enabled-model catalogue, default models for the assistant and inline autocomplete, optional AI debug log, and clear-all conversation history. |
| FR-13.2 | Preferences are global (app-wide), stored per `technical-requirements.md` TR-4.4 — distinct from per-document style overrides (Section 10), which remain scoped to an individual document via its sidecar file. |
| FR-13.3 | Preference changes must apply immediately to all open documents/windows without requiring an app restart. |
| FR-13.4 | The Preferences window itself follows standard macOS conventions (a single window, opened via the app menu and ⌘,, closed via ⌘W/Esc) rather than being a custom in-content settings panel. |

---

## 15. Non-Functional Considerations (summary)

These are product-level expectations; see `technical-requirements.md` (Sections 12–14) for concrete targets, tooling, and implementation approach:

- **Performance:** Editing and live preview should remain responsive for large documents and complex diagrams, despite Electron's inherent overhead versus a fully native app — see FR-2.12 for the concrete size tiers and degradation behavior, and `technical-requirements.md` Section 13 for the rendering strategy behind them.
- **Data safety:** No data loss on crash; autosave/recovery of unsaved changes; Markdown round-trip (edit → save → reopen) must be lossless.
- **Accessibility:** VoiceOver support, Dynamic Type-friendly UI where feasible, full keyboard navigability.
- **Localization:** English at launch; architecture should not preclude future localization.
- **Privacy:** Fully local/offline for core editing; no telemetry or document content leaves the device unless the user explicitly exports/shares it. **Opt-in AI features** (Section 18) send document excerpts and conversation to [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) only after the user enables AI and provides their own API key.
- **Distribution & signing:** Code-signed and notarized so the app launches without Gatekeeper warnings when distributed outside the Mac App Store.

---

## 16. Out of Scope (v1)

To keep the initial release focused, the following are explicitly **not** required for v1 unless revisited:

- Real-time multi-user collaboration.
- Cloud sync (iCloud Drive support as "just a file on disk" is fine; a bespoke sync service is not required).
- Plugin/extension system for third parties.
- Mobile (iOS/iPadOS) companion app.
- Mac App Store distribution (v1 assumes direct, notarized distribution outside the App Store — see Open Questions for why this matters given the CLI helper).
- Finder Quick Look (spacebar preview) integration — deferred: it requires a small native macOS extension bundle alongside the Electron app, which is disproportionate native-packaging complexity for a v1 feature. Revisit post-v1.
- Services menu / Share sheet integration.
- Welcome/Recent-Files launch screen (FR-1.8 resolves this to "open a blank document immediately" for v1).
- **Local model providers** (Ollama, LM Studio, etc.) for AI — v1 uses Vercel AI Gateway only (Section 18); BYOK via Vercel is the supported path for provider keys.
- Built-in AI credit top-up or billing inside MarkDoc — users manage credits on Vercel.
- Multi-file AI agent that edits an entire vault without explicit per-document scope.

---

## 18. AI-Assisted Writing

MarkDoc provides **opt-in** AI features powered by the [Vercel AI SDK](https://sdk.vercel.ai/) and [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). **AI is off by default.** No AI UI is shown and no network requests are made to AI providers until the user explicitly enables AI and supplies a Vercel AI Gateway API key.

Promoted from [`ideas/ai-assisted/ai-document-assistant.md`](./ideas/ai-assisted/ai-document-assistant.md) and [`ideas/ai-assisted/ai-inline-autocomplete.md`](./ideas/ai-assisted/ai-inline-autocomplete.md).

### 18.1 Activation, privacy & settings

| ID | Requirement |
|----|-------------|
| FR-14.1 | **AI master toggle** in Preferences: **off by default**. When off, the assistant panel, inline autocomplete, and all AI network requests are disabled. |
| FR-14.2 | When AI is enabled, the user must provide a **Vercel AI Gateway API key**, stored in the macOS Keychain (or equivalent secure credential store) — never in plain-text preferences on disk. |
| FR-14.3 | Before the first AI request, MarkDoc must show a disclosure explaining what content is sent to the gateway, with a link to Vercel AI Gateway pricing, and require explicit confirmation. |
| FR-14.4 | Preferences must expose a **model catalogue** sourced from the gateway (`GET /v1/models` or AI SDK model discovery). The user selects which models appear in in-app model pickers. |
| FR-14.5 | MarkDoc must ship a **default enabled set of 8 models** — a curated mix of flagship, reasoning, and fast/cheap options — which the user can add to or remove from at any time. |
| FR-14.6 | The user must be able to set a **default model** for the document assistant and (optionally) a separate default for inline autocomplete. |
| FR-14.7 | Model pickers must show a **lightweight cost indicator** ($ / $$ / $$$) derived from gateway pricing, with an optional tooltip showing approximate input/output cost per 1M tokens. |
| FR-14.8 | An optional **local-only AI debug log** (clearable from Preferences) may record request metadata and errors; it must never be transmitted off-device automatically. |

### 18.2 Document assistant (side panel)

The **document assistant** is a Cursor-style conversational panel for asking questions about, and requesting edits to, the active document. The assistant UI is built with [AI Elements](https://elements.ai-sdk.dev/) components, integrated with `@ai-sdk/react`.

| ID | Requirement |
|----|-------------|
| FR-14.9 | The assistant panel docks on the **right** side of the document window, **collapsible** and **resizable** with the same interaction model as the left outline sidebar (drag handle, min/max width, persisted per window). |
| FR-14.10 | The user must be able to show/hide the assistant via **View → Assistant**, a toolbar control, and a keyboard shortcut. |
| FR-14.11 | The panel must use AI Elements **[`Conversation`](https://elements.ai-sdk.dev/components/conversation)** (thread, auto-scroll, scroll-to-bottom button) and **[`PromptInput`](https://elements.ai-sdk.dev/components/prompt-input)** (composer, submit, model selector in footer). |
| FR-14.12 | When the user queues prompts while a response is in progress, pending items must be shown with AI Elements **[`Queue`](https://elements.ai-sdk.dev/components/queue)** — collapsible sections listing queued, in-progress, and completed prompt items. |
| FR-14.13 | Tool-call activity and loading/streaming states must use AI Elements **[`Shimmer`](https://elements.ai-sdk.dev/components/shimmer)** (or equivalent AI Elements loading primitives) so in-flight work is visually distinct from completed messages. |
| FR-14.14 | The panel must show: conversation thread, composer, model selector (enabled models only), **edit-mode toggle** (Suggestion / Auto), and a clear indicator when AI is active. |
| FR-14.15 | When AI is disabled or no gateway key is configured, the panel must show an empty state with a link to Preferences — not a broken chat UI. |
| FR-14.16 | **New / empty conversation** must show contextual **suggested prompts** (tap to send), adapting to document state: full-document prompts ("Summarise this document", "Add a one-paragraph summary at the top", "What are the main points?", "Suggest improvements"), selection-based prompts when text is selected ("Summarise selection", "Rewrite", "Expand", "Fix grammar", "Make more formal/concise"), and empty-document prompts ("Help me outline this document"). |
| FR-14.17 | With text selected, a context-menu action **Ask Assistant** must open or focus the assistant panel with the selection attached as context. |

### 18.3 Conversation & document-scoped history

| ID | Requirement |
|----|-------------|
| FR-14.18 | Assistant conversations are **scoped to the active document only**. Switching to a different document loads that document's conversation history; there is no shared cross-document thread in v1. |
| FR-14.19 | Conversation history must be **persisted locally** in Application Support (not committed to git), keyed by the document's file path (and a session identifier for unsaved untitled documents). |
| FR-14.20 | The user must be able to start a **new conversation** for the current document (clearing the visible thread) and delete conversation history per document or clear all AI history from Preferences. |
| FR-14.21 | Assistant responses must **stream** into the conversation thread. Tool activity (e.g. "Reading document…", "Proposing edit…") must be visible as collapsible status in the thread. |
| FR-14.22 | When context exceeds model token limits, older messages may be truncated or summarised with a visible notice in the thread. |

### 18.4 Assistant agent, tools & heading references

The assistant runs as an **agent** with tool use via the Vercel AI SDK. Tool execution and gateway requests happen in the Electron **main process** (or a dedicated worker) — the API key must never be exposed to the renderer.

| ID | Requirement |
|----|-------------|
| FR-14.23 | The assistant must support read tools: **`read_document`** (full markdown or section/range), **`read_selection`** (current selection + context), **`read_outline`** (heading hierarchy), and **`search_document`** (text/regex find within the document). Reads must reflect the **current unsaved buffer**, not only the on-disk file. |
| FR-14.24 | The assistant must support write tools: **`propose_edit`** (Suggestion mode) and **`apply_edit`** (Auto mode), each accepting a target range or section, replacement markdown, and optional rationale. |
| FR-14.25 | Write tools must not run when the document is read-only. |
| FR-14.26 | Tool calls must be **visible in the conversation thread** (collapsible): tool name, brief summary, and a navigable link to the affected document region where applicable. |
| FR-14.27 | The assistant and its messages may include **heading reference tokens** (e.g. a stable `heading://` URI or slug derived from the document index) that render as inline links in the conversation. **Clicking a heading reference must scroll/jump the editor** (and preview, if visible) to that heading — the same behaviour as clicking an outline node (FR-4.2). |
| FR-14.28 | Document-level and selection-level tasks (summarise, rewrite, expand, fix grammar, change tone, TL;DR, frontmatter summary) are handled **via assistant prompts and write tools**, not separate menu commands or preview sheets. |

### 18.5 Edit modes: Suggestion vs Auto (Cursor-style changes)

Inspired by Cursor's review-before-apply workflow: the assistant can propose document changes either as **reviewable suggestions** or **immediate edits**.

| ID | Requirement |
|----|-------------|
| FR-14.29 | **Suggestion mode (default):** write tools produce **track-changes-style** proposals in the editor — insertions and deletions visually distinct from committed text (e.g. green/red highlight, underline/strikethrough). The user reviews in the document, not in a separate preview sheet. |
| FR-14.30 | Each suggestion must be **independently actionable**: Accept, Reject, Accept all, or Reject all — from the assistant thread, editor gutter, or a dedicated suggestions bar. |
| FR-14.31 | Accepting a suggestion merges it into the document; rejecting removes the proposal with no document change. |
| FR-14.32 | **Auto mode:** write tools apply changes immediately to the document buffer with markdown-aware merge (preserve headings, lists, and structure where possible; warn in the thread if structure would be lost). |
| FR-14.33 | Auto edits must be **undoable** via standard Undo (one logical undo step per tool call, unless batched by user preference). |
| FR-14.34 | The UI must show a count of **pending suggestions** when any exist (status bar and/or assistant panel). |
| FR-14.35 | Failed write tools must not leave orphan suggestion decorations or half-applied edits — failures roll back cleanly. |

### 18.6 Error handling

| ID | Requirement |
|----|-------------|
| FR-14.36 | **Insufficient credit / quota exceeded** — detect gateway billing errors (e.g. 402, 403 with credit message). Show a clear, non-technical message in the thread with a link to Vercel AI Gateway billing. Do not retry automatically. |
| FR-14.37 | **Invalid or missing API key** — prompt the user to update the key in Preferences; send no content until fixed. |
| FR-14.38 | **Rate limited (429)** — show a rate-limited message with optional retry after backoff. |
| FR-14.39 | **Network / timeout** — user-visible error; preserve partial streamed content where possible; allow retry of the last message. |
| FR-14.40 | **Model unavailable** — suggest choosing another enabled model; log technical detail to the optional debug log (FR-14.8). |

### 18.7 Inline autocomplete

| ID | Requirement |
|----|-------------|
| FR-14.41 | With AI enabled (FR-14.1), MarkDoc may offer **inline autocomplete** as ghost text after the cursor, suggesting the next few words or sentences as the user types. |
| FR-14.42 | **Tab** accepts the suggestion; **Esc** dismisses it. Accepting is undoable as one step. |
| FR-14.43 | Autocomplete uses the same Vercel AI Gateway stack and API key as the assistant (FR-14.2); context window (paragraph, section, or document) and max tokens are configurable in Preferences and disclosed to the user. |
| FR-14.44 | Autocomplete must be **disabled in code blocks** by default. |
| FR-14.45 | Requests must be debounced; in-flight suggestions must be cancelled when the user continues typing. Autocomplete must degrade gracefully when the gateway is unreachable. |
| FR-14.46 | A status indicator must show when AI (including autocomplete) is active for the current document/window. |


- Should style overrides be a single sidecar file per document, or a shared "style palette" the user can define once and apply to many documents?
- Should the asset/image folder naming and location be user-configurable, or fixed by convention?
- Which Mermaid/chart syntax variants should be supported beyond core Mermaid (e.g. is a separate charting library needed, or does Mermaid's own chart types suffice)?
- Should exported Word documents be editable/round-trippable back into Markdown, or one-way export only?
- Given Tiptap's table/list/code-block extensions vary in Markdown round-trip fidelity, should MarkDoc restrict itself to a curated extension set to guarantee lossless save/reload, even if that means dropping support for some edge-case GFM constructs (Section 8)?
- Should MarkDoc target Mac App Store distribution at some point? The App Store's App Sandbox restricts writing outside the app's container, which would conflict with installing the CLI helper to `/usr/local/bin` (FR-6.2) and may complicate direct filesystem access for the asset-folder model (Section 11) — this is easier to resolve for direct/notarized distribution, which v1 assumes.
- The CLI helper's exact packaging (a plain shell script that calls `open -a MarkDoc --args ...` / invokes the packaged binary directly, vs. a small standalone launcher executable) is an implementation detail to settle during build tooling setup — the functional contract is fixed by FR-6.1–FR-6.9 (single-instance hand-off via `second-instance`, not a URL scheme).
- Should document search (Section 13) include fuzzy/full-text matching across body content by default in v1, or start heading/section-title-only (matching the outline tree's scope) with full-text search as a fast-follow?
- How should undo/redo behave across the WYSIWYG editor and "View Source" mode (FR-2.10) — one shared undo stack, or two independent ones that could desync? Needs a decision before `TR-8.5` is implemented.
- What happens if the user (or the CLI/Finder) tries to open a file that's already open in another MarkDoc window — focus the existing window, or allow a second window on the same file (risking two editors racing to save)?
- Should MarkDoc warn or auto-downscale on inserting a very large image (Section 11), given images are copied into the document's asset folder (FR-10.2) and large files bloat both the folder and in-app performance?
- Full keyboard operability (beyond the VoiceOver-specific testing in `testing-requirements.md` QR-5.2) — should this be a formally tracked accessibility commitment given Tiptap/ProseMirror's contenteditable-based accessibility challenges (`design-guide.md` Section 13)?
- How should MarkDoc handle non-UTF-8-encoded or BOM-prefixed `.md` files on open, rather than assuming UTF-8 throughout?
- Should the assistant support slash commands in the composer (`/summarise`, `/rewrite`) in v1 or via suggested prompts only?
- Exact default model IDs for FR-14.5 — validate against the live gateway catalogue at implementation time.
