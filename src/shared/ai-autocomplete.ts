import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface AutocompletePluginState {
  decorations: DecorationSet
  ghostText: string
}

export const autocompleteKey = new PluginKey<AutocompletePluginState>('aiAutocomplete')

/**
 * Ghost-text inline autocomplete for AI continue-writing (FR-14.41).
 */
export const AiAutocomplete = Extension.create({
  name: 'aiAutocomplete',

  addProseMirrorPlugins() {
    return [
      new Plugin<AutocompletePluginState>({
        key: autocompleteKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              ghostText: '',
            }
          },
          apply(tr, value) {
            const meta = tr.getMeta(autocompleteKey) as { ghostText?: string } | undefined

            if (meta?.ghostText !== undefined) {
              if (!meta.ghostText) {
                return {
                  decorations: DecorationSet.empty,
                  ghostText: '',
                }
              }

              const pos = tr.selection.from
              return {
                ghostText: meta.ghostText,
                decorations: DecorationSet.create(tr.doc, [
                  Decoration.widget(pos, () => {
                    const span = document.createElement('span')
                    span.className = 'ai-autocomplete-ghost'
                    span.textContent = meta.ghostText as string
                    return span
                  }),
                ]),
              }
            }

            if (tr.docChanged || tr.selectionSet) {
              return {
                decorations: DecorationSet.empty,
                ghostText: '',
              }
            }

            return value
          },
        },
        props: {
          decorations(state) {
            return autocompleteKey.getState(state)?.decorations ?? DecorationSet.empty
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
      acceptAutocompleteGhost:
        () =>
        ({ state, dispatch }) => {
          const pluginState = autocompleteKey.getState(state)
          const ghostText = pluginState?.ghostText
          if (!ghostText) return false

          const tr = state.tr.insertText(ghostText, state.selection.from, state.selection.to)
          tr.setMeta(autocompleteKey, { ghostText: '' })

          if (dispatch) dispatch(tr)
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
      acceptAutocompleteGhost: () => ReturnType
    }
  }
}
