import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react'
import type { ResolvedHeading } from '@shared/heading-mention-resolve'
import { formatHeadingMentionDisplay } from '@shared/heading-mention-resolve'
import { useDocumentStore } from '../store/document-store'

export interface HeadingMentionPickPayload {
  headingId: string
  label: string
}

export interface HeadingMentionListProps {
  items: ResolvedHeading[]
  command: (item: HeadingMentionPickPayload) => void
}

export interface HeadingMentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/**
 * Suggestion popup listing document headings for `@` mentions and broken-mention relinks.
 */
export const HeadingMentionList = forwardRef<HeadingMentionListRef, HeadingMentionListProps>(
  function HeadingMentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const numberingEnabled = useDocumentStore((s) => s.numberingConfig.enabled)
    const showNumbersInMentions = useDocumentStore(
      (s) => s.numberingConfig.showNumbersInMentions ?? true
    )
    const headingNumbers = useDocumentStore((s) => s.headingNumbers)
    const showMentionNumbers = numberingEnabled && showNumbersInMentions

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (!item) return
        command({ headingId: item.headingId, label: item.text })
      },
      [command, items]
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((current) => (current + items.length - 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((current) => (current + 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="heading-mention-list" data-testid="heading-mention-list">
          {/* Empty state when the document has no headings to mention */}
          <p className="heading-mention-list__empty">No headings found</p>
        </div>
      )
    }

    return (
      <div className="heading-mention-list" data-testid="heading-mention-list" role="listbox">
        {items.map((item, index) => {
          const numberLabel = showMentionNumbers
            ? headingNumbers[item.headingId]
            : undefined
          const displayText = formatHeadingMentionDisplay({
            title: item.text,
            numberLabel,
            showNumber: showMentionNumbers,
          })

          return (
            <button
              key={item.headingId}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={`heading-mention-list__item${
                index === selectedIndex ? ' heading-mention-list__item--selected' : ''
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectItem(index)}
            >
              {/* Number badge when enabled; otherwise H-level */}
              <span className="heading-mention-list__level">
                {numberLabel ?? `H${item.level}`}
              </span>
              {/* Heading title as it will appear in the mention chip */}
              <span className="heading-mention-list__text">{displayText}</span>
            </button>
          )
        })}
      </div>
    )
  }
)
