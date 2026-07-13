import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Palette, Terminal, Type, Bot } from 'lucide-react'
import { useDocumentStore } from '../store/document-store'
import type { AppearanceMode, SidebarDensity } from '@shared/ipc'
import { DEFAULT_ENABLED_MODEL_IDS } from '@shared/ai/default-models'
import { AI_GATEWAY_KEYS_URL } from '@shared/ai/types'
import { tierModels } from '@shared/ai/model-pricing'
import type { GatewayModelInfo } from '@shared/ai/model-pricing'
import { EnabledModelsSection } from './EnabledModelsSection'
import { EnabledModelSelect } from './EnabledModelSelect'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import {
  formControlClassName,
  formControlWidthClassName,
  formButtonPrimaryClassName,
  formButtonSecondaryClassName,
  formControlSlotClassName,
} from '@renderer/lib/form-control-styles'

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

type SettingsSection = 'appearance' | 'editor' | 'ai' | 'cli'

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: typeof Palette
}[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'ai', label: 'AI', icon: Bot },
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
  align = 'center',
  children,
}: {
  label: string
  description?: string
  htmlFor?: string
  /** Vertically align the control column — use `start` for multi-line controls. */
  align?: 'center' | 'start'
  children: ReactNode
}) {
  return (
    <div
      className={`flex justify-between gap-6 border-b border-border-subtle py-4 last:border-b-0 ${
        align === 'start' ? 'items-start' : 'items-center'
      }`}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">{description}</p>
        )}
      </div>
      <div className={align === 'start' ? 'shrink-0' : formControlSlotClassName}>{children}</div>
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
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [aiModels, setAiModels] = useState<GatewayModelInfo[]>([])
  const [keyTestStatus, setKeyTestStatus] = useState<string | null>(null)
  const [showDisclosure, setShowDisclosure] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)

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

  /** Loads AI key status and model catalogue. */
  const refreshAiStatus = useCallback(async () => {
    if (!window.markdoc) return
    const [hasKey, modelsResult] = await Promise.all([
      window.markdoc.hasAiApiKey(),
      window.markdoc.listAiModels(),
    ])
    setHasApiKey(hasKey)
    setAiModels(modelsResult.models)
  }, [])

  useEffect(() => {
    if (activeSection === 'ai') {
      void refreshAiStatus()
    }
  }, [activeSection, refreshAiStatus])

  const catalogueModels: GatewayModelInfo[] =
    aiModels.length > 0
      ? aiModels
      : DEFAULT_ENABLED_MODEL_IDS.map((id) => ({ id, name: id.split('/').pop() ?? id }))

  const costTiers = tierModels({ models: catalogueModels })

  const handleSaveApiKey = async () => {
    if (!window.markdoc || !apiKeyInput.trim()) return
    setAiBusy(true)
    setKeyTestStatus(null)
    try {
      const test = await window.markdoc.testAiApiKey({ apiKey: apiKeyInput.trim() })
      if (!test.success) {
        setKeyTestStatus(test.error ?? 'API key test failed.')
        return
      }
      await window.markdoc.setAiApiKey({ apiKey: apiKeyInput.trim() })
      setApiKeyInput('')
      setHasApiKey(true)
      setKeyTestStatus('API key saved and verified.')
      await refreshAiStatus()
    } finally {
      setAiBusy(false)
    }
  }

  const handleClearApiKey = async () => {
    if (!window.markdoc) return
    await window.markdoc.clearAiApiKey()
    setHasApiKey(false)
    setKeyTestStatus('API key removed.')
  }

  const handleClearAllConversations = async () => {
    if (!window.markdoc) return
    const confirmed = window.confirm('Clear all assistant conversation history? This cannot be undone.')
    if (!confirmed) return
    await window.markdoc.clearAllConversations()
  }

  const handleAiToggle = async (enabled: boolean) => {
    if (enabled && !local.aiDisclosureAccepted) {
      setShowDisclosure(true)
      return
    }
    await update({ aiEnabled: enabled })
  }

  const handleAcceptDisclosure = async () => {
    setShowDisclosure(false)
    await update({ aiDisclosureAccepted: true, aiEnabled: true })
  }

  const addModelEnabled = async ({ modelId }: { modelId: string }) => {
    setLocal((previous) => {
      if (previous.enabledModelIds.includes(modelId)) return previous

      const enabledModelIds = [...previous.enabledModelIds, modelId]
      void persistPreferences({ enabledModelIds })
      setPreferences({ enabledModelIds })
      return { ...previous, enabledModelIds }
    })
  }

  const removeModelEnabled = async ({ modelId }: { modelId: string }) => {
    if (local.enabledModelIds.length <= 1) return

    const next = local.enabledModelIds.filter((id) => id !== modelId)
    const patch: Partial<typeof local> = { enabledModelIds: next }

    if (local.defaultAssistantModel === modelId) {
      patch.defaultAssistantModel = next[0]
    }
    if (local.defaultAutocompleteModel === modelId) {
      patch.defaultAutocompleteModel = next[0]
    }

    await update(patch)
  }

  const persistPreferences = useCallback(
    async (patch: Partial<typeof local>) => {
      if (window.markdoc) {
        await window.markdoc.setPreferences(patch)
      }
      setPreferences(patch)
    },
    [setPreferences]
  )

  const update = useCallback(
    async (patch: Partial<typeof local>) => {
      setLocal((previous) => ({ ...previous, ...patch }))
      await persistPreferences(patch)
    },
    [persistPreferences]
  )

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

  const openExternalLink = useCallback((url: string) => {
    void window.markdoc.openExternal({ url })
  }, [])

  const controlClassName = `${formControlWidthClassName} ${formControlClassName}`

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
                    'flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-brand-selection font-medium text-brand'
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
                  className={`w-20 ${formControlClassName} [font-variant-numeric:tabular-nums]`}
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
                  className={`w-20 ${formControlClassName} [font-variant-numeric:tabular-nums]`}
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

          {activeSection === 'ai' && (
            <section data-testid="pref-section-ai">
              <PreferenceSectionHeader
                title="AI Assistant"
                description="Connect to Vercel AI Gateway for document-aware writing assistance. AI is off by default and your API key is stored securely in the macOS Keychain."
              />

              <PreferenceRow
                label="Enable AI"
                description="Turn on the assistant panel and AI features. No network requests are made until enabled."
                htmlFor="pref-ai-enabled"
              >
                <Switch
                  id="pref-ai-enabled"
                  checked={local.aiEnabled}
                  onCheckedChange={(checked) => void handleAiToggle(checked)}
                  data-testid="pref-ai-enabled"
                />
              </PreferenceRow>

              {local.aiEnabled && (
                <>
              <PreferenceRow
                label="API key"
                description={
                  hasApiKey
                    ? 'A key is stored in your Keychain. Enter a new key to replace it.'
                    : 'Your Vercel AI Gateway API key. Stored in the macOS Keychain, never in config.json.'
                }
                htmlFor="pref-ai-api-key"
                align="start"
              >
                <div className="flex flex-col items-end gap-2">
                  <input
                    id="pref-ai-api-key"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={hasApiKey ? '••••••••' : 'Enter API key'}
                    className={`w-56 ${formControlClassName}`}
                    data-testid="pref-ai-api-key"
                  />
                  <button
                    type="button"
                    className="text-xs text-brand underline hover:opacity-80"
                    onClick={() => openExternalLink(AI_GATEWAY_KEYS_URL)}
                  >
                    Create a key in Vercel
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={formButtonSecondaryClassName}
                      onClick={() => void handleSaveApiKey()}
                      disabled={aiBusy || !apiKeyInput.trim()}
                    >
                      Save &amp; test
                    </button>
                    {hasApiKey && (
                      <button
                        type="button"
                        className={`${formButtonSecondaryClassName} text-red-600`}
                        onClick={() => void handleClearApiKey()}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {keyTestStatus && (
                    <p className="max-w-xs text-right text-xs text-content-secondary">{keyTestStatus}</p>
                  )}
                </div>
              </PreferenceRow>

              <PreferenceRow
                label="Edit mode"
                description="Suggestion mode shows track-changes for review; Auto applies edits immediately."
                htmlFor="pref-ai-edit-mode"
              >
                <select
                  id="pref-ai-edit-mode"
                  value={local.assistantEditMode}
                  onChange={(e) =>
                    void update({ assistantEditMode: e.target.value as 'suggestion' | 'auto' })
                  }
                  className={controlClassName}
                >
                  <option value="suggestion">Suggestion</option>
                  <option value="auto">Auto</option>
                </select>
              </PreferenceRow>

              <PreferenceRow
                label="Inline autocomplete"
                description="Ghost-text suggestions while typing (separate from the assistant panel)."
                htmlFor="pref-autocomplete-enabled"
              >
                <Switch
                  id="pref-autocomplete-enabled"
                  checked={local.autocompleteEnabled}
                  onCheckedChange={(checked) => void update({ autocompleteEnabled: checked })}
                />
              </PreferenceRow>

              <PreferenceRow
                label="Clear conversation history"
                description="Remove all saved assistant threads from this Mac."
              >
                <button
                  type="button"
                  className={`${formButtonSecondaryClassName} text-red-600`}
                  onClick={() => void handleClearAllConversations()}
                  data-testid="pref-ai-clear-history"
                >
                  Clear all
                </button>
              </PreferenceRow>

              <EnabledModelsSection
                enabledModelIds={local.enabledModelIds}
                catalogueModels={catalogueModels}
                costTiers={costTiers}
                onAddModel={addModelEnabled}
                onRemoveModel={removeModelEnabled}
              />

              <PreferenceRow
                label="Default assistant model"
                description="Model used for chat and document edits."
                htmlFor="pref-ai-default-model"
              >
                <EnabledModelSelect
                  id="pref-ai-default-model"
                  value={local.defaultAssistantModel}
                  enabledModelIds={local.enabledModelIds}
                  catalogueModels={catalogueModels}
                  costTiers={costTiers}
                  showCostTier
                  testId="pref-ai-default-model"
                  onValueChange={({ modelId }) => void update({ defaultAssistantModel: modelId })}
                />
              </PreferenceRow>

              <PreferenceRow
                label="Autocomplete model"
                description="Model used for inline ghost-text completions."
                htmlFor="pref-autocomplete-model"
              >
                <EnabledModelSelect
                  id="pref-autocomplete-model"
                  value={local.defaultAutocompleteModel}
                  enabledModelIds={local.enabledModelIds}
                  catalogueModels={catalogueModels}
                  costTiers={costTiers}
                  testId="pref-autocomplete-model"
                  onValueChange={({ modelId }) => void update({ defaultAutocompleteModel: modelId })}
                />
              </PreferenceRow>
                </>
              )}

              {showDisclosure && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="ai-disclosure-title"
                >
                  <div className="max-w-md rounded-xs border border-border-subtle bg-surface-primary p-6 shadow-xl">
                    <h3 id="ai-disclosure-title" className="text-base font-semibold">
                      AI disclosure
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-content-secondary">
                      When AI is enabled, document content and your prompts are sent to Vercel AI
                      Gateway using your API key. Conversations are stored locally per document.
                      Usage is billed to your Vercel account.
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDisclosure(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="bg-brand text-white hover:bg-brand/90"
                        onClick={() => void handleAcceptDisclosure()}
                        data-testid="pref-ai-disclosure-accept"
                      >
                        I understand
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
                        ? 'font-medium text-brand'
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
                  className={`mt-4 ${formButtonPrimaryClassName} px-4`}
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
