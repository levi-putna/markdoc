import DOMPurify from 'dompurify'
import { useEffect, useMemo, useRef, useState } from 'react'
import { renderMermaidBlocksInContainer } from '../utils/mermaid'
import { resolveImagesInHtml } from '../utils/resolve-image-src'
import { useDocumentStore } from '../store/document-store'

interface PreviewPaneProps {
  html: string
  scrollTop?: number
  scrollRatio?: number | null
  onScroll?: (scrollTop: number) => void
  onScrollRatio?: (ratio: number) => void
}

/**
 * Read-only preview pane rendering sanitised HTML content.
 */
export function PreviewPane({ html, scrollTop, scrollRatio, onScroll, onScrollRatio }: PreviewPaneProps) {
  const filePath = useDocumentStore((state) => state.filePath)
  const [resolvedHtml, setResolvedHtml] = useState(html)
  const sanitised = useMemo(() => DOMPurify.sanitize(resolvedHtml, { ADD_TAGS: ['style'] }), [resolvedHtml])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void resolveImagesInHtml({ html, documentPath: filePath }).then((next) => {
      if (!cancelled) setResolvedHtml(next)
    })
    return () => {
      cancelled = true
    }
  }, [html, filePath])

  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const isDark = document.documentElement.classList.contains('dark')
    void renderMermaidBlocksInContainer({ container, isDark })
  }, [sanitised])

  return (
    <div
      className="h-full overflow-y-auto bg-surface-primary"
      data-testid="preview-pane"
      onScroll={(e) => {
        const el = e.currentTarget
        onScroll?.(el.scrollTop)
        const maxScroll = el.scrollHeight - el.clientHeight
        onScrollRatio?.(maxScroll > 0 ? el.scrollTop / maxScroll : 0)
      }}
      ref={(el) => {
        if (!el) return
        if (scrollRatio != null) {
          const maxScroll = el.scrollHeight - el.clientHeight
          const top = maxScroll * scrollRatio
          if (Math.abs(el.scrollTop - top) > 10) {
            el.scrollTop = top
          }
        } else if (scrollTop != null && Math.abs(el.scrollTop - scrollTop) > 10) {
          el.scrollTop = scrollTop
        }
      }}
    >
      {/* Preview content */}
      <div
        ref={contentRef}
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
