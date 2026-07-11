# MarkDoc — Technical Requirements

## 1. Overview & Relationship to Functional Requirements

This document describes **how** MarkDoc will be built to satisfy [`functional-requirements.md`](./functional-requirements.md) (the **what**). Each technical requirement below is tagged `TR-<section>.<item>`; where relevant it references the functional requirement(s) it implements. See [`design-guide.md`](./design-guide.md) for the visual/interaction design language these technical choices need to render correctly (Section 12 of that guide maps design intent directly onto Tiptap implementation techniques referenced throughout this document). Testing strategy and concrete test cases live in [`testing-requirements.md`](./testing-requirements.md).

MarkDoc is an Electron desktop application (confirmed architectural decision — see `functional-requirements.md` Section 2), packaged as a macOS `.app` bundle, using web technologies (TypeScript, React, Tiptap) for its UI while relying on native OS integration for windowing, Finder, and the file system.

---

## 2. Application Architecture

| ID | Requirement |
|----|-------------|
| TR-1.1 | MarkDoc follows Electron's standard multi-process architecture: one **main process** (Node.js, owns app lifecycle, windows, menus, file I/O, single-instance handling) and one **renderer process per window** (Chromium, owns UI/editor/preview), communicating exclusively via IPC. |
| TR-1.2 | Each renderer must load with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Renderers must never have direct access to Node.js APIs or the filesystem — all privileged operations (file read/write, dialogs, export) go through a **preload script** exposing a narrow, typed API via `contextBridge.exposeInMainWorld`. |
| TR-1.3 | The preload-exposed API (working name `window.markdoc`) must cover: `openFile()`, `saveFile()`, `saveFileAs()`, `readAsset()`/`writeAsset()`, `exportPdf()`, `exportDocx()`, `getRecentFiles()`, `onFileOpenRequested()` (for Finder/CLI-triggered opens), and preference get/set. No other Node/Electron API surface is exposed to renderer code. |
| TR-1.4 | Each open document (Section 6 of the functional spec) maps to one `BrowserWindow` (or one native macOS tab sharing a `tabbingIdentifier`), each with its own renderer process, so a crash or hang in one document's editor cannot take down other open documents. |
| TR-1.5 | The main process owns a single `AppState` responsible for: the list of open windows/documents, the single-instance lock, and dispatching CLI/Finder open requests to the correct window (new or existing). |
| TR-1.6 | The main window uses `titleBarStyle: 'hiddenInset'` (native inset traffic-light controls, no OS-drawn title bar text area) with a custom, React-rendered toolbar region implementing FR-1.7 — the sidebar toggle, Edit/Preview/Split segmented control, and search entry point. This toolbar region must be marked draggable (`-webkit-app-region: drag`), with interactive controls inside it explicitly marked non-draggable (`-webkit-app-region: no-drag`), so it behaves like a native macOS toolbar rather than a fixed web header. |
| TR-1.7 | A dedicated Preferences window (a separate, non-resizable `BrowserWindow`, opened via the app menu and ⌘,) exposes the settings enumerated in FR-13.1, reading/writing the app-preferences store (TR-4.4). Preference changes are broadcast to all open document windows via IPC so they apply immediately (FR-13.3) without requiring a restart. |

---

## 3. Technology Stack

