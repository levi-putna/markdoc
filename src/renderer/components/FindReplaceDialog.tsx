import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import { chunkedFindMatches } from '@shared/chunked-scan'

interface FindReplaceDialogProps {
  markdown: string
  onReplace: ({ markdown }: { markdown: string }) => void
  onClose: () => void
}

/**
 * In-document find and replace overlay (FR-2.4).
 */
export function FindReplaceDialog({ markdown, onReplace, onClose }: FindReplaceDialogProps) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matches, setMatches] = useState<Array<{ index: number; length: number }>>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const scanMatches = useCallback(async () => {
    if (!findText) {
      setMatches([])
      setCurrentIndex(0)
      return
    }

    if (caseSensitive) {
      const localMatches: Array<{ index: number; length: number }> = []
      let searchFrom = 0
      let idx = markdown.indexOf(findText, searchFrom)
      while (idx !== -1) {
        localMatches.push({ index: idx, length: findText.length })
        searchFrom = idx + 1
        idx = markdown.indexOf(findText, searchFrom)
      }
      setMatches(localMatches)
      setCurrentIndex(0)
      return
    }

    const found = await chunkedFindMatches({ text: markdown, query: findText })
    setMatches(found)
    setCurrentIndex(0)
  }, [markdown, findText, caseSensitive])

  useEffect(() => {
    void scanMatches()
  }, [scanMatches])

  const handleReplaceOne = () => {
    const match = matches[currentIndex]
    if (!match || !findText) return
    const next =
      markdown.slice(0, match.index) +
      replaceText +
      markdown.slice(match.index + match.length)
    onReplace({ markdown: next })
  }

  const handleReplaceAll = () => {
    if (!findText) return
    const pattern = caseSensitive ? findText : new RegExp(escapeRegex(findText), 'gi')
    const next = caseSensitive
      ? markdown.split(findText).join(replaceText)
      : markdown.replace(pattern, replaceText)
    onReplace({ markdown: next })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose()
    } else if (event.key === 'Enter' && event.metaKey) {
      handleReplaceOne()
    } else if (event.key === 'F3' || (event.metaKey && event.key === 'g')) {
      event.preventDefault()
      if (matches.length === 0) return
      setCurrentIndex((index) => (index + 1) % matches.length)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh]"
      onMouseDown={onClose}
      data-testid="find-replace-dialog"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find and replace"
        className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-primary shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Find row */}
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <Search size={16} className="text-content-secondary" aria-hidden />
          <input
            type="text"
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Find"
            value={findText}
            onChange={(event) => setFindText(event.target.value)}
            autoFocus
            data-testid="find-input"
          />
          <span className="text-[11px] text-content-secondary tabular-nums">
            {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '0/0'}
          </span>
          <button
            type="button"
            className="toolbar-icon-btn toolbar-icon-btn--header"
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            aria-label="Previous match"
            disabled={matches.length === 0}
          >
            <ChevronUp />
          </button>
          <button
            type="button"
            className="toolbar-icon-btn toolbar-icon-btn--header"
            onClick={() =>
              setCurrentIndex((index) => (matches.length ? (index + 1) % matches.length : 0))
            }
            aria-label="Next match"
            disabled={matches.length === 0}
          >
            <ChevronDown />
          </button>
          <button
            type="button"
            className="toolbar-icon-btn toolbar-icon-btn--header"
            onClick={onClose}
            aria-label="Close find and replace"
          >
            <X />
          </button>
        </div>

        {/* Replace row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            type="text"
            className="flex-1 rounded border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none"
            placeholder="Replace with"
            value={replaceText}
            onChange={(event) => setReplaceText(event.target.value)}
            data-testid="replace-input"
          />
        </div>

        {/* Options + actions */}
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2">
          <label className="flex items-center gap-2 text-[11px] text-content-secondary">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            Match case
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"
              onClick={handleReplaceOne}
              disabled={matches.length === 0}
            >
              Replace
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"
              onClick={handleReplaceAll}
              disabled={!findText}
            >
              Replace All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
