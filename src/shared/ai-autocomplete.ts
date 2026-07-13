import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const autocompleteKey = new PluginKey('aiAutocomplete')

/**
 * Ghost-text inline autocomplete for AI continue-writing (FR-14.41).
 */
export const AiAutocomplete = Extension.create({
  name: 'aiAutocomplete',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: autocompleteKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, old) {
            const meta = tr.getMeta(autocompleteKey)
            if (meta?.ghostText !== undefined) {
              if (!meta.ghostText) return DecorationSet.empty
              const pos = tr.selection.from
              return DecorationSet.create(tr.doc, [
                Decoration.widget(pos, () => {
                  const span = document.createElement('span')
                  span.className = 'ai-autocomplete-ghost'
                  span.textContent = meta.ghostText as string
                  return span
                }),
              ])
            }
            if (tr.docChanged || tr.selectionSet) return DecorationSet.empty
            return old
          },
        },
        props: {
          decorations(state) {
            return autocompleteKey.getState(state) ?? DecorationSet.empty
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setAutocompleteGhost:
        (ghostText: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(autocompleteKey, { ghostText })
            dispatch(tr)
          }
          return true
        },
      clearAutocompleteGhost:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(autocompleteKey, { ghostText: '' })
            dispatch(tr)
          }
          return true
        },
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiAutocomplete: {
      setAutocompleteGhost: (ghostText: string) => ReturnType
      clearAutocompleteGhost: () => ReturnType
    }
  }
}
