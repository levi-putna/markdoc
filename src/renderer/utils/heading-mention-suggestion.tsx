import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import {
  HeadingMentionList,
  type HeadingMentionListRef,
} from '../components/HeadingMentionList'
import type { HeadingMentionItem } from '@shared/extensions/heading-mention'
import { positionHeadingMentionPopup } from './heading-mention-popup-position'

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

      const rect = props.clientRect?.()
      if (rect) positionHeadingMentionPopup({ popup, anchorRect: rect })
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

      const rect = props.clientRect?.()
      if (popup && rect) positionHeadingMentionPopup({ popup, anchorRect: rect })
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
