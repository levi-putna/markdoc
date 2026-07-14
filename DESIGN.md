# MarkDoc — Design System

This document is the **implementation reference** for MarkDoc’s visual tokens, form controls, and brand colours. For product-level UX guidance (window chrome, typography philosophy, layout), see [`design-guide.md`](./design-guide.md).

---

## Brand

| Token | CSS variable | Tailwind | Usage |
|-------|--------------|----------|--------|
| Accent blue | `--accent` | `text-brand`, `bg-brand` | Primary actions, links, active nav, switch on-state |
| Accent selection | `--accent-selection` | `bg-brand-selection` | Selected sidebar/pref nav rows, search highlights |
| Primary text | `--content-text` | `text-content-text` | Body and labels |
| Secondary text | `--content-text-secondary` | `text-content-secondary` | Descriptions, meta |
| Surface | `--surface-primary` | `bg-surface-primary` | Opaque panels (Preferences, dialogs) |
| Sidebar surface | `--surface-sidebar` | `bg-surface-sidebar` | Outline / toolbar vibrancy tint |
| Border | `--border-subtle` | `border-border-subtle` | Dividers, control outlines |

**Important:** Tailwind `accent` is reserved for shadcn/ui hover surfaces (`--accent-shadcn`). Use **`brand`** for MarkDoc’s macOS system blue — never `text-accent` / `bg-accent` for brand colour.

---

## Spacing

Defined in `src/renderer/styles/tokens.css`:

| Token | Value |
|-------|-------|
| `--space-1` … `--space-8` | 4px → 64px (4px steps at low end) |

---

## Border radius

| Token | Value | Tailwind | Default for |
|-------|-------|----------|-------------|
| `--radius-xs` | **4px** | `rounded-xs` | **Buttons, inputs, selects, pref controls** |
| `--radius-sm` | 6px | `rounded-sm` | Code blocks, small cards |
| `--radius-md` | 10px | `rounded-md` | Popovers (shadcn) |
| `--radius-lg` | 14px | `rounded-lg` | Larger cards |

Use **`rounded-xs`** for all form controls unless a component spec says otherwise.

---

## Form design system

Forms should feel **calm, precise, and native** — closer to macOS System Settings or a well-built developer tool than a generic web app. The rules below apply to Preferences, document options, dialogs, and any future settings UI.

### Design principles

| Principle | Rule |
|-----------|------|
| **Consistent control height** | Every single-line input, select, and button in a form row shares `--control-height` (28px). Never mix ad-hoc `py-1.5` / `py-2` heights in the same form. |
| **xs radius everywhere** | Inputs, selects, buttons, toggle rows, choice cards, and callouts use `rounded-xs` (4px). Reserve larger radii for popovers and modal shells only. |
| **Hierarchy through contrast** | Differentiate labels, values, and helper text with **weight and colour**, not font-size jumps. Section titles are `text-sm semibold`; field labels are `text-xs medium`; descriptions are `text-xs secondary`. |
| **Proximity (Gestalt)** | Label sits **4px** above its control (`gap-1`). Related fields group with **8px** gaps (`space-y-2`). Sections separate with **12px** (`space-y-3`). Do not use large empty gaps inside compact panels. |
| **Common region** | Toggle pairs and choice groups live inside **shared bordered containers** so they read as one control, not floating labels. |
| **One accent** | Brand blue is reserved for focus rings, selected choice cards, switch on-state, and primary buttons — not scattered across every label. |
| **Compact in narrow space** | Side panels (260–480px) use **stacked** fields (label above control), `px-3 py-3` body padding, and full-width controls. Wide windows use **label-left / control-right** rows. |
| **Focus-visible only** | Keyboard focus uses a brand-tinted ring; pointer clicks do not show a persistent outline. |

### Layout modes

#### Wide form — label left, control right

Used in Preferences (`PreferencesPage` → `PreferenceRow`):

```
┌ Label + description ──────────────── [ control ] ┐
│  14px medium                          28px h     │
└──────────────────────────────────────────────────┘
```

