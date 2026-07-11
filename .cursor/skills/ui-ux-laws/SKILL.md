---
name: ui-ux-laws
description: >-
  Audits and improves React/Tailwind components against 27 research-backed
  UI/UX laws (Fitts's Law, Hick's Law, Jakob's Law, Miller's Law, Gestalt
  laws, 60-30-10 Rule, etc.), sourced from twistedbrackets.com/ui-laws. Use
  when building, reviewing, or refactoring UI components and elements in
  src/renderer (buttons, forms, toolbars, dialogs, sidebar, tables,
  notifications, tooltips), or when the user asks for a UI/UX review, design
  critique, or mentions specific law names or "ui-laws".
---

# UI/UX Laws

Reference for applying the 27 laws from [twistedbrackets.com/ui-laws](https://www.twistedbrackets.com/ui-laws) to MarkDoc's components (`src/renderer/components`). Cross-check against `design-guide.md` first — that file is the project's specific design language; these laws are the general mechanisms behind it.

## Workflow

When building a new component or reviewing an existing one:

1. Identify the component type (button, form, dialog, table, nav/sidebar, card, notification, tooltip).
2. Scan the relevant law categories below — not all 27 apply to every component.
3. For each applicable law, check current behaviour against the "Apply" guidance.
4. Fix violations directly in the component; note trade-offs if a law conflicts with `design-guide.md` (design guide wins — it's project-specific).
5. For concrete before/after code in this stack (React + Tailwind + lucide-react), see [examples.md](examples.md).

Don't cite law names in UI copy or user-facing text — they're internal review criteria only.

## Interaction & Speed

| Law | Definition | Apply |
|---|---|---|
| Fitts's Law | Time to select a target is a function of its size and distance from the pointer. | Make frequent/important targets (toolbar buttons, primary actions) large and close to where the user's cursor already is. Don't shrink click targets below ~24px. |
| Hick's Law | Decision time increases with the number and complexity of choices. | Limit toolbar/menu items per group; use progressive disclosure (submenus, "More") instead of flat long lists. Keep `BlockTypeSelect`/`TableInsertPicker` option counts scannable. |
| Jakob's Law | Users expect your product to work like other products they already use. | Follow macOS conventions (already codified in `design-guide.md`): standard shortcuts, native-feeling dialogs, familiar toolbar/sidebar placement. |
| Doherty Threshold | Engagement rises when the system responds in under ~400ms. | Debounce/optimize search (`SearchOverlay`), outline updates, and preview re-render so keystrokes never feel delayed. Show a lightweight pending state past ~400ms. |
| Forcing Function | In irreversible-action dialogs, make the safe choice the loud default primary button; demote the destructive choice to a quiet, warning-tinted link-style action, opposite side from primary. | Audit any delete/discard/overwrite confirmation dialogs against this pattern. |
| Focus Ring | A focus indicator only needs to appear for keyboard/non-pointer input, must be visible against its background, must follow the DOM order, and a modal must trap it until closed. | Verify `:focus-visible` (not `:focus`) styling on all interactive elements; check dialogs/overlays (`SearchOverlay`, `PreferencesPage`) trap focus. |

## Memory & Attention

| Law | Definition | Apply |
|---|---|---|
| Miller's Law | People hold ~7±2 items in working memory. | Chunk long lists (outline tree, preferences) into grouped sections rather than one flat list. |
| Multi-Step Chunking | Break long forms into short steps grouped by meaning, with visible progress, per-step validation, and persisted state. | Applies if any multi-field setup/import flow is added; not needed for the current single-pane `PreferencesPage`. |
| Serial Position Effect | People remember the first and last items in a list best. | Put the most important toolbar/menu actions first or last, not buried in the middle. |
| Zeigarnik Effect | Unfinished/interrupted tasks are remembered better than completed ones. | Use this for save-state indicators — an unsaved-changes dot/asterisk keeps the "open loop" visible until resolved. |
| Peak-End Rule | Experiences are judged mostly by their peak moment and their ending. | Make save/export completion and error recovery feel polished — these are the "endings" users remember. |

## Perception & Gestalt

| Law | Definition | Apply |
|---|---|---|
| Law of Prägnanz | Ambiguous/complex shapes are perceived in their simplest form. | Prefer simple geometric icons/shapes (lucide-react) over decorative or overly detailed custom iconography. |
| Law of Proximity | Objects near each other are perceived as more related. | Group related toolbar controls/form fields with tighter spacing; add extra gap between unrelated groups. |
| Law of Common Region | Elements sharing a clear boundary (border/background/container) are perceived as one group. | Use a shared card/panel background for related controls (e.g. table insert grid, outline badges) instead of relying on spacing alone. |
| Law of Similarity | Visually similar elements are perceived as related or functionally equivalent. | Keep consistent styling for elements with the same role (all destructive actions look alike, all secondary buttons look alike) across components. |
| Law of Uniform Connectedness | Elements joined by a visible line/connector are perceived as more related than proximity/similarity alone. | Use connecting lines/indentation guides in the outline tree (`OutlineSidebar`) to show heading hierarchy. |
| Von Restorff Effect | The one item that visually differs from its peers is the most memorable. | Reserve visual distinction (colour/shape) for the one thing that should stand out — e.g. the active view-mode segment, an error state — not multiple things at once. |
| Aesthetic-Usability Effect | More aesthetically pleasing designs are perceived as easier to use, regardless of actual usability. | Polish still matters even for "good enough" UX — don't skip visual refinement on functional components. |
| Hierarchy Through Contrast | Visual hierarchy comes from contrast in weight/colour, not escalating font size. | Matches `design-guide.md`'s weight discipline (Regular/Medium/Semibold/Bold only). Differentiate headings from body via weight/colour, not just larger type. |
| Tabular Numerals | Numeric values in tables should be right-aligned with tabular (fixed-width) figures so digits/decimals line up. | Apply to any word-count, line-number, or numeric table columns; use `font-variant-numeric: tabular-nums` or a monospace figure font. |
| Subgrid Alignment | Cards with varying content length should align title/body/actions to shared row tracks via CSS subgrid, not self-sized rows. | Apply if a card grid is introduced (e.g. table style picker); use CSS Grid `subgrid` rather than independent flex cards. |
| Scrollbar Continuity | Scrollable panels should have a thin, on-brand, visible scrollbar — not the bulky OS default, not hidden entirely. | Style scrollbars in `OutlineSidebar` and long preview/editor panes consistently with the vibrancy/native look in `design-guide.md`. |
| 60-30-10 Rule | Split screen colour by proportion: ~60% neutral, ~30% muted secondary, ~10% saturated accent reserved for the one action/state that should win. | Audit colour usage across the toolbar/sidebar/content: one accent colour reserved for the primary/active state, not scattered across many elements. |

## Motivation & Complexity

| Law | Definition | Apply |
|---|---|---|
| Goal-Gradient Effect | Motivation increases and effort accelerates as people approach a goal. | Show progress feedback (e.g. search result counts, export progress) so users feel momentum near completion. |
| Tesler's Law | Every process has irreducible complexity — the system or the user must absorb it. | Prefer the system absorbing complexity (e.g. auto-detecting Markdown flavour) over pushing config choices onto the user. |
| Postel's Law | Be liberal in what you accept from input, conservative in what you output. | Markdown/paste parsing should tolerate malformed input gracefully; exported/rendered output should be clean and predictable. |
| Inline Validation | Validate a field on blur, not on every keystroke or only on submit; clear the error the instant the user edits again. | Apply to `PreferencesPage` form fields and any settings inputs. |

## Additional resources

- For before/after code patterns in this project's stack (React + Tailwind + lucide-react), see [examples.md](examples.md).
- Project-specific design language (typography, spacing, vibrancy, colour tokens): `design-guide.md` at the repo root.
