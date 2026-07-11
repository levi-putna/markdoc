import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import MiniSearch from 'minisearch'
import { Search, X } from 'lucide-react'
import type { SearchResult } from '@shared/types'
import { useDocumentStore } from '../store/document-store'

interface SearchOverlayProps {
  markdown: string
  outlineTexts: Array<{ text: string; pos: number }>
  onSelect: (pos: number) => void
  onClose: () => void
}

/**
 * Document search overlay with ranked fuzzy matching.
 */
export function SearchOverlay({ markdown, outlineTexts, onSelect, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const selectedResultRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Restore focus to the trigger element when the overlay closes
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    return () => {
      previousFocusRef.current?.focus()
    }
  }, [])

  const searchIndex = useMemo(() => {
    const ms = new MiniSearch<{ id: string; text: string; type: string; pos: number }>({
      fields: ['text'],
      storeFields: ['text', 'type', 'pos'],
    })

    const docs: Array<{ id: string; text: string; type: string; pos: number }> = []

    outlineTexts.forEach((h, i) => {
      docs.push({ id: `heading-${i}`, text: h.text, type: 'heading', pos: h.pos })
    })

    const lines = markdown.split('\n')
    let charPos = 0
    lines.forEach((line, i) => {
      if (line.trim() && !line.startsWith('#')) {
        docs.push({ id: `body-${i}`, text: line.trim(), type: 'body', pos: charPos })
      }
      charPos += line.length + 1
    })

    ms.addAll(docs)
    return ms
  }, [markdown, outlineTexts])

  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return []
    const raw = searchIndex.search(query, { fuzzy: 0.2, prefix: true })
    return raw
      .map((r) => ({
        id: r.id,
        text: r.text as string,
        type: (r.type as 'heading' | 'body') ?? 'body',
        pos: r.pos as number,
        score: r.score,
      }))
      .sort((a, b) => {
        if (a.type === 'heading' && b.type !== 'heading') return -1
        if (b.type === 'heading' && a.type !== 'heading') return 1
        return b.score - a.score
      })
  }, [query, searchIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        onSelect(results[selectedIndex].pos)
        onClose()
      } else if (e.key === 'Tab') {
        // Trap focus within the overlay while it is open
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'input, button:not([disabled])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [results, selectedIndex, onSelect, onClose]
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keep the keyboard-selected result in view while arrowing through the list
  useEffect(() => {
    selectedResultRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh]"
      onMouseDown={onClose}
      data-testid="search-overlay"
    >
      {/* Search panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search document"
        className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface-primary shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <Search size={16} className="text-content-secondary" aria-hidden />
          <input
            type="text"
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Search document…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results-list"
            data-testid="search-input"
          />
          <button
            type="button"
            className="toolbar-icon-btn toolbar-icon-btn--header"
            onClick={onClose}
            aria-label="Close search"
          >
            <X />
          </button>
        </div>

        <div id="search-results-list" className="max-h-80 overflow-y-auto" role="listbox">
          {query && results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-content-secondary" data-testid="search-no-results">
              No results found
            </p>
          ) : (
            results.map((result, i) => (
              <button
                key={result.id}
                ref={i === selectedIndex ? selectedResultRef : undefined}
                type="button"
                role="option"
                aria-selected={i === selectedIndex}
                className={`flex w-full flex-col px-4 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 ${
                  i === selectedIndex ? 'bg-accent/10' : ''
                }`}
                onClick={() => {
                  onSelect(result.pos)
                  onClose()
                }}
                data-testid={`search-result-${result.id}`}
              >
                <span className="text-[11px] uppercase text-content-secondary">
                  {result.type}
                </span>
                <span className="truncate text-sm">{highlightMatch(result.text, query)}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer — result count + keyboard hints */}
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-1.5 text-[11px] text-content-secondary">
          <span aria-live="polite" data-testid="search-result-count">
            {query
              ? `${results.length.toLocaleString()} ${results.length === 1 ? 'result' : 'results'}`
              : 'Type to search'}
          </span>
          <span aria-hidden>↑↓ navigate&ensp;↩ open&ensp;esc close</span>
        </div>
      </div>
    </div>
  )
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/25">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/**
 * Hook to open/close search from keyboard shortcut.
 */
export function useSearchShortcut(): void {
  const { setSearchOpen } = useDocumentStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])
}
