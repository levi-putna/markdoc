import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { listHeadingsForMention, shouldOpenMentionPopupUpwards } from '@shared/heading-mention-resolve'
import {
  HeadingMentionList,
  type HeadingMentionListRef,
} from '../components/HeadingMentionList'

export interface HeadingMentionPick {
  headingId: string
  label: string
}

type ActivePicker = {
  component: ReactRenderer<HeadingMentionListRef>
  popup: HTMLDivElement
  cleanup: () => void
}

let activePicker: ActivePicker | null = null

/**
 * Closes any open heading-mention picker (suggestion or relink).
 */
export function closeHeadingMentionPicker(): void {
  if (!activePicker) return
  activePicker.cleanup()
  activePicker = null
}

/**
 * Positions a mention popup relative to an anchor rect, flipping above the
 * caret/chip when it sits in the bottom half of the viewport.
 */
function positionMentionPopup({
  popup,
  rect,
}: {
  popup: HTMLDivElement
  rect: DOMRect
}): void {
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
 * Opens the shared heading-list popup anchored to `clientRect`, listing live
 * document headings. Used by the `@` suggestion plugin and by broken-mention
 * relinking.
 */
export function openHeadingMentionPicker({
  editor,
  clientRect,
  onSelect,
}: {
  editor: Editor
  clientRect: () => DOMRect | null
  onSelect: (pick: HeadingMentionPick) => void
}): void {
  closeHeadingMentionPicker()

  const rect = clientRect()
  if (!rect) return

  const items = listHeadingsForMention({ doc: editor.state.doc })

  const component = new ReactRenderer(HeadingMentionList, {
    props: {
      items,
      command: (pick: HeadingMentionPick) => {
        onSelect(pick)
        closeHeadingMentionPicker()
      },
    },
    editor,
  })

  const popup = document.createElement('div')
  popup.className = 'heading-mention-popup'
  popup.appendChild(component.element)
  document.body.appendChild(popup)
  positionMentionPopup({ popup, rect })

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeHeadingMentionPicker()
      return
    }
    const handled = component.ref?.onKeyDown({ event }) ?? false
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const onPointerDown = (event: MouseEvent) => {
    const target = event.target as Node | null
    if (popup.contains(target)) return
    closeHeadingMentionPicker()
  }

  const onScrollOrResize = () => {
    const next = clientRect()
    if (!next) {
      closeHeadingMentionPicker()
      return
    }
    positionMentionPopup({ popup, rect: next })
  }

  // Capture Escape / outside click after the opening click has finished.
  window.setTimeout(() => {
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
  }, 0)

  const cleanup = () => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('mousedown', onPointerDown, true)
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
    popup.remove()
    component.destroy()
  }

  activePicker = { component, popup, cleanup }
}