- Row padding: `py-4`, separated by `border-b border-border-subtle`.
- Control column: `formControlSlotClassName` (`flex h-control items-center`).
- Standard control width: `w-44` via `formControlWidthClassName`.
- Multi-line controls (API key block): `align="start"` on the row.

#### Narrow form — label above control (stacked)

Used in document options and other side panels (`FormLayout` components):

```
Section title (14px semibold)
  Field label (12px medium)
  [ full-width control — 28px ]
  helper text (12px secondary)
```

- Panel body: `formPanelBodyClassName` (`px-3 py-3`).
- Section stack: `formSectionStackClassName` (`space-y-3`).
- Field stack: `formFieldStackClassName` (`space-y-2`).

### Control height

All single-line form controls share one height:

| Token | Value |
|-------|-------|
| `--control-height` | **28px** |
| `--control-padding-x` | 8px |

Tailwind: `h-control`, `min-h-control`, `w-control` (square icon buttons).

### Control anatomy

Every text input and native select:

| Property | Value |
|----------|-------|
| Height | `h-control` (28px) |
| Radius | `rounded-xs` (4px) |
| Border | `1px border-border-subtle` |
| Background | `bg-surface-primary` (opaque — not transparent) |
| Text | `text-sm text-content-text` |
| Focus | `focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand/30` |
| Padding | `px-2` (8px horizontal) |

### Toggle rows

Label + switch pairs use `FormToggleRow` / `formToggleRowClassName`:

- `min-h-control` with `items-center` — switch vertically centred.
- `rounded-xs border border-border-subtle px-2.5`.
- Label: `text-sm text-content-text`.

### Choice cards (radio groups)

Selectable presets/options use `FormChoiceCard`:

- **Layout:** label and description on the **left**, radio on the **right** (plan-picker pattern).
- Unselected: white surface, `rounded-xs` border, `px-2.5 py-2`.
- Selected: subtle grey fill (`4%` content tint) and slightly stronger border — not a heavy accent wash.
- **Examples:** separate `example` prop, rendered with `FormExampleText` / `e.g.` badge + monospace secondary text so samples are visually distinct from descriptions.
- Cards stack with `space-y-1.5`.

### Example / preview blocks

Illustrative content (not editable, not real document data) uses `FormExamplePreview`:

- Dashed border + muted fill (`formExampleBlockClassName`).
- **Example** badge pill in the header row.
- Sample values in `formExampleTextClassName` (monospace, secondary colour, tabular nums).
- Footer disclaimer when showing mock document content (e.g. “Illustrative headings only”).
- Always set `aria-label` including “(example)” for screen readers.

Use `FormCallout` for informational (non-example) read-only blocks.

### Shared class strings

Import from `src/renderer/lib/form-control-styles.ts`:

| Export | Use |
|--------|-----|
| `formControlClassName` | Text inputs, selects, number fields |
| `formControlWidthClassName` | Standard pref control width (`w-44`) |
| `formButtonSecondaryClassName` | Bordered secondary buttons |
| `formButtonPrimaryClassName` | Filled brand primary buttons |
| `formControlSlotClassName` | Right column wrapper (wide forms) |
| `formToggleRowClassName` | Label + switch bordered row |
| `formChoiceCardClassName` | Unselected radio/checkbox card |
| `formChoiceCardSelectedClassName` | Selected card modifier |
| `formCalloutClassName` | Preview / info blocks |
| `formPanelBodyClassName` | Narrow panel scroll body padding |
| `formSectionStackClassName` | Gap between sections (`space-y-3`) |
| `formFieldStackClassName` | Gap between fields (`space-y-2`) |

### Layout components

Import from `src/renderer/components/form/FormLayout.tsx`:

| Component | Use |
|-----------|-----|
| `FormSection` | Section with `h2` title |
| `FormField` | Stacked label + optional description + control |
| `FormToggleRow` | Bordered label + switch row |
| `FormChoiceGroup` | Fieldset with legend for card groups |
| `FormChoiceCard` | Single selectable radio card |
| `FormExampleText` | Inline monospace sample with badge |
| `FormExamplePreview` | Dashed illustrative preview block |
| `FormCallout` | Read-only info block (non-example) |

