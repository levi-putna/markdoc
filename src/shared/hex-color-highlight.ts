import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { findHexColors } from './find-hex-colors'

/**
 * Highlights hex colour codes in the editor with a swatch to the left of each match,
 * following the Tiptap Savvy colour highlighter pattern.
 */
export const HexColorHighlight = Extension.create({
  name: 'hexColorHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        state: {
          init(_, { doc }) {
            return findHexColors({ doc })
          },
          apply(transaction, oldState) {
            return transaction.docChanged
              ? findHexColors({ doc: transaction.doc })
              : oldState.map(transaction.mapping, transaction.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
