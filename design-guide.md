# MarkDoc — Design Guide

## 1. Purpose & Positioning

This guide defines MarkDoc's visual and interaction design language. It complements [`functional-requirements.md`](./functional-requirements.md) (FR-1.7 native toolbar, FR-3.2 view toggle, FR-4.6 sidebar toggle, FR-12.x search) and [`technical-requirements.md`](./technical-requirements.md) (TR-1.6 toolbar implementation, TR-2.11 Tailwind, TR-11.x style override engine) by specifying **what those requirements should actually look like**.

**Positioning statement:** MarkDoc should feel like it belongs on macOS — a well-mannered, native-feeling Mac citizen — while borrowing the specific strengths of the best Markdown apps on the platform:

| App | What MarkDoc borrows from it |
|-----|-------------------------------|
| **Typora** | Full WYSIWYG hiding of Markdown syntax, with syntax briefly revealed only on the active line/selection — the core editing feel described in `functional-requirements.md` Section 3. |
| **Bear** | Apple-native polish: restrained chrome, careful typography, a UI that never feels like a web page, sensible use of the system accent colour. |
| **iA Writer** | Editorial calm — generous measure (line length), quiet toolbar that only shows what's relevant, confidence in whitespace. |
| **Craft** | Visual confidence for structured content — tables, images, diagrams presented with real card/block framing rather than looking like raw HTML. |
| **Obsidian** | Proof that Electron apps *can* render technical content (diagrams, code) well — but MarkDoc should look more native and less "tool-like" than Obsidian's default theme. |

**Explicit non-goal:** MarkDoc is not a block-based document tool like Craft or Notion. It edits one linear Markdown document. Structure comes from headings (outline tree, Section 5 of the functional spec) and search (Section 13), not from draggable blocks.

---

## 2. Honest Constraint: What "Native" Can and Can't Mean in Electron

Since `functional-requirements.md` (Section 2) commits to Electron, MarkDoc cannot use AppKit/SwiftUI system components directly, and macOS Tahoe's **Liquid Glass** material (the current system-wide design language as of macOS 26) is a native rendering effect that Electron/Chromium content cannot fully replicate. This guide is written with that constraint in mind:

- We approximate native materials using Electron's `vibrancy` window option (`sidebar`, `titlebar`, `content` — real `NSVisualEffectView` materials, not CSS) combined with restrained CSS, rather than faking blur entirely in CSS.
- We deliberately avoid `backdrop-filter` layered on top of a vibrant window background — Chromium has long-standing rendering bugs there (blur breaking or double-applying) — and instead give any element that needs "extra" translucency its own vibrancy-appropriate opaque-enough background.
- We follow system *conventions* (spacing, icon sizes, corner radii, type scale, sidebar metrics) closely enough that MarkDoc reads as native at a glance, without claiming pixel-perfect Liquid Glass parity. Where the gap matters (e.g. sidebar materials not dynamically re-tinting with wallpaper the way native sidebars do in Tahoe), we accept it as a known trade-off of the Electron decision rather than trying to fake it — see Section 12.

---

## 3. Window Chrome

| Element | Guidance |
|---------|----------|
| Title bar | `titleBarStyle: 'hiddenInset'` (TR-1.6) — native inset traffic lights, no titlebar text/strip. |
| Sidebar material | `vibrancy: 'sidebar'` on the `BrowserWindow`, applied to the outline-tree column only, so it visually reads as a native macOS source list panel, consistent with Mail/Notes/Xcode. |
| Main content background | Opaque (not vibrant) — the editor/preview surface is the "paper," and should read as a solid, focused writing surface rather than translucent. |
| Toolbar | Sits in the same vibrant plane as the title bar (no separate hard-edged bar with its own background colour) — traffic lights, sidebar toggle, view segmented control, and search all sit on one continuous strip, per FR-1.7. |
| Window corner radius | Match the system window corner radius (do not override it); any custom rounded elements inside the window (cards, popovers, the search overlay) should use *concentric* radii relative to their container, per Apple's current corner-radius guidance, rather than arbitrary values. |
| Full screen / Split View / native tabs | Toolbar and sidebar must collapse/adapt the same way native macOS document apps do — no MarkDoc-specific full-screen chrome. |

---

### 3.1 Preferences Window

