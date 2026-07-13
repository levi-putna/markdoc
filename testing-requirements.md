# MarkDoc — Testing Requirements & Test Plan

## 1. Overview & Goals

This document defines **how MarkDoc will be tested**. It has two parts:

- **Section 2 — Testing Requirements (`QR-x.y`):** what must be true about our testing effort itself (coverage, tooling, gating, fixtures) — analogous in spirit to `functional-requirements.md` and `technical-requirements.md`, but describing the quality process rather than the product.
- **Section 3 — Test Plan (`TC-x.y`):** the concrete test suites and test cases, organized by functional area and cross-referenced to the Functional Requirement IDs (`FR-x.y`) they verify.

Primary goals: catch regressions in Markdown round-trip fidelity (the riskiest area, given the WYSIWYG-editor-must-produce-clean-Markdown requirement), verify macOS-specific integration points that are easy to silently break (Finder, CLI, file associations), and keep export output trustworthy (PDF/DOCX should always reflect what the user sees in Preview).

---

## 2. Testing Requirements

### 2.1 Test Levels & Coverage

| ID | Requirement |
|----|-------------|
| QR-1.1 | MarkDoc must be tested at four levels: **Unit** (pure functions/converters), **Component** (React UI components in isolation), **Integration** (main ⇄ renderer ⇄ filesystem interactions within a running Electron instance), and **End-to-End** (the packaged or dev-built app driven like a real user, including macOS-specific behaviors). |
| QR-1.2 | Markdown round-trip conversion (Tiptap document model ⇄ Markdown text, `technical-requirements.md` TR-2.3/TR-8.1) must have unit test coverage for every GFM construct listed in `functional-requirements.md` Section 8, not just a happy-path subset. |
| QR-1.3 | Target coverage: ≥80% line coverage for `src/shared` (converters, style-schema logic) and `src/main` (file I/O, IPC handlers, CLI/single-instance logic); UI component coverage is best-effort and secondary to integration/E2E coverage for the editor itself, since Tiptap/ProseMirror behavior is better verified through realistic interaction tests than isolated unit tests. |
| QR-1.4 | Every bug fix for a user-reported issue must land with a regression test (unit, integration, or E2E as appropriate) that fails before the fix and passes after. |
| QR-1.5 | **AI / gateway tests** must never call the live Vercel AI Gateway in CI. All assistant, tool, and autocomplete tests use mocked IPC responses or fixture stream chunks. A separate, manual optional smoke test against a real gateway key may be documented for pre-release only. |

### 2.2 Tooling