| ID | Requirement |
|----|-------------|
| TR-2.1 | **Runtime:** Electron (latest stable major at time of development), Node.js LTS as bundled by Electron. Language: TypeScript across main, renderer, and preload code — no untyped JS in new code. |
| TR-2.2 | **UI framework:** React, for both the app shell (menus, sidebar, toolbars) and the editor host, since Tiptap ships official React bindings (`@tiptap/react`). |
| TR-2.3 | **Editor:** Tiptap (`@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`) plus extensions for tables, task lists, links, images, code blocks, and a custom Mermaid/diagram node (Section 9). Markdown round-trip via `tiptap-markdown` (or an equivalent bidirectional Markdown ⇄ ProseMirror converter) per FR-2.1/FR-2.7. |
| TR-2.4 | **Front matter parsing:** `gray-matter` used to split YAML front matter from document body before handing the body to Tiptap, and to re-attach front matter unchanged on save (FR-7.12). |
| TR-2.5 | **Syntax highlighting:** `lowlight`/`highlight.js` via `@tiptap/extension-code-block-lowlight` for in-editor code block highlighting; the same highlighting theme/library is reused by the Preview renderer so editor and preview never diverge visually. |
| TR-2.6 | **Diagrams:** `mermaid` (npm package), rendered client-side to SVG within a sandboxed context (Section 10). |
| TR-2.7 | **Build tooling:** `electron-vite` (Vite-based) for fast dev builds and HMR of the renderer, with TypeScript project references for main/preload/renderer. Packaging via `electron-builder`. |
| TR-2.8 | **Package manager:** Yarn (per project convention). All install/build/package scripts documented in `package.json` must be run with `yarn`, never `npm`. |
| TR-2.9 | **Linting/formatting:** ESLint + Prettier, configured for TypeScript and React, run in CI and as a pre-commit/pre-push check. |
| TR-2.10 | **State management:** Lightweight, React-context or a small store (e.g. Zustand) scoped per-window for editor/UI state; no global cross-window client-side store is required since each document is an isolated renderer. |
| TR-2.11 | **Styling:** Tailwind CSS is the primary styling framework for the app's chrome (toolbar, sidebar, dialogs, menus) and for authoring the base document theme's utility classes. Tailwind's theme tokens (colors, font sizes, spacing) are defined in terms of CSS custom properties (see TR-11.5) rather than hard-coded values, so the same tokens drive both Tailwind-authored UI and the runtime-overridable per-document style engine. |
| TR-2.12 | **Document search:** A lightweight in-memory search/indexing library (e.g. `minisearch` or `fuse.js`) powers ranked, fuzzy matching for the Document Search feature (FR-12.x), operating on a flat index derived from the current document (Section 9, TR-8.6) — no external search service or heavyweight full-text engine is needed at this scale. |
| TR-2.13 | **Spellcheck:** Chromium's built-in spellchecker, enabled via `session.setSpellCheckerLanguages` and wired to the system dictionary/locale, plus native macOS text-substitution context-menu items (smart quotes, dashes, autocorrect suggestions) surfaced through `webContents.on('context-menu')` (FR-2.11). Toggled via the Preferences window (FR-13.1, TR-1.7). |
| TR-2.14 | **Drag-and-drop:** `@dnd-kit` (`@dnd-kit/react` and its sortable utilities) powers outline tree reordering (FR-4.7–FR-4.10, Section 9) — chosen over HTML5-drag-based alternatives for its pointer-events-first architecture, built-in keyboard sensor, and ARIA live-region support, which the outline tree's accessibility requirements (FR-4.9) need out of the box rather than hand-rolled. |

---

## 4. Project Structure & Build Tooling

| ID | Requirement |
|----|-------------|
| TR-3.1 | Repository is a single package (or a small Yarn workspaces monorepo) with clear separation: `src/main` (Electron main process), `src/preload` (bridge scripts), `src/renderer` (React app: editor, preview, sidebar, toolbars), `src/shared` (types/utilities shared across processes), `build/` (packaging resources: icons, entitlements), `cli/` (CLI helper script/binary). |
| TR-3.2 | `yarn dev` starts the app in development mode with HMR for the renderer and automatic main-process restart on change (developer convenience only — per project convention this is run by the user in their own terminal, not invoked by the agent). |
| TR-3.3 | `yarn build` produces a production bundle; `yarn package` (or `yarn dist`) invokes `electron-builder` to produce the signed, notarized, universal `.app`/`.dmg` (developer/CI convenience — likewise run by the user or CI, not routinely invoked by the agent). |
| TR-3.4 | CI (e.g. GitHub Actions on a macOS runner) must run lint, type-check, unit tests, and the automated portion of the test plan (`testing-requirements.md`) on every pull request before merge. |
| TR-3.5 | Tailwind configuration (`tailwind.config.ts`) and the base design-token stylesheet (CSS custom properties, TR-11.1) live in `src/renderer/styles/`, shared by the app-chrome components and the editor/preview content so both are always built from the same token source. |

---

## 5. Data Formats & File Storage

