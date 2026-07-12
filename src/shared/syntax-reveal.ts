import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const syntaxRevealKey = new PluginKey('syntaxReveal')

/**
 * Reveals Markdown syntax characters on the active line only (FR-2.2a, TR-8.7).
 */
export const SyntaxReveal = Extension.create({
  name: 'syntaxReveal',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: syntaxRevealKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, old) {
            const meta = tr.getMeta(syntaxRevealKey)
            if (meta?.decorations) return meta.decorations
            if (!tr.docChanged && !tr.selectionSet) return old.map(tr.mapping, tr.doc)
            return old
          },
        },
        props: {
          decorations(state) {
            const { from } = state.selection
            const $pos = state.doc.resolve(from)
            const blockStart = $pos.start($pos.depth)
            const blockEnd = $pos.end($pos.depth)
            const text = state.doc.textBetween(blockStart, blockEnd, '\n')

            const decorations: Decoration[] = []
            const patterns = [
              { regex: /^(#{1,6}\s)/, group: 1 },
              { regex: /^(- \[[ x]\]\s)/, group: 1 },
              { regex: /^(- |\d+\.\s)/, group: 1 },
              { regex: /^>\s/, group: 0 },
              { regex: /(\*\*[^*]+\*\*)/g, group: 1 },
              { regex: /(\*[^*]+\*)/g, group: 1 },
              { regex: /(`[^`]+`)/g, group: 1 },
            ]

            for (const { regex, group } of patterns) {
              const match = text.match(regex)
              if (!match) continue
              const start = blockStart + (match.index ?? 0)
              const matched = match[group] ?? match[0]
              decorations.push(
                Decoration.inline(start, start + matched.length, {
                  class: 'syntax-reveal',
                })
              )
            }

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
