/**
 * Shared form-control class strings for consistent preferences, panels, and dialogs.
 * Heights align to `--control-height` (28px) — see DESIGN.md.
 */

/** Single-line text inputs, native selects, and number fields. */
export const formControlClassName =
  'h-control w-full max-w-full appearance-none rounded-xs border border-border-subtle bg-surface-primary px-2 text-sm leading-none text-content-text shadow-none transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60'

/** Standard control width in wide (label-left) preference rows. */
export const formControlWidthClassName = 'w-44 max-w-full'

/** Right column wrapper so switches and inputs share a baseline in wide forms. */
export const formControlSlotClassName = 'flex h-control shrink-0 items-center'

export const formButtonBaseClassName =
  'inline-flex h-control shrink-0 items-center justify-center appearance-none rounded-xs px-3 text-sm font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const formButtonSecondaryClassName = `${formButtonBaseClassName} border border-border-subtle bg-surface-primary text-content-text hover:bg-[color-mix(in_srgb,var(--content-text)_6%,transparent)]`

export const formButtonPrimaryClassName = `${formButtonBaseClassName} bg-brand text-white hover:opacity-90`

/** Section title in stacked (narrow) forms. */
export const formSectionTitleClassName = 'text-sm font-semibold text-content-text'

/** Field label — stacked layout (label above control). */
export const formFieldLabelClassName = 'text-xs font-medium text-content-text'

/** Optional helper copy beneath a label or control. */
export const formFieldDescriptionClassName = 'text-xs leading-snug text-content-secondary'

/** Subsection legend above a choice group. */
export const formSectionLegendClassName = 'text-xs font-medium text-content-secondary'

/** Bordered row for label + switch pairs — fixed control height alignment. */
export const formToggleRowClassName =
  'flex min-h-control items-center justify-between gap-2 rounded-xs border border-border-subtle px-2.5'

/** Selectable radio/checkbox card — unselected state (label left, control right). */
export const formChoiceCardClassName =
  'flex cursor-pointer items-start justify-between gap-3 rounded-xs border border-border-subtle bg-surface-primary px-2.5 py-2 transition-[border-color,background-color] hover:border-[color-mix(in_srgb,var(--content-text)_18%,transparent)]'

/** Selected state modifier for choice cards — subtle fill, not heavy accent wash. */
export const formChoiceCardSelectedClassName =
  'border-[color-mix(in_srgb,var(--content-text)_20%,transparent)] bg-[color-mix(in_srgb,var(--content-text)_4%,var(--surface-primary))]'

/** Read-only preview / callout block. */
export const formCalloutClassName =
  'rounded-xs border border-border-subtle bg-[color-mix(in_srgb,var(--surface-sidebar)_35%,var(--surface-primary))] px-2.5 py-2'

/** Dashed example block — clearly illustrative, not editable. */
export const formExampleBlockClassName =
  'rounded-xs border border-dashed border-[color-mix(in_srgb,var(--content-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--surface-sidebar)_55%,var(--surface-primary))] px-2.5 py-2'

/** Small pill marking illustrative content. */
export const formExampleBadgeClassName =
  'inline-flex shrink-0 items-center rounded-xs bg-[color-mix(in_srgb,var(--content-text)_8%,transparent)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-secondary'

/** Monospace sample values (numbering patterns, paths, etc.). */
export const formExampleTextClassName =
  'font-mono text-xs tabular-nums text-content-secondary'

/** Scrollable body padding for narrow side panels (document options, etc.). */
export const formPanelBodyClassName = 'flex-1 overflow-y-auto px-3 py-3'

/** Vertical rhythm between top-level sections in compact panels. */
export const formPanelSectionStackClassName = 'space-y-5'

/** Vertical rhythm between stacked blocks inside a single section. */
export const formSectionStackClassName = 'space-y-3'

/** Vertical rhythm between fields within a section. */
export const formFieldStackClassName = 'space-y-2'

/** Label-to-control gap in stacked fields. */
export const formFieldInnerStackClassName = 'flex flex-col gap-1'
