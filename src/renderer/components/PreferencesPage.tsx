import { useState, useEffect, type ReactNode } from 'react'
import { useDocumentStore } from '../store/document-store'
import type { AppearanceMode, SidebarDensity } from '@shared/ipc'

const FONT_SIZE_RANGE = { min: 12, max: 24 }
const LINE_SPACING_RANGE = { min: 1, max: 2.5 }

/**
 * Clamps a numeric input value to a range, falling back when unparseable.
 */
function clampNumber({
  value,
  min,
  max,
  fallback,
}: {
  value: string
  min: number
  max: number
  fallback: number
}): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * A single label-left / control-right preferences row.
 */
function PreferenceRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <label htmlFor={htmlFor} className="text-sm">
        {label}
      </label>
      {children}
    </div>
  )
}

/**
 * Preferences window page for global app settings.
 */
export function PreferencesPage() {
  const { preferences, setPreferences } = useDocumentStore()
  const [local, setLocal] = useState(preferences)
  // Text mirrors for number fields so partial input isn't clamped mid-keystroke
  const [fontSizeText, setFontSizeText] = useState(String(preferences.editorFontSize))
  const [lineSpacingText, setLineSpacingText] = useState(String(preferences.editorLineSpacing))

  useEffect(() => {
    window.markdoc?.getPreferences().then((prefs) => {
      setPreferences(prefs)
      setLocal(prefs)
      setFontSizeText(String(prefs.editorFontSize))
      setLineSpacingText(String(prefs.editorLineSpacing))
    })
  }, [setPreferences])

  const update = async (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    if (window.markdoc) {
      await window.markdoc.setPreferences(patch)
    }
    setPreferences(patch)
  }

  /** Commits the font size field, clamped to its valid range. */
  const commitFontSize = (value: string) => {
    const clamped = clampNumber({
      value,
      ...FONT_SIZE_RANGE,
      fallback: local.editorFontSize,
    })
    setFontSizeText(String(clamped))
    if (clamped !== local.editorFontSize) update({ editorFontSize: clamped })
  }

  /** Commits the line spacing field, clamped to its valid range. */
  const commitLineSpacing = (value: string) => {
    const clamped = clampNumber({
      value,
      ...LINE_SPACING_RANGE,
      fallback: local.editorLineSpacing,
    })
    setLineSpacingText(String(clamped))
    if (clamped !== local.editorLineSpacing) update({ editorLineSpacing: clamped })
  }

  return (
    <div className="opaque-window h-full overflow-y-auto p-6" data-testid="preferences-page">
      <h1 className="mb-4 text-base font-semibold">Preferences</h1>

      {/* Editor section */}
      <section className="border-b border-border-subtle pb-4">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-content-secondary">
          Editor
        </h2>
        <PreferenceRow label="Font size" htmlFor="pref-font-size">
          <input
            id="pref-font-size"
            type="number"
            min={FONT_SIZE_RANGE.min}
            max={FONT_SIZE_RANGE.max}
            value={fontSizeText}
            onChange={(e) => setFontSizeText(e.target.value)}
            onBlur={(e) => commitFontSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitFontSize(e.currentTarget.value)
            }}
            className="w-20 rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm [font-variant-numeric:tabular-nums]"
            data-testid="pref-font-size"
          />
        </PreferenceRow>
        <PreferenceRow label="Line spacing" htmlFor="pref-line-spacing">
          <input
            id="pref-line-spacing"
            type="number"
            min={LINE_SPACING_RANGE.min}
            max={LINE_SPACING_RANGE.max}
            step={0.1}
            value={lineSpacingText}
            onChange={(e) => setLineSpacingText(e.target.value)}
            onBlur={(e) => commitLineSpacing(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLineSpacing(e.currentTarget.value)
            }}
            className="w-20 rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm [font-variant-numeric:tabular-nums]"
          />
        </PreferenceRow>
        <PreferenceRow label="Spellcheck" htmlFor="pref-spellcheck">
          <input
            id="pref-spellcheck"
            type="checkbox"
            checked={local.spellcheckEnabled}
            onChange={(e) => update({ spellcheckEnabled: e.target.checked })}
            data-testid="pref-spellcheck"
          />
        </PreferenceRow>
      </section>

      {/* Appearance section */}
      <section className="border-b border-border-subtle py-4">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-content-secondary">
          Appearance
        </h2>
        <PreferenceRow label="Theme" htmlFor="pref-appearance">
          <select
            id="pref-appearance"
            value={local.appearance}
            onChange={(e) => update({ appearance: e.target.value as AppearanceMode })}
            className="w-40 rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm"
            data-testid="pref-appearance"
          >
            <option value="system">Follow System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </PreferenceRow>
        <PreferenceRow label="Sidebar density" htmlFor="pref-sidebar-density">
          <select
            id="pref-sidebar-density"
            value={local.sidebarDensity}
            onChange={(e) => update({ sidebarDensity: e.target.value as SidebarDensity })}
            className="w-40 rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </PreferenceRow>
      </section>

      {/* CLI section */}
      <section className="py-4">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-content-secondary">
          Command Line Tool
        </h2>
        <p className="mb-3 text-sm text-content-secondary">
          Open Markdown files from the terminal with the <code>markdoc</code> command.
        </p>
        <button
          type="button"
          className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          onClick={() => update({ cliInstalled: !local.cliInstalled })}
          data-testid="pref-cli-install"
        >
          {local.cliInstalled ? 'Uninstall' : 'Install'} markdoc CLI
        </button>
      </section>
    </div>
  )
}
