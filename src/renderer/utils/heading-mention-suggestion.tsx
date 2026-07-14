import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import {
  HeadingMentionList,
  type HeadingMentionListRef,
} from '../components/HeadingMentionList'
import type { HeadingMentionItem } from '@shared/extensions/heading-mention'
import { shouldOpenMentionPopupUpwards } from '@shared/heading-mention-resolve'

/**
 * Positions the live `@` suggestion popup; shared geometry with the relink picker.
 */
function positionSuggestionPopup({
  popup,
  clientRect,
}: {
  popup: HTMLDivElement
  clientRect?: (() => DOMRect | null) | null
}): void {
  if (!clientRect) return
  const rect = clientRect()
  if (!rect) return

  const gap = 4
  const openUpwards = shouldOpenMentionPopupUpwards({
    caretTop: rect.top,
    viewportHeight: window.innerHeight,
  })

  popup.style.left = `${Math.round(rect.left + window.scrollX)}px`

  if (openUpwards) {
    popup.style.top = `${Math.round(rect.top + window.scrollY - gap)}px`
    popup.style.transform = 'translateY(-100%)'
  } else {
    popup.style.top = `${Math.round(rect.bottom + window.scrollY + gap)}px`
    popup.style.transform = ''
  }
}

/**
 * Creates TipTap suggestion render hooks that mount the heading mention popup
 * while typing `@`. Broken-mention relinking uses the separate picker utility.
 */
export function createHeadingMentionSuggestionRender() {
  let component: ReactRenderer<HeadingMentionListRef> | null = null
  let popup: HTMLDivElement | null = null

  return {
    onStart: (props: SuggestionProps<HeadingMentionItem>) => {
      component = new ReactRenderer(HeadingMentionList, {
        props: {
          items: props.items,
          command: (pick: { headingId: string; label: string }) => {
            props.command({
              headingId: pick.headingId,
              text: pick.label,
            } as HeadingMentionItem)
          },
        },
        editor: props.editor,
      })

      popup = document.createElement('div')
      popup.className = 'heading-mention-popup'
      popup.appendChild(component.element)
      document.body.appendChild(popup)
      positionSuggestionPopup({ popup, clientRect: props.clientRect })
    },

    onUpdate: (props: SuggestionProps<HeadingMentionItem>) => {
      component?.updateProps({
        items: props.items,
        command: (pick: { headingId: string; label: string }) => {
          props.command({
            headingId: pick.headingId,
            text: pick.label,
          } as HeadingMentionItem)
        },
      })
      if (popup) positionSuggestionPopup({ popup, clientRect: props.clientRect })
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
