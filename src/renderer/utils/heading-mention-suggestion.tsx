import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import {
  HeadingMentionList,
  type HeadingMentionListRef,
} from '../components/HeadingMentionList'
import type { HeadingMentionItem } from '@shared/extensions/heading-mention'

/**
 * Creates TipTap suggestion render hooks that mount the heading mention popup.
 */
export function createHeadingMentionSuggestionRender() {
  let component: ReactRenderer<HeadingMentionListRef> | null = null
  let popup: HTMLDivElement | null = null

  /**
   * Positions the popup below the caret in the top half of the viewport,
   * and above it in the bottom half so the list stays on screen.
   */
  const updatePosition = ({ clientRect }: { clientRect?: (() => DOMRect | null) | null }) => {
    if (!popup || !clientRect) return
    const rect = clientRect()
    if (!rect) return

    const gap = 4
    const openUpwards = rect.top >= window.innerHeight / 2

    popup.style.left = `${Math.round(rect.left + window.scrollX)}px`

    if (openUpwards) {
      // Place the bottom edge of the popup just above the caret.
      popup.style.top = `${Math.round(rect.top + window.scrollY - gap)}px`
      popup.style.transform = 'translateY(-100%)'
    } else {
      popup.style.top = `${Math.round(rect.bottom + window.scrollY + gap)}px`
      popup.style.transform = ''
    }
  }

  return {
    onStart: (props: SuggestionProps<HeadingMentionItem>) => {
      component = new ReactRenderer(HeadingMentionList, {
        props: {
          items: props.items,
          command: (item: { headingId: string }) => {
            props.command(item as HeadingMentionItem)
          },
        },
        editor: props.editor,
      })

      popup = document.createElement('div')
      popup.className = 'heading-mention-popup'
      popup.appendChild(component.element)
      document.body.appendChild(popup)
      updatePosition({ clientRect: props.clientRect })
    },

    onUpdate: (props: SuggestionProps<HeadingMentionItem>) => {
      component?.updateProps({
        items: props.items,
        command: (item: { headingId: string }) => {
          props.command(item as HeadingMentionItem)
        },
      })
      updatePosition({ clientRect: props.clientRect })
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === 'Escape') {
        popup?.remove()
        popup = null
        component?.destroy()
        component = null
        return true
      }
      return component?.ref?.onKeyDown(props) ?? false
    },

    onExit: () => {
      popup?.remove()
      popup = null
      component?.destroy()
      component = null
    },
  }
}