The Preferences window (`functional-requirements.md` FR-13.x) is a separate, standard-sized, non-resizable native-style window — not vibrant, not a modal sheet over the main document window. Use a simple single-pane form (label-left, control-right, grouped with subtle section dividers) rather than a multi-tab System-Settings-style layout — MarkDoc's v1 preference set (Section 14 of the functional spec) is small enough that tabs would be over-engineering. Typography and spacing follow the same chrome tokens as the toolbar/sidebar (Sections 5–7), not the content type scale.

---

## 4. Layout & Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ● ● ●   [Sidebar toggle]     Edit | Preview | Split   [🔍]  │  ← toolbar (vibrant)
├───────────────┬───────────────────────────────────────────┤
│               │                                             │
│  Outline      │              Editor / Preview               │
│  (vibrant     │              (opaque content surface)       │
│  sidebar)     │                                             │
│               │                                             │
└───────────────┴───────────────────────────────────────────┘
```

- **Sidebar:** 220–280px default width, user-resizable (FR-4.6), collapses to zero-width rather than overlaying content.
- **Content column:** capped measure (max content width, see Section 6) even in a wide window — like iA Writer and Bear, MarkDoc should never stretch body text edge-to-edge in a maximised window. Side-by-side (split) mode divides the remaining space evenly, each half independently capped.
- **Vertical rhythm:** toolbar height ~52px (matches native `sourceList`/toolbar conventions); content has generous top padding (~48–64px) before the first heading, echoing Bear/iA Writer's "breathing room at the top of the page" feel rather than a cramped app-like start.

---

## 5. Typography

| Token | Value | Notes |
|-------|-------|-------|
| UI font | `-apple-system, "SF Pro Text", system-ui, sans-serif` | Chrome (toolbar, sidebar, menus, dialogs) always uses the system font stack — never a custom webfont — so it inherits Dynamic-Type-like sizing and always matches whatever the OS is doing. |
| Editor/Preview body font | `-apple-system` (default) with **user-selectable** alternatives (FR-2.9): a serif option and a monospace option, similar to Bear/iA Writer's font pickers. Store the choice as a design token, not a hard-coded value. |
| Code font | `"SF Mono", ui-monospace, "Menlo", monospace` | Code spans, fenced code blocks, and the View Source mode (FR-2.10). |
| Type scale (content) | H1 28/34, H2 22/28, H3 18/24, H4–H6 16/22, Body 16/26, Small/meta 13/18 (px, size/line-height) | Line-height is deliberately generous (~1.5–1.6×) for long-form readability, matching iA Writer's editorial density rather than a cramped "app UI" density. |
| Type scale (chrome) | 13px default UI text, 11px for secondary/meta labels (sidebar row counts, word count) | Matches native sidebar "small" metrics (Section 7). |
| Weight discipline | Regular / Medium / Semibold / Bold only — no Light/Thin/Ultralight anywhere, including in headings | Per current Apple typography guidance: hierarchy comes from size/weight, not thinness, which also keeps small text legible. |
| Measure (line length) | Cap body text at ~68–74 characters (roughly 640–720px at 16px body size) | The single most important thing separating a "calm writing app" from a "web page with text on it." |

---

## 6. Colour System

- **Light/Dark:** Always both, always following the system by default (`nativeTheme`, FR-1.6), with an explicit in-app override only if the user wants to pin a mode independent of the system.
- **Accent colour:** Respect the user's macOS system accent colour for interactive/selection states (link colour, active outline-tree item, selected toolbar segment) wherever feasible, rather than hard-coding a brand blue — this is explicitly called out in Apple's sidebar guidance and is one of the fastest ways an app can look "off-brand-native." If reading the live system accent colour from Electron proves impractical, fall back to macOS's own default accent blue rather than inventing a MarkDoc brand colour.
- **Semantic tokens, not raw hexes.** Every colour used in chrome or content must be a named token (see Section 12 for the CSS-variable mechanism), e.g.:

| Token | Purpose |
|-------|---------|
| `--surface-primary` | Main editor/preview background |
| `--surface-sidebar` | Sidebar content colour on top of the vibrancy layer |
| `--content-text` | Body text |
| `--content-text-secondary` | Meta text, placeholders, word count |
| `--content-heading-1` … `--content-heading-6` | Per-level heading colour (overridable per FR-9.3) |
| `--accent` | Links, active states, selected outline row, cursor accent |
| `--border-subtle` | Table borders, blockquote rule, sidebar divider |
| `--code-bg`, `--code-text`, `--code-*` (syntax palette) | Code block theme (FR-9.3) |
| `--diagram-bg` | Mermaid/diagram card background |

- **Syntax highlighting palette:** pick a single accessible light theme and matching dark theme (e.g. a GitHub-like or One-themed pair) for code blocks and the View Source mode — don't let the highlighting theme clash with the app's own accent colour.
- **Status colours** (broken image warning FR-10.4, diagram error FR-8.3, export failure FR-11.6): use the system semantic red/orange/yellow, never a custom palette, so warnings read the same as every other macOS app's warnings.

---

## 7. Spacing, Sizing & Iconography

- **Spacing scale:** 4px base unit (4/8/12/16/24/32/48/64) — maps directly onto Tailwind's default scale, so no custom spacing config is needed (TR-2.11).
- **Icons:** use `lucide-react` (per project convention) rather than SF Symbols — SF Symbols' license restricts use to native Apple-platform UI, so it isn't available to a web-tech renderer anyway. Choose Lucide icons with a similar visual weight to SF Symbols (thin-to-medium stroke, consistent 24×24 grid) and size them to match native sidebar/toolbar metrics rather than using Lucide's raw default size everywhere:

| Context | Icon size | Row/control height |
|---------|-----------|---------------------|
| Sidebar outline row (default "medium" density) | 20×20 | 28px row height, 17px horizontal inset |
| Toolbar buttons (sidebar toggle, search) | 16×16 glyph in a 28×28 hit target | 52px toolbar |
| Segmented control (Edit/Preview/Split) labels | text, not icons — matches how macOS itself labels this kind of mode switch (e.g. Notes' "aA" formatting popover uses labelled controls, not just icons, for anything not universally recognisable) | 24px control height |
| Inline status icons (broken image, diagram error) | 14×14 | inline with text baseline |

- **Corner radii:** 6px for small controls (buttons, search field), 10px for cards/popovers, 12–14px for the search overlay panel — kept concentric with whatever contains them (Section 3).

---

## 8. Sidebar & Outline Tree

- Sidebar rows follow the native macOS "sourceList" metrics: 28px row height (medium density) as a default, with the option to honour a user-level "sidebar size" preference (Small/Medium/Large) mirroring System Settings' own sidebar icon size control, if time allows — otherwise medium-only for v1.
- Selected row: full-width rounded-rect highlight in the accent colour at reduced opacity (not a hard-edged rectangle), matching the macOS 11+ sourceList selection style.
- Heading depth is shown by indentation (16px per level) rather than by connecting lines/branches — flatter and calmer than a typical file-tree UI, appropriate since this is a document outline, not a filesystem tree.
- Collapse/expand chevrons: 12px, rotate 90° on toggle, animate over ~120ms ease-out (Section 11).
- Empty state (document has no headings yet): small, quiet placeholder text ("Headings will appear here"), not an empty grey box.

### 8.1 Drag-and-Drop Reordering (FR-4.7–FR-4.10)

Follows the same "quiet until relevant" principle used elsewhere in this guide (the image hover controls, the Large Document Mode indicator) — the tree looks like a plain outline until the user actually starts interacting with it as a drag surface.

- **Drag handle:** a `GripVertical` (lucide-react) icon, 14×14, fades in on row hover at the row's left edge (pushing the heading text slightly right), rather than being permanently visible — keeps the default reading state of the tree calm. Cursor becomes `grab` over the handle, `grabbing` while dragging.
- **Dragged row ("ghost"):** rendered via a floating drag overlay that follows the pointer at reduced opacity (~80%) with a soft shadow, matching the elevation language used for the search overlay (Section 9) and popovers generally. The row's original slot in the list collapses to a thin dashed-outline placeholder rather than disappearing abruptly.
- **Section-size badge:** if the dragged heading has content/children beneath it, the ghost shows a small count badge (e.g. "+4") so the user has a clear signal of how much is moving with it before they drop — this matters because a single heading drag can move a large chunk of the document (FR-4.7), and that shouldn't be a surprise.
- **Drop indicator:** a 2px accent-coloured horizontal line rendered *between* rows (not a row highlight), whose horizontal inset reflects the live-projected drop depth (TR-8.10) — as the user drags further right, the line's left edge steps in by one indentation unit (16px, matching the static indentation in Section 8) per level, giving continuous visual feedback of exactly where the heading will land and at what level, before they release.
- **Invalid targets:** positions that would nest a heading inside its own descendant, or beyond heading level 6, simply aren't offered as drop targets (the indicator skips past them) rather than showing an error state — prevention over correction, per FR-4.10.
- **Drop settle animation:** rows animate into their final position over ~120–150ms ease-out (Section 11), consistent with the rest of the app's motion language, rather than snapping instantly.
- **Keyboard mode:** a focused row shows the standard focus ring; keyboard reordering (FR-4.9) uses arrow keys to move focus, and a modifier + arrow combination to move/indent/outdent the focused row, with the same drop-indicator feedback shown as during a pointer drag so keyboard and pointer users get visual parity.

---

## 9. Toolbar: View Toggle & Search

- **Edit / Preview / Split segmented control** (FR-3.2): native-style segmented control, text-labelled, centred in the toolbar — this is the single most-used control in the app and deserves the most visually "confident" native-looking treatment, closely matching AppKit's `NSSegmentedControl` proportions (roughly 28px tall, 1px hairline dividers between segments, selected segment gets a subtle raised/filled background, not just a text colour change).
- **Sidebar toggle** (FR-4.6): single icon button, left-aligned next to the traffic lights, using the same sidebar icon convention every native macOS app with a sidebar uses (a rectangle-with-left-bar glyph) so users recognise it instantly without a label.
- **Search** (FR-12.x): a compact icon button by default; clicking it (or the keyboard shortcut) expands into an inline toolbar search field *or* opens a centred overlay panel (à la Spotlight/Raycast) — recommend the **centred overlay** approach over an inline-expanding field, because it gives more room for the ranked results list (heading matches vs. body matches, FR-12.2) without squeezing the toolbar. The overlay should use the `popover`/`hud`-equivalent visual weight: a floating rounded card with a soft shadow, dismissible with Escape or an outside click (FR-12.6).
- **Large Document Mode indicator** (FR-2.12, `technical-requirements.md` Section 13.3): a small, dismissible pill/badge in the toolbar (right-hand side, near where word count would live) using `--status-warning` at reduced opacity — same visual language as the broken-image and diagram-error indicators (Section 6), so it reads as "informational, not urgent" rather than an error. Clicking it shows a brief popover explaining that some live features are running at reduced frequency for performance; it never blocks input or interrupts typing, consistent with the "quiet until relevant" principle applied everywhere else in this toolbar.

---

## 10. Editor & Preview Content Styling

This is where MarkDoc's Typora-inspired identity matters most.

- **Syntax visibility rule (resolves the open question in `functional-requirements.md` Section 17):** Markdown syntax characters (`#`, `**`, `` ` ``, list markers' leading `-`/`1.`, etc.) are hidden by default and only revealed, in a muted secondary colour, on the line(s) containing the current selection/cursor — Typora's behaviour, not Notion's "always fully hidden" behaviour. This gives confident writers a way to understand *why* something is formatted a certain way without breaking the WYSIWYG illusion elsewhere in the document. The Preview pane (Section 4 of the functional spec) never reveals syntax under any circumstance, since it has no cursor.
- **Headings:** Sized per the type scale (Section 5), with tighter top-margin-to-previous-paragraph than bottom-margin-to-next-content (headings "attach" to what follows), matching standard editorial typesetting rather than raw browser default `<h1>`–`<h6>` spacing.
- **Lists:** Real bullet/number glyphs rendered by the browser's native list styling (not custom SVG bullets) for crisp rendering at any zoom level; task-list checkboxes are the actual native-feeling rounded checkbox control, sized to align with the text baseline.
- **Blockquotes:** A single accent-tinted vertical rule (3–4px, `--accent` at reduced opacity) with the text in `--content-text-secondary`, not a full background tint block — quieter than most Markdown renderers' default heavy quote-box treatment.
- **Code blocks:** Presented as a distinct card (`--code-bg`, subtle border, 8px radius) with a small language label in the top-right corner and a copy-button that appears on hover — matches the "technical content gets a card" language also used for Mermaid blocks (below), so the eye learns one visual pattern for "this is a distinct embedded thing" across code and diagrams.
- **Mermaid/diagram blocks** (FR-8.2): rendered as a card matching the code-block treatment, but centred, with the raw source available via a small "Edit diagram" affordance (expands the card to show the monospace source, per TR-9.1) rather than always showing code + diagram stacked — keeps the default reading experience clean while still satisfying the "editable inline" requirement.
- **Tables:** Card-style container with a subtle border and alternating-row tint at very low opacity (2–3%) — closer to Craft/Notion's confident table treatment than a bare HTML table with 1px black borders everywhere.
- **Images:** Rounded corners (6px) matching the small-control radius, subtle 1px border in `--border-subtle` (helps images with white/transparent backgrounds read as distinct content on a white editor background), and a lightweight hover affordance for the alt-text/width controls (FR-10.5) rather than a persistent visible toolbar.
- **Horizontal rules:** A single thin `--border-subtle` line with generous vertical margin — not decorative.
- **Selection colour:** Uses the accent colour at ~25% opacity (matching native text-selection tinting), not the browser default blue.
- **Cursor / caret:** Use the accent colour, with a very slightly wider caret than the browser default (matches native NSTextView caret width) for a "solid" feel.
- **Gap cursor** (ProseMirror's cursor-between-block-nodes indicator, e.g. next to an image or diagram card): styled as a thin accent-coloured horizontal bar, not the ProseMirror default dashed outline.

---

## 11. Motion & Micro-interactions

- **Durations:** 120–160ms for small state changes (hover, toggle, selection highlight), 200–250ms for panel-level transitions (sidebar collapse/expand, search overlay open/close, view-mode switch). Nothing in the app should use motion longer than ~300ms — this is a productivity tool, not a marketing site.
- **Easing:** ease-out for things appearing/expanding, ease-in for things disappearing/collapsing — standard macOS feel, not bouncy/springy physics (that reads more iOS-app than Mac-app).
- **Preview updates** (FR-3.4 debounce) should fade/settle rather than visibly "pop" when content changes, since it's re-rendering live as the user types.
- **Respect `prefers-reduced-motion`** (and Electron/macOS's own "reduce motion" system setting) by collapsing all of the above to near-instant transitions.

---

## 12. Implementing This in Tiptap

Practical guidance for translating this guide into code, extending `technical-requirements.md` TR-8.x/TR-9.x/TR-11.x:

1. **Scope everything under `.tiptap`.** Tiptap renders its content inside a container with the `.tiptap` class; all content-styling rules (Section 10) should be written as descendant selectors under `.tiptap` (or `.tiptap.ProseMirror` for extra specificity), so editor styling can never leak into app-chrome styling and vice versa.
2. **CSS custom properties are the single source of truth**, per TR-11.1/TR-11.5. Define the full token set from Sections 5–7 as `:root` custom properties (and a `.dark` override block, or `prefers-color-scheme`-driven values). Tailwind's `tailwind.config.ts` theme extension should point every relevant utility at `var(--token-name)` rather than hard-coded values — this is what makes the same tokens drive Tailwind-authored chrome *and* the runtime-overridable per-document style engine (sidecar JSON, TR-4.2) without two parallel systems.
3. **Use `@tailwindcss/typography` as a starting baseline, then override.** Rather than hand-writing every element's CSS from zero, apply the `prose` classes to the `.tiptap` container as a base, then layer the MarkDoc-specific overrides from Section 10 on top via `@apply` in a global stylesheet (the Tiptap team's own recommended approach, despite Tailwind's general guidance against `@apply` for app code — user-generated flowing content is the documented exception).
4. **The syntax-reveal-on-cursor-line behaviour (Section 10)** is implemented as a ProseMirror **decoration**, not a static style: a plugin tracks the current selection's block position and applies a `reveal-syntax` class/decoration to just that node, toggled via the editor's `onSelectionUpdate`. This keeps the "hidden by default" DOM output clean for Preview/export while giving the editor its dynamic behaviour.
5. **Mermaid/code/table "card" treatment is built with Tiptap NodeViews**, not pure CSS — the code-block and Mermaid nodes (TR-9.1) render actual React components (per Tiptap's React NodeView pattern) so the copy-button, language label, and "Edit diagram" expand/collapse affordance (Section 10) can be real interactive UI, while the underlying Markdown serialization (via `HTMLAttributes`/custom `renderHTML`) stays clean and semantic.
6. **Selection, caret, and gap-cursor styling** are first-class CSS hooks Tiptap explicitly documents (`::selection` scoped to `.tiptap`, the `.ProseMirror-gapcursor` class, and cursor colour via `caret-color`) — style these explicitly rather than accepting ProseMirror's dev-mode-looking defaults, since they're one of the fastest ways an editor betrays that it's "just a web text box."
7. **Dark mode** should flip the CSS custom property values (Section 6), not swap entire stylesheets, so the same component code works in both themes automatically — pair with Electron's `nativeTheme.shouldUseDarkColors` to decide the active class/attribute on the root element.
8. **Don't use Tiptap's optional prebuilt UI Components library as-is for the primary chrome** (toolbar, sidebar, view toggle) — those components are intentionally neutral/unopinionated and meant to be forked. Use them (or their underlying primitives — `Button`, `DropdownMenu`, `Popover`) as a foundation for the formatting bubble-menu (FR-2.6) where genuinely useful, but the native-feeling toolbar/sidebar chrome described in Sections 3, 8, and 9 should be bespoke React components built to the metrics in this guide, not a generic component-library look.

---

## 13. Known Native-Feel Gaps (Accept, Don't Over-Engineer)

Being upfront about where "semi-native" stays semi-native, so effort isn't wasted chasing unreachable fidelity:

- Sidebar vibrancy won't dynamically re-tint with desktop wallpaper the way a true native sidebar does in macOS Tahoe (that requires direct `NSVisualEffectView` layout control beyond what Electron's single-`vibrancy`-property window exposes, and libraries that do implement it — e.g. `electron-tinted-with-sidebar`, mentioned in `technical-requirements.md` Section 16 — add real native-module maintenance overhead for a subtle visual gain). Track as a possible fast-follow, not a v1 requirement.
- True Liquid Glass (real-time lensing/refraction) is unavailable outside native AppKit/SwiftUI; MarkDoc's toolbar/sidebar approximate the *spirit* (translucency, content peeking through, restrained colour) without the literal effect.
- Contenteditable-based rich editors (which is what Tiptap/ProseMirror fundamentally is) have a well-documented history of poor VoiceOver support relative to native `NSTextView` — even polished competitors (see `testing-requirements.md` QR-5.x) have struggled here. Budget real design + engineering time for accessibility, don't assume "it's just a web page, ARIA will fix it."

---

## 14. Design Token Starting Values

A concrete starting point for `src/renderer/styles/tokens.css` (TR-3.5), to be refined once the UI is actually built and viewed on real hardware — not a final spec:

```css
:root {
  /* Surfaces */
  --surface-primary: #ffffff;
  --surface-sidebar: #f7f6f4;
  --border-subtle: rgba(0, 0, 0, 0.08);

  /* Text */
  --content-text: #1c1c1e;
  --content-text-secondary: #6e6e73;
  --content-heading-1: #1c1c1e;
  --content-heading-2: #1c1c1e;
  --content-heading-3: #1c1c1e;

  /* Accent (fallback if system accent colour isn't readable) */
  --accent: #0a84ff;
  --accent-selection: rgba(10, 132, 255, 0.25);

  /* Code & diagrams */
  --code-bg: #f5f5f7;
  --code-text: #1c1c1e;
  --diagram-bg: #fafafa;

  /* Status */
  --status-warning: #ff9f0a;
  --status-error: #ff3b30;

  /* Spacing scale */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* Radii */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;

  /* Motion */
  --duration-fast: 140ms; --duration-panel: 220ms;
}

.dark {
  --surface-primary: #1e1e1e;
  --surface-sidebar: #232323;
  --border-subtle: rgba(255, 255, 255, 0.1);
  --content-text: #f2f2f7;
  --content-text-secondary: #9a9a9e;
  --code-bg: #2a2a2c;
  --diagram-bg: #262626;
}
```

---

## 15. Open Design Decisions

- **Sidebar density preference** (Section 8): ship medium-only for v1, or invest in Small/Medium/Large to mirror System Settings' sidebar icon size control?
- **Search overlay vs. inline field** (Section 9): confirm the centred-overlay recommendation once a rough prototype is in front of real users — an inline toolbar field is cheaper to build and may be "native enough."
- **Custom accent-colour reading**: confirm Electron/Chromium can reliably read the live macOS system accent colour (this can be finicky); if not feasible, formally commit to the static fallback blue in Section 6 rather than half-supporting it.
- **Serif/monospace font picker scope** (Section 5): how many font options ship in v1 — a curated short list (à la Bear) or an open "pick any installed font" control (à la iA Writer)?
- **Sidebar size preference persistence**: resolved — sidebar row density now lives in the global Preferences window (`functional-requirements.md` FR-13.1), not the per-document sidecar file, consistent with it being a chrome preference rather than a document style override.
