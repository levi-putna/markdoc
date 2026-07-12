import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { renderMermaidDiagram } from '../utils/mermaid'

interface MermaidDiagramProps {
  source: string
  isDark?: boolean
  className?: string
}

/**
 * Inline Mermaid diagram preview with IntersectionObserver gating (TR-12.6)
 * so off-screen diagrams do not pay render cost until scrolled near.
 */
export function MermaidDiagram({ source, isDark = false, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { rootMargin: '240px 0px' }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setIsLoading(true)
      const result = await renderMermaidDiagram({ source, isDark })
      if (cancelled) return
      setSvg(result.svg)
      setError(result.error)
      setIsLoading(false)
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [source, isDark, isVisible])

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram-mount ${className}`.trim()}
      data-testid="mermaid-diagram"
      contentEditable={false}
    >
      {/* Loading state */}
      {!svg && !error && (isLoading || isVisible) && (
        <div className="mermaid-diagram-loading" aria-hidden>
          <Loader2 size={18} className="animate-spin text-content-secondary" />
        </div>
      )}

      {/* Rendered diagram */}
      {svg && <div className="mermaid-diagram-svg" dangerouslySetInnerHTML={{ __html: svg }} />}

      {/* Inline error placeholder (FR-8.3) */}
      {error && (
        <div className="mermaid-diagram-mount--error" role="alert">
          <div className="mermaid-diagram-error-header">
            <AlertTriangle size={14} aria-hidden />
            <p className="mermaid-diagram-error-title">Diagram error</p>
          </div>
          <p className="mermaid-diagram-error-message">{error}</p>
          <pre className="mermaid-diagram-error-source">
            <code>{source}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