| ID | Requirement |
|----|-------------|
| TR-4.1 | The canonical, saved-to-disk format for a document is plain-text Markdown (CommonMark + GFM, per FR-7.x), optionally prefixed with YAML front matter. No proprietary binary or JSON format is used for the primary document — this guarantees portability outside MarkDoc. |
| TR-4.2 | Per-document style overrides (FR-9.x) are stored in a **sidecar file** co-located with the document: `<document-name>.md` → `<document-name>.markdoc-style.json`. This file is optional; its absence means the base theme applies. Schema versioned via a top-level `"version"` field to allow safe future migration. |
| TR-4.3 | Inserted images (FR-10.x) are stored in a co-located asset folder using the convention `<document-name>.assets/` (e.g. `notes.md` → `notes.assets/image-1.png`), referenced from the Markdown body via relative paths (e.g. `![alt](notes.assets/image-1.png)`). |
| TR-4.4 | Application-level preferences (font settings, pane layout, recent files list, CLI-install state) are stored outside any document, in `~/Library/Application Support/MarkDoc/config.json` (via `electron-store` or an equivalent typed wrapper around that location). |
| TR-4.5 | Window/session restoration state (FR-5.9) is persisted alongside app preferences, recording open file paths, window bounds, and active pane layout per window. |
| TR-4.6 | All file writes (document save, style sidecar save, asset copy) must be atomic (write to a temp file in the same directory, then rename) to avoid corrupting files if the app crashes or the system loses power mid-write. |
| TR-4.7 | MarkDoc uses **explicit Save** (FR-5.5, resolved decision), not macOS Auto Save. Crash recovery (FR-5.11) is implemented as a separate periodic snapshot of in-memory unsaved content, written to a per-document recovery file in `~/Library/Application Support/MarkDoc/Recovery/` (keyed by the document's file path, not overwriting the real `.md` file), checked for and offered back to the user on next open, and deleted on a clean save or clean window close. |
| TR-4.8 | Main process watches each open document's file path (e.g. via `chokidar` or Node's `fs.watch`) to detect external changes (FR-5.10). On a detected external change, the renderer is notified via IPC and must always show the reload/keep-editing prompt (FR-5.10) — no silent auto-reload, since a false-positive (e.g. from an atomic-write-induced rename/recreate from another tool) silently discarding local edits would be worse than an occasional unnecessary prompt. |

---

## 6. IPC & Security Boundaries

| ID | Requirement |
|----|-------------|
| TR-5.1 | All file-system access (reading/writing the Markdown file, the style sidecar, and asset files) happens exclusively in the main process, invoked by the renderer through the preload bridge (TR-1.3) via `ipcRenderer.invoke`/`ipcMain.handle` request-response channels — never `remote` or direct `fs` access from the renderer. |
| TR-5.2 | IPC channel names and payload shapes must be defined once in `src/shared` as TypeScript types, imported by both main and renderer/preload code, so channel contracts can't silently drift. |
| TR-5.3 | Native dialogs (Open, Save As, Export destination picker) use Electron's `dialog` module in the main process, triggered by renderer requests, never re-implemented in HTML/CSS. |
| TR-5.4 | Menu actions (File > Open, Export To…, etc.) are defined in the main process's `Menu` construction and dispatch IPC events to the focused renderer's window; menu enablement (e.g. graying out "Save" with no changes) is kept in sync via state pushed from the renderer to main. |

---

## 7. macOS Packaging & Integration

