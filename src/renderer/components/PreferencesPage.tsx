import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Palette, Terminal, Type } from 'lucide-react'
import { useDocumentStore } from '../store/document-store'
import type { AppearanceMode, SidebarDensity } from '@shared/ipc'

const FONT_SIZE_RANGE = { min: 12, max: 24 }
const LINE_SPACING_RANGE = { min: 1, max: 2.5 }

const FONT_FAMILY_OPTIONS = [
  {
    value: '-apple-system, "SF Pro Text", system-ui, sans-serif',
    label: 'System',
    description: 'Matches the macOS system font for a familiar, native feel.',
  },
  {
    value: 'Iowan Old Style, "New York", Georgia, serif',
    label: 'Serif',
    description: 'A classic editorial typeface suited to long-form writing.',
  },
  {
    value: '"SF Mono", ui-monospace, Menlo, monospace',
    label: 'Monospace',
    description: 'Fixed-width characters, ideal for technical notes and code-heavy drafts.',
  },
] as const

type SettingsSection = 'appearance' | 'editor' | 'cli'

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: typeof Palette
}[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'cli', label: 'CLI', icon: Terminal },
]

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
 * A single label-left / control-right preferences row with optional helper text.
 */
function PreferenceRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string
  description?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border-subtle py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">{description}</p>
        )}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

/**
 * Section heading and intro copy for a preferences category.
 */
function PreferenceSectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="mb-2 border-b border-border-subtle pb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-content-secondary">{description}</p>
    </header>
  )
}

/**
 * Preferences window page for global app settings.
 */
