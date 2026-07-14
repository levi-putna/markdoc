import { Settings2, X } from 'lucide-react'
import { useDocumentStore } from '../store/document-store'
import { Switch } from '@renderer/components/ui/switch'
import {
  FormChoiceCard,
  FormChoiceGroup,
  FormExamplePreview,
  FormSection,
  FormToggleRow,
} from '@renderer/components/form/FormLayout'
import {
  formExampleTextClassName,
  formFieldDescriptionClassName,
  formPanelBodyClassName,
  formPanelSectionStackClassName,
  formSectionStackClassName,
} from '@renderer/lib/form-control-styles'
import {
  getPresetPreviewLabels,
  type DisplayMode,
  type NumberingPreset,
} from '@shared/heading-numbering'

const PRESET_OPTIONS: Array<{
  value: NumberingPreset
  label: string
  description: string
  example: string
}> = [
  {
    value: 'decimal',
    label: 'Decimal / Legal',
    description: 'Technical specs and contracts',
    example: '1, 1.1, 1.2, 1.2.1',
  },
  {
    value: 'classic',
    label: 'Classic outline',
    description: 'Academic papers and formal reports',
    example: 'I, A, 1, a, i',
  },
  {
    value: 'legalMilitary',
    label: 'Legal / Military',
    description: 'Government and engineering documents',
    example: '1.0, 1.1, 1.1.1',
  },
  {
    value: 'chapter',
    label: 'Chapter-based',
    description: 'Books and long-form documents',
    example: 'Chapter 1, 1.1, 1.2',
  },
]

const DISPLAY_OPTIONS: Array<{
  value: DisplayMode
  label: string
  description: string
  example: string
}> = [
  {
    value: 'full',
    label: 'Full path',
    description: 'Every level in the hierarchy',
    example: '1.2.3',
  },
  {
    value: 'lastTwoSegments',
    label: 'Last two levels',
    description: 'Omit higher parents',
    example: '.2.3',
  },
  {
    value: 'lastSegment',
    label: 'Final level only',
    description: 'Show only the leaf number',
    example: '.3',
  },
]

/** Mock heading titles paired with preview label indices from getPresetPreviewLabels. */
const PREVIEW_HEADINGS: Array<{ level: 1 | 2 | 3; title: string }> = [
  { level: 1, title: 'Introduction' },
  { level: 2, title: 'Background' },
  { level: 3, title: 'Context' },
  { level: 3, title: 'Scope' },
  { level: 2, title: 'Objectives' },
  { level: 1, title: 'Methods' },
  { level: 2, title: 'Participants' },
]

const DEFAULT_WIDTH = 320
const MIN_WIDTH = 260
const MAX_WIDTH = 480

interface DocumentOptionsPanelProps {
  onNumberingChange: () => void
}

/**
 * Right-docked document options panel (mutually exclusive with the assistant).
 */
