/**
 * Shared form-control class strings for consistent preferences and dialog UI.
 * Heights align to `--control-height` (28px) — see DESIGN.md.
 */
export const formControlClassName =
  'h-control w-full max-w-full appearance-none rounded-xs border border-border-subtle bg-surface-primary px-2 text-sm leading-none'

export const formControlWidthClassName = 'w-44 max-w-full'

export const formButtonBaseClassName =
  'inline-flex h-control shrink-0 items-center justify-center appearance-none rounded-xs px-3 text-sm font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const formButtonSecondaryClassName = `${formButtonBaseClassName} border border-border-subtle bg-surface-primary text-content-text hover:bg-[color-mix(in_srgb,var(--content-text)_6%,transparent)]`

export const formButtonPrimaryClassName = `${formButtonBaseClassName} bg-brand text-white hover:opacity-90`

export const formControlSlotClassName = 'flex h-control shrink-0 items-center'
