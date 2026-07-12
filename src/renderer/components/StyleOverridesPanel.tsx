import { useState } from 'react'
import { Palette, RotateCcw, X } from 'lucide-react'
import type { StyleOverride } from '@shared/ipc'

interface StyleOverridesPanelProps {
  overrides: StyleOverride
  onSave: ({ overrides }: { overrides: StyleOverride }) => void
  onReset: () => void
  onClose: () => void
}

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

/**
 * Simple per-document style override editor (TR-11.4, FR-9.x).
 */
export function StyleOverridesPanel({
  overrides,
  onSave,
  onReset,
  onClose,
}: StyleOverridesPanelProps) {
  const [draft, setDraft] = useState<StyleOverride>({ ...overrides, version: overrides.version ?? 1 })

  const setHeadingColor = (level: string, color: string) => {
    setDraft((current) => ({
      ...current,
      headingColors: { ...current.headingColors, [level]: color },
    }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={onClose}
      data-testid="style-overrides-panel"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Document style overrides"
        className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-primary shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette size={16} aria-hidden />
            Document Styles
          </div>
          <button
            type="button"
            className="toolbar-icon-btn toolbar-icon-btn--header"
            onClick={onClose}
            aria-label="Close style panel"
          >
            <X />
          </button>
        </div>

        {/* Body text overrides */}
        <div className="space-y-3 px-4 py-4">
          <label className="block text-[11px] text-content-secondary">
            Body colour
            <input
              type="color"
              className="mt-1 block h-8 w-full cursor-pointer"
              value={draft.bodyColor ?? '#1a1a1a'}
              onChange={(event) => setDraft((current) => ({ ...current, bodyColor: event.target.value }))}
            />
          </label>

          <label className="block text-[11px] text-content-secondary">
            Body font size
            <input
              type="text"
              className="mt-1 w-full rounded border border-border-subtle bg-transparent px-2 py-1 text-sm"
              value={draft.bodyFontSize ?? ''}
              placeholder="e.g. 16px"
              onChange={(event) =>
                setDraft((current) => ({ ...current, bodyFontSize: event.target.value }))
              }
            />
          </label>

          {/* Heading colour overrides */}
          <fieldset>
            <legend className="text-[11px] text-content-secondary">Heading colours</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {HEADING_LEVELS.map((level) => (
                <label key={level} className="text-[10px] uppercase text-content-secondary">
                  {level}
                  <input
                    type="color"
                    className="mt-1 block h-6 w-full cursor-pointer"
                    value={draft.headingColors?.[level] ?? '#111111'}
                    onChange={(event) => setHeadingColor(level, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Actions */}
        <div className="flex justify-between border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-content-secondary hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onReset}
          >
            <RotateCcw size={12} aria-hidden />
            Reset to default
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-1 text-[11px] text-white"
            onClick={() => onSave({ overrides: draft })}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
