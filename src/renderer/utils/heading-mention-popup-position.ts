import {
  MENTION_POPUP_ANCHOR_GAP,
  MENTION_POPUP_VIEWPORT_MARGIN,
  resolveMentionPopupHorizontalPlacement,
  shouldOpenMentionPopupUpwards,
} from '@shared/heading-mention-resolve'

/** Fallback width when the popup has not been measured yet (matches list min-width). */
const MENTION_POPUP_MIN_WIDTH = 220

/**
 * Positions a heading-mention popup relative to a caret or chip rect, flipping
 * above/below and left/right to stay inside the viewport.
 */
export function positionHeadingMentionPopup({
  popup,
  anchorRect,
}: {
  popup: HTMLDivElement
  anchorRect: DOMRect
}): void {
  const popupWidth = popup.offsetWidth || MENTION_POPUP_MIN_WIDTH
  const horizontal = resolveMentionPopupHorizontalPlacement({
    anchorLeft: anchorRect.left,
    popupWidth,
    viewportWidth: window.innerWidth,
    margin: MENTION_POPUP_VIEWPORT_MARGIN,
  })

  const openUpwards = shouldOpenMentionPopupUpwards({
    caretTop: anchorRect.top,
    viewportHeight: window.innerHeight,
  })

  popup.style.left = `${Math.round(horizontal.left + window.scrollX)}px`

  const transforms: string[] = []
  if (horizontal.flipLeft) {
    transforms.push('translateX(-100%)')
  }

  if (openUpwards) {
    popup.style.top = `${Math.round(anchorRect.top + window.scrollY - MENTION_POPUP_ANCHOR_GAP)}px`
    transforms.push('translateY(-100%)')
  } else {
    popup.style.top = `${Math.round(anchorRect.bottom + window.scrollY + MENTION_POPUP_ANCHOR_GAP)}px`
  }

  popup.style.transform = transforms.join(' ')
}
