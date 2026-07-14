import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react'
import type { ResolvedHeading } from '@shared/heading-mention-resolve'

export interface HeadingMentionListProps {
  items: ResolvedHeading[]
  command: (item: { headingId: string }) => void
}

export interface HeadingMentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/**
 * Suggestion popup listing document headings for `@` mentions.
 */
export const HeadingMentionList = forwardRef<HeadingMentionListRef, HeadingMentionListProps>(
  function HeadingMentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (!item) return
        command({ headingId: item.headingId })
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
          <p className="heading-mention-list__empty">No headings found</p>
        </div>
      )
    }

    return (
      <div className="heading-mention-list" data-testid="heading-mention-list" role="listbox">
        {items.map((item, index) => (
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
            {/* Heading level badge */}
            <span className="heading-mention-list__level">H{item.level}</span>
            {/* Heading title */}
            <span className="heading-mention-list__text">{item.text}</span>
          </button>
        ))}
      </div>
    )
  }
)
