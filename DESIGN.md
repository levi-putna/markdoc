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

## Form controls

### Control height

All single-line form controls share one height:

| Token | Value |
|-------|-------|
| `--control-height` | **28px** |
| `--control-padding-x` | 8px |

Tailwind: `h-control`, `min-h-control`, `w-control` (square icon buttons).

### Alignment

Preferences and dialogs use a **label-left / control-right** row (`PreferenceRow`):

- Default: `items-center` — control vertically centred against the label block.
- Multi-line controls (e.g. model checklist): `align="start"`.
- Control column uses `formControlSlotClassName` (`flex h-control items-center`) so switches and inputs sit on the same baseline.

### Shared class strings

Import from `src/renderer/lib/form-control-styles.ts`:

| Export | Use |
|--------|-----|
| `formControlClassName` | Text inputs, selects, number fields |
| `formControlWidthClassName` | Standard pref control width (`w-44`) |
| `formButtonSecondaryClassName` | Bordered secondary buttons |
| `formButtonPrimaryClassName` | Filled brand primary buttons |
| `formControlSlotClassName` | Right column wrapper for alignment |

### Component mapping

| Component | Height | Radius | Notes |
|-----------|--------|--------|-------|
| `Button` (default / sm) | `h-control` | `rounded-xs` | `appearance: none` — required on macOS |
| `Input` | `h-control` | `rounded-xs` | |
| `Select` trigger | `h-control` | `rounded-xs` | |
| `Switch` | 18×32px track | `rounded-full` | Centred in `h-control` slot |
| `Textarea` | `min-h-[60px]` | `rounded-xs` | Exception — multi-line |

### macOS native appearance

Buttons and inputs reset native chrome in `globals.css`:

```css
button:not([role='switch']) { appearance: none; }
```

Without this, filled buttons render with system styling and custom `bg-brand` is invisible.

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
| `src/renderer/lib/form-control-styles.ts` | Shared pref/dialog control classes |
| `src/renderer/styles/globals.css` | Global resets, editor chrome |
| `design-guide.md` | Product design language |

---

## Checklist for new UI

1. Single-line control? → `h-control` + `rounded-xs`
2. Brand colour? → `brand`, not `accent`
3. Primary button? → `formButtonPrimaryClassName` or `Button` + `bg-brand`
4. Pref row? → `PreferenceRow` with `formControlSlotClassName` alignment
5. macOS button? → ensure `appearance-none` or use shadcn `Button`