| ID | Requirement |
|----|-------------|
| QR-2.1 | **Unit/component tests:** Vitest (pairs naturally with the Vite-based `electron-vite` build) + React Testing Library for component tests. |
| QR-2.2 | **Integration/E2E tests:** Playwright with its Electron support (`_electron` launcher), driving the actual packaged/dev Electron binary — clicking, typing, and asserting on rendered DOM state, plus asserting on real files written to a temp directory. |
| QR-2.3 | **Visual regression (Preview/export fidelity):** snapshot testing of rendered Preview HTML (DOM/HTML snapshot) at minimum for v1; pixel-level visual regression (e.g. Playwright screenshot comparison) is a stretch goal for the Preview pane and exported PDF pages once the UI stabilizes. |
| QR-2.4 | **Export content verification:** PDF export verified via a PDF text/structure extraction library (e.g. `pdf-parse` or `pdfjs-dist`) asserting expected text/heading content is present; DOCX export verified by unzipping the `.docx` and asserting on the underlying `document.xml` (or via the `docx` library's own read path) for expected structure (headings, tables, images referenced). |
| QR-2.5 | All automated tests must run headlessly in CI without requiring a visible display session where possible (Playwright/Electron supports this on macOS runners); any test that genuinely requires a real GUI session (e.g. verifying native macOS window tabs visually) is flagged as manual (Section 3.5) rather than forced into CI. |

### 2.3 macOS Integration Testing

| ID | Requirement |
|----|-------------|
| QR-3.1 | Tests must run on a macOS CI runner (not Linux/Windows), since core functionality (Finder integration, native menus, notarization-dependent behavior, CLI install to `/usr/local/bin`) is macOS-specific and cannot be validated elsewhere. |
| QR-3.2 | File-association and "Open With" behavior (FR-5.1–FR-5.3) must be covered by at least one E2E test that launches the packaged app with a file path argument (simulating Finder's launch behavior) and asserts the file opens correctly — full interactive Finder right-click flows remain manual (Section 3.5). |
| QR-3.3 | The CLI single-instance hand-off (FR-6.1–FR-6.9, TR-7.1–TR-7.6) must be covered by an integration test that: starts the app, invokes the CLI helper against a running instance, and asserts (a) no second GUI process/window set is created, (b) the existing window receives and opens the requested file, and (c) the window is focused. |
| QR-3.4 | Code-signing and notarization are verified as part of the release process (not per-PR CI) — a release checklist item, not a unit/integration test — since it depends on secrets/certificates not available in every CI run. |

### 2.4 Performance & Regression Testing

| ID | Requirement |
|----|-------------|
| QR-4.1 | A benchmark test suite must exercise the performance targets in `technical-requirements.md` Section 13 (cold launch time, CLI hand-off latency, typing latency on a large synthetic document) and run on a schedule (e.g. nightly) rather than blocking every PR, to avoid CI flakiness from timing assertions blocking merges. |
| QR-4.2 | A fixed corpus of synthetic documents at each defined size tier (`technical-requirements.md` Section 13.1) must be checked into the test fixtures directory and used consistently across performance runs: a **Standard**-tier doc (~10k words), a **Large**-tier doc (~50k words, including 10+ Mermaid diagrams and large tables), and a **Very Large**-tier doc (~150k words) — so results are comparable over time and each tier's degradation behavior is independently verifiable. |
| QR-4.3 | Performance regressions beyond an agreed threshold (e.g. >20% slower than the last recorded baseline) should raise a visible warning in CI output, even if not a hard failing gate initially. |
| QR-4.4 | Large Document Mode's activation threshold and its effect on debounce/idle-scheduling intervals (TR-12.9) must be covered by dedicated tests, not just inferred from general responsiveness benchmarks — the mode either engages correctly at the tier boundary or it doesn't, and that's a discrete, assertable behavior. |

### 2.5 Accessibility Testing

| ID | Requirement |
|----|-------------|
| QR-5.1 | Automated accessibility checks (e.g. `axe-core` run against rendered renderer DOM via Playwright) must run against the main editor, preview, sidebar, **assistant panel**, and export dialogs to catch obvious issues (missing labels, contrast, focus traps). |
| QR-5.2 | A manual VoiceOver smoke-test pass (Section 3.5) is required before each release, covering: opening a document, navigating the outline tree, using core formatting commands via keyboard only, and **using the assistant panel** (focus composer, send a message, accept/reject a suggestion via keyboard). |

### 2.6 CI/CD Gating

| ID | Requirement |
|----|-------------|
| QR-6.1 | Every pull request must run: lint, type-check, unit tests, component tests, and the integration/E2E smoke suite (Section 3.4) on a macOS runner before merge is allowed. |
| QR-6.2 | The full E2E suite (all functional-area test cases in Section 3.3) must run at minimum before tagging a release, and ideally on every merge to the main branch. |
| QR-6.3 | A failing required check blocks merge; flaky tests must be quarantined (marked and tracked, not silently skipped forever) rather than left red or deleted. |

### 2.7 Test Data & Fixtures

| ID | Requirement |
|----|-------------|
| QR-7.1 | A fixtures directory must contain: (a) a document exercising every GFM construct in `functional-requirements.md` Section 8, individually and in combination; (b) documents with valid and deliberately invalid Mermaid diagrams; (c) documents with front matter, with and without body content; (d) documents referencing images via relative paths, including at least one intentionally broken reference; (e) a document with a style-override sidecar file applied. |
| QR-7.2 | Where practical, the CommonMark spec's official test suite (or a representative subset) should be used to validate baseline Markdown parsing/serialization fidelity, supplementing MarkDoc-specific fixtures. |
| QR-7.3 | Fixtures must be treated as test code: reviewed in PRs, and updated deliberately (not silently) when intentional behavior changes require updating an expected snapshot. |
| QR-7.4 | AI fixtures must include: (a) serialised `UIMessage[]` conversation threads for per-document history tests; (b) mocked gateway stream chunks (text, tool-call, tool-result, error) for assistant UI tests; (c) mock gateway error payloads for insufficient credit (402/403), invalid key (401), rate limit (429), and timeout; (d) a short document with duplicate heading titles for heading-reference collision tests. |
| QR-7.5 | A test double for the main-process AI handler (`src/main/ai/__mocks__/` or Playwright route intercept) must be checked in so integration tests can drive full assistant turns without network access. |

---

## 3. Test Plan

### 3.1 Test Levels & Tooling Summary

| Level | Tooling | Runs Where |
|-------|---------|------------|
| Unit | Vitest | Every PR (CI) |
| Component | Vitest + React Testing Library | Every PR (CI) |
| Integration | Playwright (`_electron`) | Every PR (CI smoke subset), full suite pre-release |
| End-to-End | Playwright (`_electron`), packaged app | Full suite pre-release / main branch |
| Performance | Custom benchmark harness | Nightly / pre-release |
| Accessibility (automated) | `axe-core` via Playwright | Every PR (CI) |
| Accessibility (manual, VoiceOver) | Manual | Pre-release |
| Manual/exploratory | Human tester | Pre-release |

### 3.2 Environment Matrix

| Dimension | Coverage |
|-----------|----------|
| macOS versions | Current release + previous two major versions (per FR-1.3), at least the current and oldest supported tested pre-release |
| Architecture | Apple Silicon (arm64) as primary CI target; Intel (x64) verified at minimum once per release cycle (real hardware or Rosetta) |
| Window modes | Standalone window, native tabs, full screen — at least one E2E pass per mode per release |

### 3.3 Test Suites by Functional Area

Each row is a representative test case; area codes map to `functional-requirements.md` sections. This is not an exhaustive enumeration but the minimum bar per area — additional cases should be added as edge cases are discovered.

**Editing (`TC-EDIT`) — verifies FR-2.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-EDIT.1 | Typing `# ` at the start of a line converts it to a level-1 heading node (input rule), and it serializes back to `# Heading` on save. | Component + Unit (serializer) |
| TC-EDIT.2 | Applying bold via keyboard shortcut and via toolbar button produce identical serialized Markdown (`**text**`). | Component |
| TC-EDIT.3 | Creating a table via the toolbar, adding/removing a row and column, serializes to valid GFM table syntax with correct alignment markers. | Integration |
| TC-EDIT.4 | Pressing Enter inside a task list item creates a new task item; Backspace on an empty item exits the list. | Component |
| TC-EDIT.5 | Undo/redo correctly reverts/reapplies a multi-step formatting operation (e.g. bold + list conversion) as a single logical unit. | Component |
| TC-EDIT.6 | "View Source" mode displays Markdown text identical to what would be written to disk on save, for a document mixing headings, lists, tables, and code blocks. | Integration |

**Preview (`TC-PREVIEW`) — verifies FR-3.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-PREVIEW.1 | Preview of a document containing every supported GFM construct shows no raw syntax characters (`#`, `**`, `` ` ``, `|`) anywhere in rendered text content. | Integration (DOM assertion) |
| TC-PREVIEW.2 | Toggling Edit-only / Preview-only / Split view updates the visible panes correctly and preserves scroll position on return to a previously viewed mode. | Integration |
| TC-PREVIEW.3 | In split view, scrolling the editor to a given heading scrolls the preview to the matching rendered heading (and vice versa). | Integration |
| TC-PREVIEW.4 | Preview updates within the debounce window after a burst of typing, without rendering stale content indefinitely. | Integration (timing-tolerant) |

**Document Outline (`TC-OUTLINE`) — verifies FR-4.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-OUTLINE.1 | Outline tree reflects heading hierarchy (H1–H6) of a fixture document exactly, including nesting. | Component |
| TC-OUTLINE.2 | Adding, deleting, or changing the level of a heading updates the outline tree live without requiring a manual refresh. | Integration |
| TC-OUTLINE.3 | Clicking an outline node scrolls the editor (and preview, if visible) to the corresponding heading. | Integration |
| TC-OUTLINE.4 | Collapsing a parent node hides its descendants; "Expand All"/"Collapse All" affects the whole tree. | Component |
| TC-OUTLINE.5 | Moving the cursor into a section highlights the nearest enclosing heading in the outline. | Integration |
| TC-OUTLINE.6 | Dragging a heading node to a new position among siblings (same depth) reorders the corresponding sections in the Markdown document to match, moving the heading's entire content range (TR-8.8), not just the heading line itself. | Integration |
| TC-OUTLINE.7 | Dragging a heading to a different nesting depth automatically adjusts its heading level (and its own nested children's levels by the same delta) to match the new depth (FR-4.8). | Integration |
| TC-OUTLINE.8 | Attempting to drop a heading inside its own descendant section, or beyond heading level 6, is disallowed during the drag itself (no valid drop indicator is shown at that position) rather than being accepted and rejected afterwards (FR-4.10). | Component |
| TC-OUTLINE.9 | A completed drag-and-drop reorder is a single Undo step; Undo restores both the document content and the outline tree to their pre-drag state. | Integration |
| TC-OUTLINE.10 | Outline reordering is fully operable via keyboard alone (focus a row, move/indent/outdent via keyboard), with no pointer/mouse input, and produces the same document result as the equivalent pointer drag (FR-4.9). | Integration |
| TC-OUTLINE.11 | Keyboard-driven reorders trigger an ARIA live-region announcement describing the move (TR-8.12), verified via the automated accessibility check (QR-5.1). | Accessibility (automated) |

**Header/Toolbar (`TC-HEADER`) — verifies FR-1.7, FR-3.2, FR-4.6**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-HEADER.1 | The header/toolbar renders the sidebar toggle, Edit/Preview/Split segmented control, and search entry point at all times a document window is open. | Component |
| TC-HEADER.2 | Clicking the sidebar toggle in the header hides/shows the outline sidebar, matching the View menu item and keyboard shortcut (three equivalent triggers, one state). | Integration |
| TC-HEADER.3 | Clicking each segment of the Edit/Preview/Split control switches to the corresponding view mode, matching the View menu item and keyboard shortcut. | Integration |
| TC-HEADER.4 | The toolbar region outside interactive controls is draggable (window drag), while the controls themselves remain clickable and do not trigger a window drag. | Manual (Section 3.5) — window-drag behavior is impractical to assert reliably in headless CI |

**Document Search (`TC-SEARCH`) — verifies FR-12.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-SEARCH.1 | Opening search via the header entry point and via the keyboard shortcut both open the same overlay/field. | Integration |
| TC-SEARCH.2 | Typing a query that matches a heading title shows that heading ranked above a result that only matches body text. | Unit (ranking logic) + Integration |
| TC-SEARCH.3 | Arrow keys move the highlighted result up/down; Enter jumps to the highlighted result; mouse click on a result jumps to it. | Component |
| TC-SEARCH.4 | Selecting a result scrolls the editor (and preview, if visible) to the matching location, and briefly highlights the matched text at the destination. | Integration |
| TC-SEARCH.5 | Pressing Escape, or clicking outside the search overlay, closes it and returns focus to the editor at its previous cursor position. | Integration |
| TC-SEARCH.6 | The document index/search results update after editing headings/content (within the shared debounce tick, `technical-requirements.md` TR-8.6), without requiring the user to reopen the search overlay. | Integration |
| TC-SEARCH.7 | A query with no matches shows a clear "no results" state rather than an empty or broken-looking list. | Component |

**File Management & Finder Integration (`TC-FILE`) — verifies FR-5.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-FILE.1 | New / Open / Save / Save As / Close via the File menu operate correctly against a temp directory, including overwrite confirmation and error handling for an unwritable path. | Integration |
| TC-FILE.2 | Unsaved-changes indicator appears after an edit and clears after save; attempting to close an unsaved document prompts the user. | Integration |
| TC-FILE.3 | Launching the packaged app with a file path argument (simulating Finder double-click / "Open With") opens that file. | E2E (manual complement: real Finder right-click, Section 3.5) |
| TC-FILE.4 | Dragging a file from Finder onto an open window/app icon opens it as a new document. | Manual (Section 3.5) — not reliably automatable |
| TC-FILE.5 | Quitting and relaunching the app restores previously open documents/windows. | Integration |
| TC-FILE.6 | Launching MarkDoc with no file to open (no argument, no restorable session) immediately shows a blank untitled document, with no intermediate welcome/loading screen. | E2E |
| TC-FILE.7 | Modifying the backing file of an open document from outside MarkDoc (e.g. writing to it directly in the test) triggers the reload/keep-editing prompt; choosing "reload" replaces in-app content, choosing "keep editing" preserves it and the next save overwrites the external change. | Integration |
| TC-FILE.8 | Making edits, then force-killing the app process, then relaunching and reopening the same document, offers the crash-recovery snapshot; accepting it restores the unsaved edits, declining it opens the last-saved version. | Integration |
| TC-FILE.9 | Closing a window with unsaved changes prompts to save; choosing "Don't Save" discards changes, "Save" writes them, "Cancel" aborts the close. | Integration |
| TC-FILE.10 | With a pristine blank window open, opening a file from Finder/CLI reuses that window instead of spawning a second one. | Integration |
| TC-FILE.11 | With a saved document open, opening another file from Finder/CLI creates a new window and leaves the existing document untouched. | Integration |

**Command Line Interface (`TC-CLI`) — verifies FR-6.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-CLI.1 | `markdoc <file>` with no running instance launches the app with that file open. | E2E |
| TC-CLI.2 | `markdoc <file>` with an already-running instance opens the file in the existing instance, brings it to the foreground, and does **not** create a second GUI window set (verified via process/window count assertions). | Integration (QR-3.3) |
| TC-CLI.3 | `markdoc <file1> <file2>` opens both files, each in its own window/tab. | E2E |
| TC-CLI.4 | `markdoc /path/does-not-exist.md` exits non-zero with a clear error message and does not launch/focus the app. | Unit/Integration (CLI script) |
| TC-CLI.5 | `markdoc --new-window <file-already-open>` opens a second window for a file that's already open elsewhere, rather than focusing the existing one. | Integration |
| TC-CLI.6 | `markdoc` with no arguments activates the app (foreground if running, blank document if not). | E2E |

**Markdown Format Support (`TC-MD`) — verifies FR-7.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-MD.1 | Round-trip test: for each fixture document (QR-7.1a), load → edit nothing → save, and assert byte-for-byte (or semantically equivalent, if whitespace normalization is an accepted trade-off) output matches the original. | Unit (serializer) |
| TC-MD.2 | Each individual GFM construct (heading levels 1–6, emphasis variants, ordered/unordered/task lists with nesting, blockquote nesting, code spans/fences with language tags, tables with alignment, footnotes, definition lists, autolinks) imports correctly into the editor model and serializes back to equivalent Markdown. | Unit (parser + serializer, table-driven) |
| TC-MD.3 | Front matter is preserved unchanged (including key order and formatting, where feasible) across a load/edit-body/save cycle. | Unit |
| TC-MD.4 | Sanitized HTML passthrough renders safely in editor and preview; a fixture containing a `<script>` tag confirms it is stripped/neutralized, not executed. | Integration (security-relevant) |
| TC-MD.5 | A CommonMark-spec-derived subset of test cases (QR-7.2) passes for parsing/rendering fidelity. | Unit |

**Diagrams & Charts (`TC-DIAG`) — verifies FR-8.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-DIAG.1 | A valid Mermaid flowchart/sequence/class/state/Gantt/ER diagram (one fixture per type) renders correctly in both the in-editor inline preview and the Preview pane. | Integration |
| TC-DIAG.2 | An intentionally malformed Mermaid block renders an inline error placeholder (showing the raw source) in both editor and Preview, without breaking rendering of the rest of the document. | Integration |
| TC-DIAG.3 | Editing the raw Mermaid source within the editor's code node updates the inline rendered preview live (within debounce tolerance). | Integration |
| TC-DIAG.4 | Diagrams are rasterized/embedded correctly in exported PDF and DOCX output (cross-referenced with `TC-EXPORT`). | Integration |

**Style Overrides (`TC-STYLE`) — verifies FR-9.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-STYLE.1 | Setting a heading-level font override updates the rendered Preview and editor styling for that heading level only, leaving other elements at base-theme defaults. | Integration |
| TC-STYLE.2 | Style overrides are persisted to the sidecar file (TR-4.2) and re-applied correctly when the document is reopened, including on a different simulated "machine" (fresh app profile pointed at the same document + sidecar file). | Integration |
| TC-STYLE.3 | "Reset to default" removes all overrides and reverts rendering to the base theme. | Integration |
| TC-STYLE.4 | A document with no sidecar file renders identically to the base theme (no error, no missing-file warning shown to the user). | Integration |
| TC-STYLE.5 | Style overrides are reflected consistently in exported PDF/DOCX output, matching the in-app Preview appearance. | Integration (cross-referenced with `TC-EXPORT`) |

**Image Management (`TC-IMG`) — verifies FR-10.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-IMG.1 | Pasting an image from the clipboard inserts it inline, writes a copy into the document's asset folder, and serializes a correct relative-path reference on save. | Integration |
| TC-IMG.2 | Drag-and-drop image insertion behaves identically to paste (TC-IMG.1). | Integration |
| TC-IMG.3 | Opening a fixture document with a broken image reference surfaces a visible warning rather than failing silently or crashing. | Integration |
| TC-IMG.4 | Renaming/duplicating a document via MarkDoc's file operations offers to move/copy the associated asset folder, and references remain valid afterward. | Integration |
| TC-IMG.5 | Setting alt text and display width on an inserted image persists correctly across save/reload. | Integration |

**Export (`TC-EXPORT`) — verifies FR-11.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-EXPORT.1 | Exporting a fixture document (mixed headings/lists/tables/images/diagrams) to PDF produces a file whose extracted text contains all expected headings and body text in order (QR-2.4). | Integration |
| TC-EXPORT.2 | Exporting the same fixture to DOCX produces a file whose structure (headings, table rows/columns, embedded images) matches expectations when inspected via the DOCX content model (QR-2.4). | Integration |
| TC-EXPORT.3 | PDF export honors page size and margin options selected in the export dialog. | Integration |
| TC-EXPORT.4 | A document containing Mermaid diagrams exports with those diagrams present as static images in both PDF and DOCX output. | Integration |
| TC-EXPORT.5 | Export of a document with an unsupported/failing construct surfaces a clear error rather than producing a silently truncated or corrupted file. | Integration |
| TC-EXPORT.6 | Export respects applied style overrides (cross-referenced with `TC-STYLE.5`). | Integration |
| TC-EXPORT.7 | Exporting a fixture document to standalone HTML produces a file that renders correctly (styles and diagram SVGs intact) when opened directly in a browser, independent of MarkDoc. | Integration |

**Preferences (`TC-PREFS`) — verifies FR-13.x**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-PREFS.1 | Opening Preferences via the app menu and via ⌘, both open the same window. | Integration |
| TC-PREFS.2 | Changing editor font/size and toggling spellcheck in Preferences applies immediately to all open document windows without a restart. | Integration |
| TC-PREFS.3 | Toggling the appearance override (system / light / dark) updates all open windows' theme immediately. | Integration |
| TC-PREFS.4 | Installing/uninstalling the CLI helper from Preferences (FR-6.2) is reflected correctly in a subsequent `markdoc` invocation from a fresh shell. | Manual (Section 3.5) — shell `$PATH` propagation is impractical to assert reliably in CI |

**Auto-Update (`TC-UPDATE`) — verifies `technical-requirements.md` TR-6.6, TR-14.3**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-UPDATE.1 | `canInstallUpdate` returns `false` if any open document window has unsaved changes, `true` otherwise (including zero open windows). | Unit |
| TC-UPDATE.2 | On `update-downloaded`, if every window is clean, the user is prompted to restart; choosing "Restart Now" calls `quitAndInstall`, choosing "Later" does not. | Unit (fake `autoUpdater`/`dialog`) |
| TC-UPDATE.3 | On `update-downloaded`, if any window has unsaved changes, no dialog is shown and `quitAndInstall` is never called — installation is silently deferred to the next clean quit (TR-14.3). | Unit |
| TC-UPDATE.4 | If a document becomes dirty while the restart-confirmation dialog is open, `quitAndInstall` is *not* called even if the user already clicked "Restart Now" — safety is re-checked immediately before installing. | Unit |
| TC-UPDATE.5 | Background update checks never run in an unpackaged (dev) build, and never throw/reject unhandled when a check fails (network offline, feed unreachable). | Unit |
| TC-UPDATE.6 | The "Check for Updates…" menu action reports "up to date", "update available", or an error dialog matching the real outcome of the check. | Unit (`checkForUpdatesManually`) |
| TC-UPDATE.7 | End-to-end update round trip: install an old signed/notarized build, publish a newer signed/notarized test release to a scratch GitHub repo (or the real repo's pre-release channel), confirm the running app downloads, prompts, and relaunches on the new version. | Manual (Section 3.5) — requires real code-signing/notarization and a real release artifact; not practical in CI |

**Performance & Large Documents (`TC-PERF`) — verifies FR-2.12, `technical-requirements.md` Section 13**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-PERF.1 | Opening the Standard-tier fixture (QR-4.2) meets the cold-open responsiveness target (TR-12.4) with no dropped frames beyond brief GC pauses. | Performance (nightly, QR-4.1) |
| TC-PERF.2 | Opening the Large-tier fixture (~50k words) triggers Large Document Mode (TR-12.9) and shows the toolbar indicator (Section 3.3 Preferences UI patterns / `design-guide.md` Section 6); opening the Standard-tier fixture does not. | Integration |
| TC-PERF.3 | Typing latency on the Large-tier fixture stays within a perceptible-lag-free range even though preview/outline/search debounce has widened — i.e. degradation trades *freshness* of secondary features, not raw keystroke responsiveness (TR-12.9). | Performance (nightly) |
| TC-PERF.4 | Scrolling through the Large-tier fixture (with 10+ Mermaid diagrams) does not eagerly render off-screen diagrams; scrolling a diagram into view triggers its render via the `IntersectionObserver` gate (TR-12.6). | Integration |
| TC-PERF.5 | Opening and saving the Very Large-tier fixture (~150k words) completes without freezing the window (parse/serialize runs off the UI thread per TR-12.11) and without crashing, even though it is not expected to feel as snappy as smaller tiers. | Performance (nightly) |
| TC-PERF.6 | Running Find & Replace (FR-2.4) and Document Search (FR-12.x) against the Large-tier fixture completes without a sustained UI freeze, confirming the incremental/chunked scan behavior in TR-12.10. | Integration |
| TC-PERF.7 | Memory usage after opening and lightly editing the Large-tier fixture is captured and compared against the recorded baseline (QR-4.3), flagging (not failing) on regression beyond the agreed threshold. | Performance (nightly) |

**AI Assistant (`TC-AI`) — verifies FR-14.x, `technical-requirements.md` Section 17**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-AI.1 | With AI disabled (default), the assistant panel shows the Preferences empty state; no gateway IPC calls are made when the panel is opened. | Integration |
| TC-AI.2 | Enabling AI in Preferences without a gateway key blocks send; with a mocked valid key, the first send shows the disclosure confirmation once, then allows subsequent sends. | Integration |
| TC-AI.3 | Sending a message streams assistant text into the `Conversation` thread; `ConversationScrollButton` appears when scrolled up and returns to the latest message on click. | Component + Integration |
| TC-AI.4 | Submitting a second prompt while streaming enqueues it in AI Elements `Queue`; queued items appear under a pending section and are submitted in order when the current turn completes. | Integration |
| TC-AI.5 | A mocked tool call in progress shows a `Shimmer` (or loading) label; completed tool calls collapse to a summary row in the thread. | Component |
| TC-AI.6 | Mocked `propose_edit` in Suggestion mode renders track-changes decorations in the editor without mutating saved content; Accept merges, Reject removes decorations with no document change. | Integration |
| TC-AI.7 | Mocked `apply_edit` in Auto mode applies the edit immediately and registers a single Undo step that restores the prior content. | Integration |
| TC-AI.8 | Failed `apply_edit` / `propose_edit` (mocked gateway or tool error) leaves no orphan decorations or partial edits (FR-14.35). | Integration |
| TC-AI.9 | Conversation history for document A is persisted locally; switching to document B loads B's thread; switching back to A restores A's thread (FR-14.18–FR-14.19). | Integration |
| TC-AI.10 | "New conversation" clears the visible thread for the current document; "Clear all AI history" in Preferences removes stored conversation files. | Integration |
| TC-AI.11 | A `heading://` reference token in an assistant message renders as a clickable link; clicking it scrolls the editor to the matching heading (same destination as outline click, FR-4.2). | Integration |
| TC-AI.12 | Context menu "Ask Assistant" with a selection focuses the panel and attaches selection context to the next send. | Integration |
| TC-AI.13 | Mocked insufficient-credit gateway error shows a user-friendly message with a billing link; no automatic retry occurs. | Unit + Integration |
| TC-AI.14 | Mocked 401 (invalid key) and 429 (rate limit) errors surface the correct user-facing messages (FR-14.37–FR-14.38). | Unit |
| TC-AI.15 | Model selector lists only user-enabled models; each entry shows a cost tier ($ / $$ / $$$) derived from fixture pricing data. | Component |
| TC-AI.16 | Assistant panel is collapsible/resizable; width and visibility persist across window state restoration (FR-14.9). | Integration |
| TC-AI.17 | Suggested prompts in the empty state adapt to context (long doc vs selection vs empty doc) and send on click. | Component |

**AI Inline Autocomplete (`TC-AIA`) — verifies FR-14.41–FR-14.46**

| ID | Test Case | Level |
|----|-----------|-------|
| TC-AIA.1 | With AI disabled, no ghost text appears while typing. | Integration |
| TC-AIA.2 | With AI enabled and a mocked suggestion response, ghost text appears after the cursor; Tab accepts and inserts text as one undoable step; Esc dismisses without changing the document. | Integration |
| TC-AIA.3 | Continuing to type after a suggestion is requested cancels the in-flight mocked request and clears ghost text. | Integration |
| TC-AIA.4 | Autocomplete does not trigger inside a fenced/code block node. | Component |
| TC-AIA.5 | When the mocked gateway is unreachable, autocomplete fails silently (no ghost text, no crash). | Integration |

### 3.4 Regression / Smoke Suite (Per-PR Gate)

A fast subset (~15–20 test cases, target under 5 minutes total) must run on every PR, covering at minimum: TC-EDIT.1–2, TC-PREVIEW.1, TC-OUTLINE.3, TC-OUTLINE.6, TC-OUTLINE.9, TC-HEADER.2–3, TC-SEARCH.1–2, TC-FILE.1–2, TC-FILE.7, TC-FILE.9, TC-CLI.2, TC-MD.1–2 (subset), TC-DIAG.1–2, TC-STYLE.1, TC-IMG.1, TC-EXPORT.1–2, TC-PERF.2, **TC-AI.1, TC-AI.6–7, TC-AI.9, TC-AI.13, TC-AIA.1–2**. The full suite in Section 3.3 runs pre-release and on main-branch merges (QR-6.1/QR-6.2); the nightly-only performance cases (TC-PERF.1, .3, .5, .7 — QR-4.1) run on their own schedule rather than gating every PR.

### 3.5 Manual QA Checklist (Pre-Release)

Items that are impractical or low-value to fully automate, to be walked through by a human tester before each release, on real hardware:

- Right-click a `.md` file in Finder → "Open With" → MarkDoc appears and opens the file correctly.
- Set MarkDoc as the default app for `.md` files; confirm double-click behavior afterward.
- Drag a file from Finder onto the Dock icon and onto an open MarkDoc window.
- Install the CLI tool via the in-app action on a fresh macOS user account (no prior `$PATH` entry) and confirm `markdoc` works in a new Terminal tab.
- Full-screen and native tabbed-window behavior (visual/interaction check).
- VoiceOver pass: open a document, navigate the outline via keyboard, apply formatting via keyboard shortcuts only (QR-5.2).
- Light/Dark mode switching while the app is open, confirming editor/preview theme updates immediately.
- Visual/interaction check of the header toolbar: window is draggable from empty toolbar space, traffic-light controls sit correctly against the inset title bar, and the sidebar toggle/view segmented control/search icon look and feel consistent with native macOS toolbar conventions (not like an embedded web page).
- Design conformance pass against `design-guide.md`: typography scale, colour tokens, spacing/icon sizing, sidebar row metrics, syntax-reveal-on-cursor-line behaviour (FR-2.2a), and motion durations match the guide in both light and dark mode.
- Install a downloaded, notarized build on a clean machine (no dev certificates installed) and confirm no Gatekeeper warning appears.
- Auto-update dry run (TC-UPDATE.7): install the previous release, publish the new one via `yarn release`, and confirm the running app finds it, downloads it in the background, and successfully restarts into the new version. Also confirm that starting the restart prompt while a document has unsaved changes does *not* offer to install until the document is saved or closed.
- **AI manual smoke (optional, requires user's gateway key):** enable AI, send a summarise prompt, verify streaming response, verify Suggestion-mode edit accept/reject on a short fixture document, verify conversation persists after close/reopen of the same file.
- Visual inspection of one exported PDF and one exported DOCX file opened in Preview.app and Microsoft Word/Pages respectively, confirming they look correct to a human, not just structurally correct to an automated parser.

### 3.6 Release Exit Criteria

A release candidate is ready to ship when:

- The full automated suite (Section 3.3) passes on the target macOS versions/architectures in the environment matrix (Section 3.2).
- No open P0 (crash/data-loss) or P1 (major feature broken) defects remain.
- The Manual QA Checklist (Section 3.5) has been completed with no new blocking findings.
- Performance benchmarks (QR-4.1) show no unexplained regression beyond the agreed threshold (QR-4.3) versus the previous release.
- Code signing and notarization succeed cleanly for the release build (QR-3.4).

---

## 4. Appendix: Test Case Template

New test cases added over time should follow this shape for consistency:

```
ID: TC-<AREA>.<n>
Verifies: FR-x.y[, FR-x.y...]
Level: Unit | Component | Integration | E2E | Manual
Preconditions: ...
Steps:
  1. ...
  2. ...
Expected Result: ...
Notes: (flakiness risk, platform-specific caveats, etc.)
```