| ID | Requirement |
|----|-------------|
| TR-6.1 | File-type registration (FR-5.1) is declared via `electron-builder`'s `mac.fileAssociations` config for `.md`, `.markdown`, `.mdown`, `.mkd`, generating the corresponding `CFBundleDocumentTypes`/`UTType` entries in the packaged `Info.plist`. |
| TR-6.2 | Finder "Open With"/double-click (FR-5.2/FR-5.3) is handled in the main process via Electron's `app.on('open-file', ...)` (legacy single-file launch) and `second-instance`/`app.on('open-file')` combination for already-running instances, per the single-instance design in Section 8. |
| TR-6.3 | The app must request the **Hardened Runtime** and appropriate entitlements (`com.apple.security.cs.allow-jit` as required by Electron/V8, file access entitlements as needed) required for notarization, configured in `electron-builder`'s `mac.entitlements`/`entitlementsInherit` files. |
| TR-6.4 | Builds must be code-signed with a Developer ID Application certificate and notarized via `@electron/notarize` (wired into `electron-builder`'s `afterSign` hook) before distribution, so Gatekeeper does not block launch. |
| TR-6.5 | Universal binaries (arm64 + x64) are produced via `electron-builder --universal` (or building both archs and merging), verified to launch correctly on both architectures before release. |
| TR-6.6 | Auto-update (mentioned as a non-functional consideration in the functional spec) uses `electron-updater`; the specific update feed/hosting (GitHub Releases vs. a custom static host) is an open decision (Section 16). |

---

## 8. CLI Helper Implementation

Implements FR-6.1–FR-6.9, using the **single-instance/IPC hand-off** approach (not a custom URL scheme), per the confirmed decision in `functional-requirements.md` Section 7.

| ID | Requirement |
|----|-------------|
| TR-7.1 | The main process calls `app.requestSingleInstanceLock()` at startup. If the lock is not acquired (another instance already holds it), the current process calls `app.quit()` immediately after Electron auto-forwards its `argv`/`cwd` to the existing instance's `second-instance` listener. |
| TR-7.2 | The `second-instance` handler in the surviving instance parses the forwarded `argv` for file paths, resolves them against the forwarded working directory, opens each as a document (new window/tab per FR-5.8), and calls `.focus()`/`.show()` on the relevant window(s). |
| TR-7.3 | The `markdoc` CLI helper is a small executable (a POSIX shell script is sufficient for v1) installed onto `$PATH` that resolves argument paths to absolute paths and invokes the packaged app binary directly (`/Applications/MarkDoc.app/Contents/MacOS/MarkDoc <absolute-paths...>`), relying on TR-7.1/TR-7.2 for the single-instance hand-off — no separate daemon or socket protocol is implemented. |
| TR-7.4 | The CLI helper is installed via an in-app "Install Command Line Tool" action (main process writes/symlinks the script to `/opt/homebrew/bin` or `/usr/local/bin`, prompting for elevated permissions only if required by directory permissions) — mirroring VS Code's `code` command installer. Manual install instructions are documented as a fallback. |
| TR-7.5 | The CLI script validates argument file extensions client-side (matching FR-5.1's supported extensions) before invoking the app, to fail fast with a clear message (FR-6.7) without paying the cost of an app launch. |
| TR-7.6 | `--new-window` is passed through as a flag argument to the app binary and handled identically whether the app was already running (via `second-instance`) or cold-launched. |

---

## 9. Editor & Rendering Pipeline

| ID | Requirement |
|----|-------------|
| TR-8.1 | The editor's ProseMirror schema (via Tiptap extensions) must map 1:1 (or documented lossy subset) onto the GFM elements required by FR-7.1–FR-7.12. Any GFM construct without a clean round-trip mapping must be explicitly documented rather than silently dropped. |
| TR-8.2 | HTML passthrough (FR-7.11) must be sanitized before rendering in both the editor and Preview using an allow-list sanitizer (e.g. `rehype-sanitize` or `DOMPurify`) to strip `<script>`, inline event handlers, and other executable content — local files are trusted less than typical desktop-app assumptions because Markdown files are commonly shared/copied between machines. |
| TR-8.3 | The Preview pane renders from the same parsed document model as the editor (not a second independent Markdown parse), guaranteeing FR-3.1's requirement that Preview and editor never visually disagree about content, only about whether syntax/editing UI is shown. |
| TR-8.4 | Preview updates are debounced (target 150–300ms after the last keystroke, tunable) to satisfy FR-3.4 without harming input responsiveness in the editor. |
| TR-8.5 | The "View Source" mode (FR-2.10) renders the live-serialized Markdown string (same serializer used on save) in a read-only/editable plain-text view (e.g. CodeMirror or a plain `<textarea>` with syntax highlighting) — not a separate hand-maintained representation. |
| TR-8.6 | The Outline sidebar (FR-4.x) and Document Search (FR-12.x) are both derived from a single shared "document index" utility that walks the current ProseMirror document to produce a flat list of headings/sections with their positions. Search additionally feeds body-text nodes into the search library (TR-2.12) for fuzzy ranking. The index is rebuilt on the same debounce tick as Preview (TR-8.4) rather than on every keystroke, so typing quickly doesn't thrash indexing work. |
| TR-8.7 | The cursor-line syntax-reveal behaviour (FR-2.2a, `design-guide.md` Section 12) is implemented as a ProseMirror decoration plugin tracking the current selection's block position, not a static style — it applies a reveal class/decoration only to the active line, keeping the underlying DOM/Markdown output clean for Preview and export. |
| TR-8.8 | The document index utility (TR-8.6) is extended to compute each heading's **section range**: the document position span from the heading itself through the position immediately before the next heading of equal-or-shallower level (or end of document). This range is exactly what must move together when a heading is dragged in the outline (FR-4.7), and is recomputed on the same debounce tick as the rest of the index rather than as a separate pass. |
| TR-8.9 | Outline drag-and-drop (FR-4.7–FR-4.10) is implemented with `@dnd-kit` (`@dnd-kit/react` plus its sortable utilities, TR-2.14) using the standard flattened-list-with-depth pattern for nested-tree dragging — nested `SortableContext`s don't support moving an item across levels, so the tree is flattened to `{ id, depth, parentId }` for drag purposes, derived straight from the document index (TR-8.6/TR-8.8) rather than a separately-maintained tree state, so the drag UI can never drift out of sync with the document. |
| TR-8.10 | While dragging, the projected drop depth is computed from the dragged row's horizontal pointer offset relative to its vertical position among the rows it's passing over — the indent-while-dragging convention used by Notion/Linear and dnd-kit's own official sortable-tree example — clamped to a valid range (no shallower than heading level 1, no deeper than heading level 6). Drop targets that would nest a heading inside its own descendant section are excluded at the collision-detection level (not merely blocked after the fact), satisfying FR-4.10. |
| TR-8.11 | On drop, the move is committed as a single atomic ProseMirror transaction: the source section range (TR-8.8) is deleted and reinserted at the position implied by the new tree order, and if the projected depth (TR-8.10) differs from the dragged heading's original level, every heading within the moved range has its level shifted by the same delta so the moved section's internal hierarchy is preserved. Doing this as one transaction (rather than a delete step and an insert step) keeps it a single undo/redo entry, satisfying FR-4.9. |
| TR-8.12 | Keyboard-based reordering is implemented via `@dnd-kit`'s keyboard sensor (not drag-only), with ARIA live-region announcements of each move (e.g. "Moved 'Section Title' into 'Chapter 2', now heading level 3") — satisfying FR-4.9's keyboard-accessibility requirement and feeding the automated/manual accessibility testing in `testing-requirements.md` Section 2.5. |

---

## 10. Diagram & Chart Rendering

| ID | Requirement |
|----|-------------|
| TR-9.1 | A custom Tiptap node type (`mermaidBlock`) represents fenced ` ```mermaid ` blocks, storing the raw diagram source as node content/attrs and rendering an inline SVG preview via `mermaid.render()` on the renderer thread. |
| TR-9.2 | Mermaid is configured with `securityLevel: 'strict'` and no support for `click` interaction callbacks that execute arbitrary script, since diagram source ultimately comes from a file that could have been edited outside MarkDoc. |
| TR-9.3 | Mermaid parse/render errors are caught per-diagram (not globally) and rendered as an inline error placeholder showing the error message and the raw source, satisfying FR-8.3 without affecting the rest of the document. |
| TR-9.4 | Chart support beyond core Mermaid diagram types (FR-8.4) is deferred to a specific library decision (Section 16 — open question) but must, if added, follow the same "custom node + inline SVG/canvas render + graceful error fallback" pattern as Mermaid. |
| TR-9.5 | For export (Section 11), each diagram/chart node is rendered to a static SVG/PNG at export time via the same Mermaid render call used for the live preview, ensuring visual parity between in-app preview and exported output (FR-8.5). |

---

## 11. Export Pipeline

| ID | Requirement |
|----|-------------|
| TR-10.1 | **PDF export** (FR-11.1) uses a hidden/offscreen `BrowserWindow` loading the document's fully-styled Preview HTML (including resolved style overrides and rendered diagrams as inline SVG), then calls `webContents.printToPDF()` with page size/margin options mapped from the user's export dialog choices (FR-11.4). |
| TR-10.2 | **DOCX export** (FR-11.2) converts the document's parsed model (the same ProseMirror/remark AST used for editing/preview) directly into `docx` (docx.js) library constructs — `Paragraph`, `HeadingLevel`, `Table`, `ImageRun`, etc. — rather than a naive HTML-to-DOCX conversion, to preserve heading levels, list nesting, and table structure with higher fidelity. |
| TR-10.3 | Diagrams/charts are rasterized (PNG) or embedded as vector (SVG-in-PDF where supported) at export time per TR-9.5, since neither PDF nor DOCX can execute the Mermaid JS renderer. |
| TR-10.4 | Export must run without blocking the main editing UI — long exports (large documents, many diagrams) run via the offscreen window/async pipeline described above, with a progress indicator if export exceeds ~1 second. |
| TR-10.5 | Export failures (FR-11.6) must be caught per-stage (render, rasterize, write file) and surfaced to the user with the specific failing construct identified where possible (e.g. "Diagram on line 42 failed to render"). |
| TR-10.6 | **HTML export** (FR-11.7) serializes the same offscreen-rendered Preview HTML used for PDF export (TR-10.1) to a standalone file, inlining or embedding styles (and diagram SVGs) so the file renders correctly when opened directly in a browser, independent of MarkDoc. |

---

## 12. Style Override Engine

| ID | Requirement |
|----|-------------|
| TR-11.1 | The base theme is defined as a set of CSS custom properties (design tokens) covering typography, spacing, and color for each themeable element named in FR-9.3 (body text, each heading level, images, code blocks, tables, blockquotes). |
| TR-11.2 | A per-document style override (loaded from the sidecar file per TR-4.2) is applied as a scoped CSS custom-property override layer on top of the base theme — never a full stylesheet replacement — so overrides only need to specify the properties they actually change. |
| TR-11.3 | The same computed style (base + overrides) is used to render the editor's WYSIWYG surface, the Preview pane, and the PDF/DOCX export pipeline, guaranteeing FR-9.6's consistency requirement by construction rather than by keeping three implementations in sync manually. |
| TR-11.4 | A style-editing UI (scope: v1 simple form/inspector, not a full visual theme designer) writes directly to the sidecar JSON schema (TR-4.2); "Reset to default" (FR-9.5) deletes or empties the sidecar file. |
| TR-11.5 | Tailwind's config (`tailwind.config.js`) maps its theme tokens to the same CSS custom properties used by the base theme (TR-11.1) — following the pattern popularized by shadcn/ui, e.g. a `heading-1` color utility resolves to `var(--heading-1-color)`. This means Tailwind utility classes, the base theme, and per-document overrides all read from one set of custom properties instead of maintaining two parallel theming systems. |

---

## 13. Performance Requirements

### 13.1 Document Size Tiers

ProseMirror (and therefore Tiptap) does not support true virtualization of editor content the way a virtualized list does — the whole document must exist as real, editable DOM for cursor placement, selection, and contenteditable behavior to work, and the ProseMirror maintainers' own guidance for very large documents is to reduce rendering/decoration cost per node rather than expect virtualization. MarkDoc therefore targets **defined size tiers with graceful degradation**, rather than promising uniformly fast behavior at unlimited size:

| Tier | Size | Behavior |
|------|------|----------|
| **Standard** | Up to 10,000 words / ~2MB | Full fidelity: all live features (diagram auto-render, syntax-reveal decoration, live outline/search indexing, real-time preview) run at normal debounce intervals (TR-12.3/TR-12.4, unchanged from the original target). |
| **Large** | 10,000–100,000 words / 2–20MB | "Large Document Mode" (FR-2.12) activates automatically: rendering optimizations in Section 13.2 engage, debounce intervals for preview/outline/search widen (e.g. 500ms–1s instead of 150–300ms), and a subtle toolbar indicator informs the user. Typing latency remains the top priority; secondary conveniences (live diagram re-render, live search index freshness) are allowed to lag. |
| **Very Large** | 100,000+ words / 20MB+ | MarkDoc must still open, edit, and save the file without freezing or crashing, but is not optimized to feel as snappy as smaller tiers — this matches real-world reports of 200k-word Tiptap documents remaining editable but with slower search/decoration-heavy operations. If a user's workflow regularly involves documents at this tier, splitting into multiple linked files is the recommended approach (consistent with `functional-requirements.md` Section 16's Out of Scope on project-wide/multi-file features — noted as a real limitation, not solved by v1). |

### 13.2 Rendering Optimization Techniques (Standard → Large tier)

| ID | Requirement |
|----|-------------|
| TR-12.1 | Cold app launch (no instance running) to an interactive, visible window: target < 2 seconds on Apple Silicon reference hardware. |
| TR-12.2 | CLI-triggered open when an instance is already running (single-instance hand-off, TR-7.1/TR-7.2): target < 500ms from `markdoc <file>` invocation to the window being focused with content visible. |
| TR-12.3 | Editor keystroke-to-visual-update latency: target within a single animation frame (~16ms) for documents in the Standard tier; no perceptible input lag. |
| TR-12.4 | The editor and preview must remain responsive (no dropped frames beyond brief GC pauses) for documents up to the Standard tier ceiling (10,000 words / ~2MB), per FR-2.12 and the functional spec's Performance note. |
| TR-12.5 | Block-level content (paragraphs, headings, list items, code/diagram/table cards) uses CSS `content-visibility: auto` with an estimated `contain-intrinsic-size`, so the browser skips layout/paint work for off-screen content without needing custom virtualization — this preserves find-in-page, accessibility tree structure, and cursor/selection behavior (all of which a true virtualized-list approach would break for a contenteditable surface), while still giving most of the practical performance win. |
| TR-12.6 | Expensive per-node work that CSS alone can't defer — Mermaid SVG rendering (TR-9.1) and syntax-highlighting tokenization (TR-2.5) — is gated behind an `IntersectionObserver` inside each NodeView, so diagrams/code blocks outside the viewport don't pay their render cost until scrolled near. |
| TR-12.7 | React NodeViews (TR-9.1, TR-10.2) are kept minimal: heavy or frequently-updated inner content (e.g. syntax-highlighted code text) is rendered with plain DOM/`innerHTML` inside the NodeView rather than nested React trees where practical, per Tiptap's own performance guidance — React NodeViews are mounted synchronously and many of them is a known cost centre. |
| TR-12.8 | The editor React tree uses `useEditorState` (Tiptap ≥2.5) to scope re-renders to the specific state slice each component needs, and sets `shouldRerenderOnTransaction`/`immediatelyRender` deliberately rather than accepting defaults, so unrelated app-chrome state changes (opening the sidebar, moving the mouse over the toolbar) never trigger the whole editor to re-render. |
| TR-12.9 | Preview debounce (TR-8.4), outline/search indexing (TR-8.6), and the syntax-reveal decoration (TR-8.7) all widen their debounce/idle-scheduling interval automatically once Large Document Mode is active (Section 13.1), trading a little live-freshness for typing responsiveness — implemented as a single tier-aware scheduling config, not three separately-tuned thresholds that can drift out of sync. |
| TR-12.10 | Find & Replace (FR-2.4) and Document Search (FR-12.x) are the two features most likely to visibly slow down on Large/Very Large documents (matching real-world Tiptap reports of decoration-heavy search becoming sluggish at scale) — both must run their scan/match work incrementally or off the main thread (e.g. chunked processing yielding back to the event loop) rather than as one long synchronous pass, so the UI never fully locks up even if a search takes longer than usual to complete. |
| TR-12.11 | Loading and saving a document — parsing Markdown into the ProseMirror/Tiptap document model and serializing it back (TR-2.3/TR-8.1) — runs off the Electron main/renderer UI thread for files above the Standard tier (e.g. via a Node `worker_thread` for file I/O + parse, keeping only the final document JSON handoff on the renderer thread), so opening or saving a large file never freezes the window. |
| TR-12.12 | Idle memory usage for a single-document window should be monitored and kept reasonable for an Electron app; for Large/Very Large tier documents specifically, memory growth should be profiled during development against the benchmark corpus (`testing-requirements.md` QR-4.2) rather than assumed — Electron/Chromium's per-window overhead compounds with large-DOM documents in a way worth tracking explicitly (specific budget still to be set once a baseline is measured). |

### 13.3 Large Document Mode (User-Facing Behavior)

Implements FR-2.12. When a document crosses the Large tier threshold (Section 13.1), MarkDoc shows a small, dismissible toolbar indicator (styled per `design-guide.md` Section 6 status tokens) explaining that some live features are running at a reduced frequency for performance — not a blocking modal, and not silent. The mode is automatic (size-based), not a manual user toggle, since the whole point is that the user shouldn't need to think about it until it's relevant.

### 13.4 Known Scalability Limits (Accept, Don't Over-Engineer)

Being upfront about where this strategy stops, so effort isn't wasted chasing an unreachable goal:

- There is no plan to implement true DOM virtualization of the editor content (e.g. rendering only a viewport-sized slice of the ProseMirror document) — the ProseMirror community's own consensus is that this fundamentally conflicts with how a single contenteditable surface manages cursor/selection state, and the `content-visibility`-based approach (TR-12.5) captures most of the realistic benefit with far less risk and engineering cost.
- For documents that genuinely need book-length scale (100k+ words) as a *primary* workflow rather than an occasional edge case, the honest recommendation is splitting content across multiple linked Markdown files — a multi-file/project-level feature that is explicitly out of scope for v1 (`functional-requirements.md` Section 16) — rather than MarkDoc trying to be a book-authoring tool.

---

## 14. Security Requirements

| ID | Requirement |
|----|-------------|
| TR-13.1 | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every renderer (restates TR-1.2 as a hard security requirement, not just an architectural preference). |
| TR-13.2 | A Content-Security-Policy is set on every renderer restricting `script-src` to `'self'` (bundled app code only) — no remote script execution, consistent with the fully-offline/local-first requirement. |
| TR-13.3 | Raw HTML passthrough (FR-7.11) and pasted rich content are sanitized (TR-8.2) before insertion into the editor's DOM, preventing script injection from a maliciously crafted `.md` file someone might send the user. |
| TR-13.4 | Mermaid rendering runs with `securityLevel: 'strict'` (TR-9.2); no diagram-embedded script/click handlers are executed. |
| TR-13.5 | No remote content loading (`<img src="https://...">` is permitted to display, since that's normal Markdown, but no remote script/style/iframe loading is permitted) — network requests are limited to passive resource fetches the user's own content explicitly references. |
| TR-13.6 | No telemetry, crash reporting, or analytics SDKs that transmit data off-device are included by default, consistent with the Privacy requirement in the functional spec. |

---

## 15. Logging, Diagnostics & Updates

| ID | Requirement |
|----|-------------|
| TR-14.1 | Local file logging (e.g. via `electron-log`) writes to `~/Library/Logs/MarkDoc/` for diagnosing crashes and export failures, never transmitted off-device automatically. |
| TR-14.2 | A "Show Logs in Finder" / "Copy Diagnostic Info" affordance should exist (e.g. in a Help menu) so users can manually share logs if they choose to report an issue. |
| TR-14.3 | Auto-update (TR-6.6) must never silently replace a document format the user's current version can read but a corrupted update can't — update installation must not run while unsaved documents are open, prompting the user to save first. |

---

## 16. Open Technical Decisions

- **DOCX conversion approach:** AST-driven (`docx.js`, per TR-10.2) vs. a simpler HTML-to-DOCX library as a faster v1 with lower fidelity — recommend starting with the AST-driven approach given the "round-trippable Word doc" open question in the functional spec, but flag as a decision to revisit if it proves too time-consuming for v1.
- **Chart library beyond Mermaid** (TR-9.4): whether to add a dedicated charting library (e.g. Chart.js rendered from a custom fenced-block DSL) or rely solely on Mermaid's own chart types (`pie`, `xychart-beta`).
- **Auto-update hosting** (TR-6.6): GitHub Releases vs. a custom static update feed — affects `electron-updater` configuration and whether a paid code-signing/notarization pipeline needs its own release infrastructure.
- **CLI helper install mechanism** (TR-7.4): whether the "Install Command Line Tool" action needs to prompt for `sudo`/admin rights depending on whether `/usr/local/bin` is writable by the current user out of the box on a given macOS version, vs. always preferring the user-writable `/opt/homebrew/bin` if present on the `$PATH`.
- **State management library** (TR-2.10): confirm Zustand (or equivalent) vs. plain React context once the editor/sidebar/preview component tree is sketched out in detail.
- **Style-override editing UI fidelity** (TR-11.4): confirm v1 scope is a simple settings form rather than a live visual theme designer, given this is called out as "optional/advanced" in the functional spec.
- **Search library choice** (TR-2.12): `minisearch` vs. `fuse.js` for Document Search (FR-12.x) — both are small and dependency-light; the decision mainly comes down to ranking behavior preference once real usage is tried, and can be swapped without affecting the functional contract.
