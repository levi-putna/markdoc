import DOMPurify from 'dompurify'
import { useMemo } from 'react'

interface PreviewPaneProps {
  html: string
  scrollTop?: number
  onScroll?: (scrollTop: number) => void
}

/**
 * Read-only preview pane rendering sanitised HTML content.
 */
export function PreviewPane({ html, scrollTop, onScroll }: PreviewPaneProps) {
  const sanitised = useMemo(() => DOMPurify.sanitize(html, { ADD_TAGS: ['style'] }), [html])

  return (
    <div
      className="h-full overflow-y-auto bg-surface-primary"
      data-testid="preview-pane"
      onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}
      ref={(el) => {
        if (el && scrollTop != null && Math.abs(el.scrollTop - scrollTop) > 10) {
          el.scrollTop = scrollTop
        }
      }}
    >
      {/* Preview content */}
      <div
        className="preview-content prose"
        dangerouslySetInnerHTML={{ __html: sanitised }}
      />
    </div>
  )
}

/**
 * Converts editor HTML to preview-safe HTML.
 */
export function editorHtmlToPreview(html: string): string {
  return DOMPurify.sanitize(html)
}