export function DocumentOptionsPanel({ onNumberingChange }: DocumentOptionsPanelProps) {
  const {
    rightPanelWidth,
    setRightPanelWidth,
    closeRightPanel,
    numberingConfig,
    setNumberingConfig,
    numberingOverrides,
    setNumberingOverrides,
  } = useDocumentStore()

  /**
   * Persists numbering config and notifies the parent to re-sync headings.
   */
  const updateConfig = ({
    patch,
  }: {
    patch: Partial<typeof numberingConfig>
  }) => {
    const next = { ...numberingConfig, ...patch }
    if (patch.preset === 'legalMilitary') {
      next.trailingZero = true
    } else if (patch.preset !== undefined) {
      next.trailingZero = false
    }
    setNumberingConfig(next)
    onNumberingChange()
  }

  /**
   * Starts a left-edge resize drag for the panel width.
   */
  const handleResizeStart = (event: React.MouseEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = rightPanelWidth || DEFAULT_WIDTH
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setRightPanelWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta)))
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const previewLabels = numberingConfig.enabled
    ? getPresetPreviewLabels({
        preset: numberingConfig.preset,
        displayMode: numberingConfig.displayMode,
      })
    : []

  const overrideCount = Object.keys(numberingOverrides).length

  return (
    <aside
      className="assistant-panel relative flex h-full shrink-0 flex-col border-l border-border-subtle bg-surface-primary"
      style={{ width: rightPanelWidth || DEFAULT_WIDTH }}
      data-testid="document-options-panel"
    >
      {/* Left-edge resize handle */}
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-brand/30"
        aria-hidden
        onMouseDown={handleResizeStart}
      />

      {/* Panel header */}
      <div className="sidebar-toolbar">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-content-secondary">
          <Settings2 size={14} aria-hidden />
          Document Options
        </div>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={closeRightPanel}
          aria-label="Close document options"
        >
          <X />
        </button>
      </div>

      <div className={formPanelBodyClassName}>
        <div className={formPanelSectionStackClassName}>
          {/* Master on/off — always visible */}
          <FormSection
            title="Heading numbering"
            id="numbering-heading"
            description={
              numberingConfig.enabled
                ? undefined
                : 'Add multilevel numbers to headings in the outline and document.'
            }
          >
            <FormToggleRow label="Enable multilevel numbering" htmlFor="numbering-enable-toggle">
              <Switch
                id="numbering-enable-toggle"
                checked={numberingConfig.enabled}
                onCheckedChange={(enabled) => {
                  if (!enabled) {
                    setNumberingOverrides({})
                  }
                  updateConfig({
                    patch: {
                      enabled,
                      ...(enabled
                        ? { showNumbersInMentions: numberingConfig.showNumbersInMentions ?? true }
                        : {}),
                    },
                  })
                }}
                data-testid="numbering-enable-toggle"
              />
            </FormToggleRow>
          </FormSection>

          {numberingConfig.enabled && (
            <>
              {/* Which numbering system to use */}
              <FormSection
                title="Numbering style"
                id="numbering-style"
                description="The scheme used for heading levels."
              >
                <FormChoiceGroup legend="Numbering style" hideLegend>
                  {PRESET_OPTIONS.map((option) => (
                    <FormChoiceCard
                      key={option.value}
                      name="numbering-preset"
                      value={option.value}
                      label={option.label}
                      description={option.description}
                      example={option.example}
                      checked={numberingConfig.preset === option.value}
                      onChange={() => updateConfig({ patch: { preset: option.value } })}
                    />
                  ))}
                </FormChoiceGroup>
              </FormSection>

              {/* How much of the path appears on each heading */}
              <FormSection
                title="Visible segments"
                id="numbering-display"
                description="How much of the number path appears on each heading."
              >
                <FormChoiceGroup legend="Visible segments" hideLegend>
                  {DISPLAY_OPTIONS.map((option) => (
                    <FormChoiceCard
                      key={option.value}
                      name="numbering-display-mode"
                      value={option.value}
                      label={option.label}
                      description={option.description}
                      example={option.example}
                      checked={(numberingConfig.displayMode ?? 'full') === option.value}
                      onChange={() => updateConfig({ patch: { displayMode: option.value } })}
                    />
                  ))}
                </FormChoiceGroup>
              </FormSection>

              {/* Combined result of style + visible segments */}
              <div className={formSectionStackClassName}>
                {previewLabels.length > 0 && (
                  <FormExamplePreview title="With your current settings" testId="numbering-preview">
                    <ul className="space-y-0.5" aria-hidden>
                      {previewLabels.map((label, index) => {
                        const heading = PREVIEW_HEADINGS[index]
                        if (!heading) return null
                        return (
                          <li
                            key={`${label}-${index}`}
                            className="flex items-baseline gap-2 text-xs leading-snug"
                            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
                          >
                            <span className={`shrink-0 ${formExampleTextClassName}`}>{label}</span>
                            <span className="text-content-secondary">{heading.title}</span>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="mt-1.5 text-[10px] leading-snug text-content-secondary">
                      Illustrative headings only — not from your document.
                    </p>
                  </FormExamplePreview>
                )}

                {overrideCount > 0 && (
                  <p className={formFieldDescriptionClassName}>
                    {overrideCount} heading{' '}
                    {overrideCount === 1 ? 'has' : 'have'} a numbering override for children.
                    Right-click a heading in the outline to change overrides.
                  </p>
                )}
              </div>

              {/* Where numbers also appear outside the document body */}
              <FormSection
                title="@ Mentions"
                id="numbering-mentions"
                description="Controls whether numbers appear when you reference a heading with @."
              >
                <FormToggleRow
                  label="Show numbers in @ mentions"
                  htmlFor="numbering-mentions-toggle"
                >
                  <Switch
                    id="numbering-mentions-toggle"
                    checked={numberingConfig.showNumbersInMentions ?? true}
                    onCheckedChange={(showNumbersInMentions) =>
                      updateConfig({ patch: { showNumbersInMentions } })
                    }
                    data-testid="numbering-mentions-toggle"
                  />
                </FormToggleRow>
              </FormSection>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
