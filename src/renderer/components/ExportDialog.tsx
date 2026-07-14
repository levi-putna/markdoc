import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import type { ExportFormat, ExportResult } from '@shared/ipc'
import { collectPreviewCss, isDarkThemeActive } from '../utils/export-styles'
import { renderMermaidBlocksInHtml } from '../utils/mermaid'
import { prepareDocJsonForExport } from '../utils/mermaid-export'
import { prepareHtmlForExport } from '@shared/heading-mention-export'

interface ExportDialogProps {
  editor: Editor | null
  filePath: string | null
  onClose: () => void
}

const FORMAT_OPTIONS: { format: ExportFormat; label: string; extension: string }[] = [
  { format: 'pdf', label: 'PDF', extension: 'pdf' },
  { format: 'docx', label: 'Word', extension: 'docx' },
  { format: 'html', label: 'HTML', extension: 'html' },
]

/** How long an export can run before the progress overlay replaces the form (TR-10.4). */
const PROGRESS_DELAY_MS = 1000

/**
 * Returns the document's directory (POSIX-style, matching macOS paths) so
 * relative image sources inside the document can be resolved during export
 * — there's no Node `path` module available in this sandboxed renderer.
 */
function getDirectory(filePath: string | null): string | null {
  if (!filePath || !filePath.includes('/')) return null
  return filePath.slice(0, filePath.lastIndexOf('/'))
}

function getTitle(filePath: string | null): string {
  const base = filePath?.split('/').pop() ?? 'Untitled'
  return base.replace(/\.(md|markdown|mdown|mkd)$/i, '')
}

/**
 * Export dialog (FR-11.3) — lets the user choose PDF/Word/HTML plus PDF page
 * size and margins, then hands off to the native save panel and the
 * matching export IPC call. All three formats reuse the same live editor
 * content and computed CSS, so output always matches Preview (FR-9.6).
 */
export function ExportDialog({ editor, filePath, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4')
  const [marginInches, setMarginInches] = useState(0.5)
  const [phase, setPhase] = useState<'idle' | 'exporting' | 'error'>('idle')
  const [showProgress, setShowProgress] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'exporting') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, phase])

  const title = getTitle(filePath)
  const selectedFormat = FORMAT_OPTIONS.find((option) => option.format === format) ?? FORMAT_OPTIONS[0]

  const handleExport = async () => {
    if (!window.markdoc || !editor) return

    setErrorMessage(null)
    setPhase('exporting')
    const progressTimer = setTimeout(() => setShowProgress(true), PROGRESS_DELAY_MS)

    try {
      const destinationPath = await window.markdoc.exportDialog(format, `${title}.${selectedFormat.extension}`)
      if (!destinationPath) {
        setPhase('idle')
        return
      }

      const isDark = isDarkThemeActive()
      let result: ExportResult
      const exportWarnings: string[] = []

      if (format === 'docx') {
        const prepared = await prepareDocJsonForExport({ doc: editor.getJSON(), isDark })
        exportWarnings.push(...prepared.warnings)
        result = await window.markdoc.exportDocx({
          doc: prepared.doc,
          title,
          documentDir: getDirectory(filePath),
          destinationPath,
        })
      } else {
        const rendered = await renderMermaidBlocksInHtml({ html: editor.getHTML(), isDark })
        exportWarnings.push(...rendered.warnings)
        const bodyHtml = prepareHtmlForExport({ html: rendered.html })
        const css = collectPreviewCss()

        result =
          format === 'pdf'
            ? await window.markdoc.exportPdf({
                bodyHtml,
                css,
                isDark,
                title,
                destinationPath,
                pageSize,
                margins: { top: marginInches, bottom: marginInches, left: marginInches, right: marginInches },
              })
            : await window.markdoc.exportHtml({ bodyHtml, css, isDark, title, destinationPath })
      }

      if (!result.success) {
        setPhase('error')
        setErrorMessage(result.error ?? 'Export failed.')
        return
      }

      const warnings = [...exportWarnings, ...(result.warnings ?? [])]
      if (warnings.length > 0) {
        window.alert(`Exported with warnings:\n\n${warnings.join('\n')}`)
      }

      onClose()
    } catch (error) {
      setPhase('error')
      setErrorMessage((error as Error).message ?? 'Export failed.')
    } finally {
      clearTimeout(progressTimer)
      setShowProgress(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={phase === 'exporting' ? undefined : onClose}
      data-testid="export-dialog"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Export document"
        className="w-full max-w-sm rounded-lg border border-border-subtle bg-surface-primary p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showProgress ? (
          // Progress state — shown only once export has run past the 1s
          // threshold, so quick exports never flash a spinner (TR-10.4).
          <div className="flex flex-col items-center gap-3 py-6" data-testid="export-progress">
            <Loader2 size={24} className="animate-spin text-accent" aria-hidden />
            <p className="text-sm text-content-secondary">
              Exporting {title}.{selectedFormat.extension}…
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-content-text">Export To…</h2>
              <button
                type="button"
                className="toolbar-icon-btn"
                onClick={onClose}
                aria-label="Close"
                disabled={phase === 'exporting'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Format selector */}
            <div className="view-mode-tabs mb-4" role="tablist" aria-label="Export format">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.format}
                  type="button"
                  role="tab"
                  aria-selected={format === option.format}
                  className={`view-mode-tab ${format === option.format ? 'view-mode-tab--active' : ''}`}
                  onClick={() => setFormat(option.format)}
                  data-testid={`export-format-${option.format}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* PDF-only options */}
            {format === 'pdf' && (
              <div className="mb-4 flex gap-3">
                <label className="flex-1 text-xs text-content-secondary">
                  Page size
                  <select
                    className="mt-1 block w-full rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm text-content-text"
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as 'A4' | 'Letter')}
                    data-testid="export-page-size"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">US Letter</option>
                  </select>
                </label>
                <label className="flex-1 text-xs text-content-secondary">
                  Margins (in)
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    className="mt-1 block w-full rounded-md border border-border-subtle bg-transparent px-2 py-1.5 text-sm text-content-text"
                    value={marginInches}
                    onChange={(e) => setMarginInches(Number(e.target.value))}
                    data-testid="export-margins"
                  />
                </label>
              </div>
            )}

            {/* Error banner */}
            {phase === 'error' && errorMessage && (
              <div
                className="mb-4 flex items-start gap-2 rounded-md bg-[var(--status-error)]/10 p-2.5 text-xs text-[var(--status-error)]"
                role="alert"
                data-testid="export-error"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-content-secondary hover:bg-black/5 dark:hover:bg-white/5"
                onClick={onClose}
                disabled={phase === 'exporting'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                onClick={handleExport}
                disabled={phase === 'exporting' || !editor}
                data-testid="export-confirm"
              >
                {phase === 'exporting' ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