export function PreferencesPage() {
  const { preferences, setPreferences } = useDocumentStore()
  const [local, setLocal] = useState(preferences)
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
  const [cliBusy, setCliBusy] = useState(false)
  const [cliError, setCliError] = useState<string | null>(null)
  const [cliInstallPath, setCliInstallPath] = useState<string | null>(null)
  // Text mirrors for number fields so partial input isn't clamped mid-keystroke
  const [fontSizeText, setFontSizeText] = useState(String(preferences.editorFontSize))
  const [lineSpacingText, setLineSpacingText] = useState(String(preferences.editorLineSpacing))

  /** Refreshes CLI install status from the main process. */
  const refreshCliStatus = useCallback(async () => {
    if (!window.markdoc) return

    const [prefs, status] = await Promise.all([
      window.markdoc.getPreferences(),
      window.markdoc.getCliStatus(),
    ])

    setPreferences(prefs)
    setLocal(prefs)
    setCliInstallPath(status.installPath)
    setCliError(null)
  }, [setPreferences])

  useEffect(() => {
    window.markdoc?.getPreferences().then((prefs) => {
      setPreferences(prefs)
      setLocal(prefs)
      setFontSizeText(String(prefs.editorFontSize))
      setLineSpacingText(String(prefs.editorLineSpacing))
    })
  }, [setPreferences])

  useEffect(() => {
    if (activeSection === 'cli') {
      void refreshCliStatus()
    }
  }, [activeSection, refreshCliStatus])

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

  /** Installs or removes the MarkDoc CLI helper on the user's PATH. */
  const handleCliToggle = async () => {
    if (!window.markdoc || cliBusy) return

    setCliBusy(true)
    setCliError(null)

    try {
      const result = local.cliInstalled
        ? await window.markdoc.uninstallCli()
        : await window.markdoc.installCli()

      if (!result.success) {
        setCliError(result.error ?? 'The CLI operation failed.')
        return
      }

      await refreshCliStatus()
    } finally {
      setCliBusy(false)
    }
  }

  const controlClassName =
    'w-44 max-w-full rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm'

  return (
    <div
      className="opaque-window flex h-full min-h-0"
      data-testid="preferences-page"
    >
      {/* Left navigation */}
      <nav
        className="flex w-44 shrink-0 flex-col border-r border-border-subtle bg-[color-mix(in_srgb,var(--surface-sidebar)_70%,var(--surface-primary))] py-4 sm:w-48"
        aria-label="Preferences categories"
      >
        <h1 className="px-4 pb-3 text-sm font-semibold">Preferences</h1>
        <ul className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-accent/12 font-medium text-accent'
                      : 'text-content-text hover:bg-[color-mix(in_srgb,var(--content-text)_6%,transparent)]',
                  ].join(' ')}
                  data-testid={`pref-nav-${id}`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Category content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'appearance' && (
            <section data-testid="pref-section-appearance">
              <PreferenceSectionHeader
                title="Appearance"
                description="Control how MarkDoc looks across the app, including theme and sidebar layout."
              />
              <PreferenceRow
                label="Theme"
                description="Choose whether MarkDoc follows your Mac, or stays in light or dark mode."
                htmlFor="pref-appearance"
              >
                <select
                  id="pref-appearance"
                  value={local.appearance}
                  onChange={(e) => update({ appearance: e.target.value as AppearanceMode })}
                  className={controlClassName}
                  data-testid="pref-appearance"
                >
                  <option value="system">Follow System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </PreferenceRow>
              <PreferenceRow
                label="Sidebar density"
                description="Adjust the height and spacing of rows in the document outline sidebar."
                htmlFor="pref-sidebar-density"
              >
                <select
                  id="pref-sidebar-density"
                  value={local.sidebarDensity}
                  onChange={(e) => update({ sidebarDensity: e.target.value as SidebarDensity })}
                  className={controlClassName}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </PreferenceRow>
            </section>
          )}

          {activeSection === 'editor' && (
            <section data-testid="pref-section-editor">
              <PreferenceSectionHeader
                title="Editor"
                description="Customise the writing surface — typography, spacing, and spelling behaviour."
              />
              <PreferenceRow
                label="Font family"
                description="The typeface used in the editor and preview panes."
                htmlFor="pref-font-family"
              >
                <select
                  id="pref-font-family"
                  value={local.editorFontFamily}
                  onChange={(e) => update({ editorFontFamily: e.target.value })}
                  className={controlClassName}
                  data-testid="pref-font-family"
                >
                  {FONT_FAMILY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </PreferenceRow>
              <PreferenceRow
                label="Font size"
                description="Body text size in the editor, between 12 and 24 points."
                htmlFor="pref-font-size"
              >
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
              <PreferenceRow
                label="Line spacing"
                description="Vertical space between lines of body text."
                htmlFor="pref-line-spacing"
              >
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
                  data-testid="pref-line-spacing"
                />
              </PreferenceRow>
              <PreferenceRow
                label="Spellcheck"
                description="Highlight misspelled words using your Mac's system dictionary."
                htmlFor="pref-spellcheck"
              >
                <input
                  id="pref-spellcheck"
                  type="checkbox"
                  checked={local.spellcheckEnabled}
                  onChange={(e) => update({ spellcheckEnabled: e.target.checked })}
                  data-testid="pref-spellcheck"
                />
              </PreferenceRow>
            </section>
          )}

          {activeSection === 'cli' && (
            <section data-testid="pref-section-cli">
              <PreferenceSectionHeader
                title="Command Line Tool"
                description="Open Markdown files from the terminal with the markdoc command."
              />
              <div className="rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--surface-sidebar)_35%,var(--surface-primary))] p-4">
                <p className="text-sm leading-relaxed text-content-secondary">
                  Installing the CLI helper adds a{' '}
                  <code className="rounded bg-[color-mix(in_srgb,var(--content-text)_6%,transparent)] px-1 py-0.5 font-mono text-xs">
                    markdoc
                  </code>{' '}
                  command to your shell so you can open files directly, for example{' '}
                  <code className="rounded bg-[color-mix(in_srgb,var(--content-text)_6%,transparent)] px-1 py-0.5 font-mono text-xs">
                    markdoc README.md
                  </code>
                  .
                </p>
                <p className="mt-3 text-sm">
                  Status:{' '}
                  <span
                    className={
                      local.cliInstalled
                        ? 'font-medium text-accent'
                        : 'text-content-secondary'
                    }
                  >
                    {local.cliInstalled ? 'Installed' : 'Not installed'}
                  </span>
                </p>
                {cliInstallPath && (
                  <p className="mt-2 text-xs text-content-secondary">
                    Installed at{' '}
                    <code className="rounded bg-[color-mix(in_srgb,var(--content-text)_6%,transparent)] px-1 py-0.5 font-mono">
                      {cliInstallPath}
                    </code>
                  </p>
                )}
                {cliError && (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {cliError}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-4 rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleCliToggle}
                  disabled={cliBusy}
                  data-testid="pref-cli-install"
                >
                  {cliBusy
                    ? local.cliInstalled
                      ? 'Uninstalling…'
                      : 'Installing…'
                    : local.cliInstalled
                      ? 'Uninstall'
                      : 'Install'}{' '}
                  markdoc CLI
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