### Component mapping

| Component | Height | Radius | Notes |
|-----------|--------|--------|-------|
| `Button` (default / sm) | `h-control` | `rounded-xs` | `appearance: none` — required on macOS |
| `Input` | `h-control` | `rounded-xs` | |
| `Select` trigger | `h-control` | `rounded-xs` | |
| Native `<select>` | `h-control` | `rounded-xs` | Use `formControlClassName` |
| `Switch` | 18×32px track | `rounded-full` | Centred in `h-control` slot / toggle row |
| `Textarea` | `min-h-[60px]` | `rounded-xs` | Exception — multi-line |
| `FormToggleRow` | `min-h-control` | `rounded-xs` | Border wraps label + switch |
| `FormChoiceCard` | auto | `rounded-xs` | Selected → subtle grey fill; `example` prop for samples |
| `FormExamplePreview` | auto | `rounded-xs` | Dashed example block with badge |
| `FormExampleText` | inline | — | Monospace sample with `e.g.` badge |

### macOS native appearance

Buttons and inputs reset native chrome in `globals.css`:

```css
button:not([role='switch']) { appearance: none; }
```

Without this, filled buttons render with system styling and custom `bg-brand` is invisible.

### Spacing reference (compact panels)

| Context | Token / class | Value |
|---------|---------------|-------|
| Panel body padding | `formPanelBodyClassName` | 12px |
| Between sections | `formSectionStackClassName` | 12px |
| Between fields | `formFieldStackClassName` | 8px |
| Label → control | `formFieldInnerStackClassName` | 4px |
| Choice card internal | `px-2.5 py-2` | 10px × 8px |
| Toggle row horizontal | `px-2.5` | 10px |

---

## Typography (chrome)

| Context | Size | Weight |
|---------|------|--------|
| Preferences labels | 14px (`text-sm`) | Medium |
| Descriptions | 12px (`text-xs`) | Regular |
| Control text | 14px (`text-sm`) | Regular / Medium (buttons) |

Font stack: `-apple-system, "SF Pro Text", system-ui, sans-serif`

---

## shadcn/ui

AI assistant UI uses shadcn primitives under `src/renderer/components/ui/`. They inherit:

- `rounded-xs` on buttons and inputs (overridden from upstream defaults)
- `h-control` on single-line controls
- shadcn `accent` for menu/hover states only

Install new primitives with `npx shadcn@latest add <component>` then align radii and heights to this document.

---

## AI Gateway setup

Users supply their own [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key. To create one:

- **Dashboard:** [AI Gateway API Keys](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys&title=AI+Gateway+API+Keys) — opens directly in the system browser
- **Constant:** `AI_GATEWAY_KEYS_URL` in `src/shared/ai/types.ts`
- **Preferences:** “Create a key in Vercel” link under the API key field (opens in the system browser via `openExternal`)

---

## Files

| Path | Purpose |
|------|---------|
| `src/renderer/styles/tokens.css` | Colour, space, radius, control height tokens |
| `tailwind.config.ts` | Tailwind mappings (`brand`, `rounded-xs`, `h-control`) |
| `src/renderer/lib/form-control-styles.ts` | Shared form control class strings |
| `src/renderer/components/form/FormLayout.tsx` | Stacked form layout components (panels) |
| `src/renderer/styles/globals.css` | Global resets, editor chrome |
| `design-guide.md` | Product design language |

---

## Checklist for new UI

1. Single-line control? → `h-control` + `rounded-xs` + `formControlClassName`
2. Brand colour? → `brand`, not `accent` (shadcn hover surface)
3. Primary button? → `formButtonPrimaryClassName` or `Button` + `bg-brand`
4. Wide settings row? → `PreferenceRow` with `formControlSlotClassName`
5. Narrow panel field? → `FormField` + stacked layout + `formPanelBodyClassName`
6. Toggle setting? → `FormToggleRow` (not a loose label + switch)
7. Radio/preset picker? → `FormChoiceGroup` + `FormChoiceCard`
8. macOS button? → ensure `appearance-none` or use shadcn `Button`
