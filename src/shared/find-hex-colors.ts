import type { Node } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Matches valid 3-, 4-, 6-, and 8-digit hex colour codes (e.g. #FFF, #FF22FF). */
const HEX_COLOR_PATTERN = /#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi

/**
 * Creates a small inline swatch element shown to the left of a hex colour code.
 */
function createHexColorSwatch({ color }: { color: string }): HTMLSpanElement {
  const swatch = document.createElement('span')
  swatch.className = 'hex-color-swatch'
  swatch.style.setProperty('--hex-color', color)
  swatch.style.backgroundColor = color
  swatch.setAttribute('aria-hidden', 'true')
  swatch.setAttribute('contenteditable', 'false')
  return swatch
}

/**
 * Scans a ProseMirror document for hex colour codes and returns widget decorations
 * that render a swatch immediately before each match.
 */
export function findHexColors({ doc }: { doc: Node }): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) {
      return
    }

    for (const match of node.text.matchAll(HEX_COLOR_PATTERN)) {
      const color = match[0]
      const index = match.index ?? 0
      const from = position + index

      decorations.push(
        Decoration.widget(
          from,
          () => createHexColorSwatch({ color }),
          {
            side: -1,
            key: `hex-color-${from}-${color.toLowerCase()}`,
          }
        )
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}
