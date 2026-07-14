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
  onHeadingClick?: (headingId: string) => void
}

/**
 * Read-only preview pane rendering sanitised HTML content.
 */
export function PreviewPane({
  html,
  scrollTop,
  scrollRatio,
  onScroll,
  onScrollRatio,
  onHeadingClick,
}: PreviewPaneProps) {
  const filePath = useDocumentStore((state) => state.filePath)
  const [resolvedHtml, setResolvedHtml] = useState(html)
  const sanitised = useMemo(
    () =>
      DOMPurify.sanitize(resolvedHtml, {
        ADD_TAGS: ['style'],
        ADD_ATTR: ['data-heading-id', 'data-heading-mention', 'data-broken'],
        // Allow Markdoc heading:// anchors used by @heading mentions.
        ALLOWED_URI_REGEXP:
          /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|heading|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
      }),
    [resolvedHtml]
  )
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
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        const mention = target?.closest?.('[data-heading-mention], a[href^="heading://"]') as
          | HTMLElement
          | null
        if (!mention) return
        event.preventDefault()
        const headingId =
          mention.getAttribute('data-heading-id') ??
          mention.getAttribute('href')?.replace(/^heading:\/\//, '') ??
          null
        if (!headingId || mention.getAttribute('data-broken') === 'true') return

        // Scroll the preview pane to the matching heading when it is present.
        const headingEl = contentRef.current?.querySelector(
          `[data-heading-id="${CSS.escape(headingId)}"]`
        )
        if (headingEl instanceof HTMLElement) {
          headingEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }

        onHeadingClick?.(headingId)
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
