import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { buildReplacementSlice, resolveSuggestionRange } from './ai-suggestion-apply'

export interface AiSuggestion {
  suggestionId: string
  from: number
  to: number
  replacement: string
  originalText?: string
  rationale?: string
  summary?: string
}

interface AiSuggestionsPluginState {
  decorations: DecorationSet
  suggestions: AiSuggestion[]
  activeSuggestionId: string | null
}

export const aiSuggestionsKey = new PluginKey<AiSuggestionsPluginState>('aiSuggestions')

type SuggestionAction = 'accept' | 'reject'

let suggestionActionHandler: (({
  action,
  suggestionId,
}: {
  action: SuggestionAction
  suggestionId: string
}) => void) | null = null

/**
 * Registers a handler for inline accept/reject controls in the editor.
 */
export function registerSuggestionActionHandler(
  handler: (args: { action: SuggestionAction; suggestionId: string }) => void
): () => void {
  suggestionActionHandler = handler
  return () => {
    if (suggestionActionHandler === handler) {
      suggestionActionHandler = null
    }
  }
}

/**
 * Track-changes-style suggestion decorations for AI propose_edit (TR-15.13).
 */
export const AiSuggestions = Extension.create({
  name: 'aiSuggestions',

  addProseMirrorPlugins() {
    return [
      new Plugin<AiSuggestionsPluginState>({
        key: aiSuggestionsKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              suggestions: [] as AiSuggestion[],
              activeSuggestionId: null,
            }
          },
          apply(tr, value) {
            const meta = tr.getMeta(aiSuggestionsKey) as
              | { setSuggestions?: AiSuggestion[]; activeSuggestionId?: string | null; clear?: boolean }
              | undefined

            if (meta?.clear) {
              return {
                suggestions: [],
                decorations: DecorationSet.empty,
                activeSuggestionId: null,
              }
            }

            if (meta?.setSuggestions) {
              const suggestions = meta.setSuggestions
              const activeSuggestionId =
                meta.activeSuggestionId ??
                (suggestions.some((suggestion) => suggestion.suggestionId === value.activeSuggestionId)
                  ? value.activeSuggestionId
                  : suggestions[0]?.suggestionId ?? null)

              return {
                suggestions,
                activeSuggestionId,
                decorations: buildSuggestionDecorations({
                  doc: tr.doc,
                  suggestions,
                  activeSuggestionId,
                }),
              }
            }

            if (meta?.activeSuggestionId !== undefined) {
              return {
                ...value,
                activeSuggestionId: meta.activeSuggestionId,
                decorations: buildSuggestionDecorations({
                  doc: tr.doc,
                  suggestions: value.suggestions,
                  activeSuggestionId: meta.activeSuggestionId,
                }),
              }
            }

            if (!tr.docChanged) return value

            const mappedSuggestions = mapSuggestions({ tr, suggestions: value.suggestions })
            return {
              suggestions: mappedSuggestions,
              activeSuggestionId: value.activeSuggestionId,
              decorations: buildSuggestionDecorations({
                doc: tr.doc,
                suggestions: mappedSuggestions,
                activeSuggestionId: value.activeSuggestionId,
              }),
            }
          },
        },
        props: {
          decorations(state) {
            return aiSuggestionsKey.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
        view() {
          return {}
        },
      }),
    ]
  },

  addCommands() {
    return {
      setAiSuggestions:
        ({
          suggestions,
          activeSuggestionId,
        }: {
          suggestions: AiSuggestion[]
          activeSuggestionId?: string | null
        }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(aiSuggestionsKey, { setSuggestions: suggestions, activeSuggestionId })
            dispatch(tr)
          }
          return true
        },
      addAiSuggestion:
        (suggestion: AiSuggestion) =>
        ({ editor, tr, dispatch }) => {
          const pluginState = aiSuggestionsKey.getState(editor.state)
          const next = [...(pluginState?.suggestions ?? []), suggestion]
          if (dispatch) {
            tr.setMeta(aiSuggestionsKey, {
              setSuggestions: next,
              activeSuggestionId: suggestion.suggestionId,
            })
            dispatch(tr)
          }
          return true
        },
      clearAiSuggestions:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(aiSuggestionsKey, { clear: true })
            dispatch(tr)
          }
          return true
        },
      setActiveAiSuggestion:
        (suggestionId: string | null) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(aiSuggestionsKey, { activeSuggestionId: suggestionId })
            dispatch(tr)
          }
          return true
        },
      focusAiSuggestion:
        (suggestionId: string) =>
        ({ editor, chain }) => {
          const pluginState = aiSuggestionsKey.getState(editor.state)
          const suggestion = pluginState?.suggestions.find((entry) => entry.suggestionId === suggestionId)
          if (!suggestion) return false

          return chain()
            .setActiveAiSuggestion(suggestionId)
            .setTextSelection(suggestion.from)
            .run()
        },
      goToNextAiSuggestion:
        () =>
        ({ editor, chain }) => {
          const nextId = getAdjacentSuggestionId({ editor, direction: 'next' })
          if (!nextId) return false
          return chain().focusAiSuggestion(nextId).run()
        },
      goToPreviousAiSuggestion:
        () =>
        ({ editor, chain }) => {
          const previousId = getAdjacentSuggestionId({ editor, direction: 'previous' })
          if (!previousId) return false
          return chain().focusAiSuggestion(previousId).run()
        },
      acceptAiSuggestion:
        (suggestionId: string) =>
        ({ editor, state, dispatch }) => {
          const pluginState = aiSuggestionsKey.getState(state)
          const suggestion = pluginState?.suggestions.find((entry) => entry.suggestionId === suggestionId)
          if (!suggestion) return false

          const resolved = resolveSuggestionRange({
            editor,
            from: suggestion.from,
            to: suggestion.to,
            originalText: suggestion.originalText,
          })
          if (!resolved) return false

          const slice = buildReplacementSlice({ editor, replacement: suggestion.replacement })
          const remaining = pluginState!.suggestions.filter((entry) => entry.suggestionId !== suggestionId)
          const nextActive = remaining[0]?.suggestionId ?? null

          const tr = state.tr.replaceRange(resolved.from, resolved.to, slice)
          const mappedRemaining = mapSuggestionsThroughTransaction({
            tr,
            suggestions: remaining,
          })

          tr.setMeta(aiSuggestionsKey, {
            setSuggestions: mappedRemaining,
            activeSuggestionId: nextActive,
          })

          if (dispatch) dispatch(tr)
          return true
        },
      acceptAllAiSuggestions:
        () =>
        ({ editor, state, dispatch }) => {
          const pluginState = aiSuggestionsKey.getState(state)
          const suggestions = [...(pluginState?.suggestions ?? [])].sort((left, right) => right.from - left.from)
          if (suggestions.length === 0) return false

          let tr = state.tr

          for (const suggestion of suggestions) {
            const resolved = resolveSuggestionRange({
              editor,
              from: suggestion.from,
              to: suggestion.to,
              originalText: suggestion.originalText,
            })
            if (!resolved) continue

            const slice = buildReplacementSlice({ editor, replacement: suggestion.replacement })
            tr = tr.replaceRange(resolved.from, resolved.to, slice)
          }

          tr.setMeta(aiSuggestionsKey, { clear: true })

          if (dispatch) dispatch(tr)
          return true
        },
      rejectAiSuggestion:
        (suggestionId: string) =>
        ({ editor, chain }) => {
          const pluginState = aiSuggestionsKey.getState(editor.state)
          const remaining = pluginState?.suggestions.filter((entry) => entry.suggestionId !== suggestionId) ?? []
          const nextActive =
            remaining.find((entry) => entry.suggestionId === pluginState?.activeSuggestionId)?.suggestionId ??
            remaining[0]?.suggestionId ??
            null

          return chain()
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                tr.setMeta(aiSuggestionsKey, {
                  setSuggestions: remaining,
                  activeSuggestionId: nextActive,
                })
                dispatch(tr)
              }
              return true
            })
            .run()
        },
      rejectAllAiSuggestions:
        () =>
        ({ chain }) => chain().clearAiSuggestions().run(),
    }
  },
})

function mapSuggestionsThroughTransaction({
  tr,
  suggestions,
}: {
  tr: EditorState['tr']
  suggestions: AiSuggestion[]
}): AiSuggestion[] {
  return suggestions
    .map((suggestion) => {
      const from = tr.mapping.map(suggestion.from)
      const to = tr.mapping.map(suggestion.to)
      if (from > to) return null
      return { ...suggestion, from, to }
    })
    .filter((suggestion): suggestion is AiSuggestion => suggestion !== null)
}

function mapSuggestions({
  tr,
  suggestions,
}: {
  tr: EditorState['tr']
  suggestions: AiSuggestion[]
}): AiSuggestion[] {
  return suggestions
    .map((suggestion) => {
      const from = tr.mapping.map(suggestion.from)
      const to = tr.mapping.map(suggestion.to)
      if (from > to) return null
      return { ...suggestion, from, to }
    })
    .filter((suggestion): suggestion is AiSuggestion => suggestion !== null)
}

function getAdjacentSuggestionId({
  editor,
  direction,
}: {
  editor: { state: EditorState }
  direction: 'next' | 'previous'
}): string | null {
  const pluginState = aiSuggestionsKey.getState(editor.state)
  const suggestions = pluginState?.suggestions ?? []
  if (suggestions.length === 0) return null

  const ordered = [...suggestions].sort((left, right) => left.from - right.from)
  const currentIndex = ordered.findIndex(
    (suggestion) => suggestion.suggestionId === pluginState?.activeSuggestionId
  )
  const startIndex = currentIndex === -1 ? 0 : currentIndex
  const nextIndex = direction === 'next' ? startIndex + 1 : startIndex - 1

  if (nextIndex < 0 || nextIndex >= ordered.length) {
    return ordered[direction === 'next' ? 0 : ordered.length - 1]?.suggestionId ?? null
  }

  return ordered[nextIndex]?.suggestionId ?? null
}

function buildSuggestionDecorations({
  doc,
  suggestions,
  activeSuggestionId,
}: {
  doc: import('@tiptap/pm/model').Node
  suggestions: AiSuggestion[]
  activeSuggestionId: string | null
}): DecorationSet {
  const decorations: Decoration[] = []

  for (const suggestion of suggestions) {
    const isActive = suggestion.suggestionId === activeSuggestionId
    const from = Math.max(0, Math.min(suggestion.from, doc.content.size))
    const to = Math.max(0, Math.min(suggestion.to, doc.content.size))

    if (from > doc.content.size || to > doc.content.size) continue

    if (from < to) {
      decorations.push(
        Decoration.inline(from, to, {
          class: isActive ? 'ai-suggestion-delete ai-suggestion-delete--active' : 'ai-suggestion-delete',
        })
      )
    }

    const widgetPos = Math.max(from, to)
    decorations.push(
      Decoration.widget(
        widgetPos,
        () => createSuggestionWidget({ suggestion, isActive }),
        {
          side: 1,
          key: `ai-suggestion-${suggestion.suggestionId}`,
        }
      )
    )
  }

  try {
    return DecorationSet.create(doc, decorations)
  } catch {
    return DecorationSet.empty
  }
}

function createSuggestionWidget({
  suggestion,
  isActive,
}: {
  suggestion: AiSuggestion
  isActive: boolean
}): HTMLElement {
  const container = document.createElement('span')
  container.className = 'ai-suggestion-hunk'
  container.contentEditable = 'false'
  container.dataset.suggestionId = suggestion.suggestionId

  if (isActive) {
    container.dataset.active = 'true'
  }

  const insert = document.createElement('span')
  insert.className = isActive ? 'ai-suggestion-insert ai-suggestion-insert--active' : 'ai-suggestion-insert'
  insert.textContent = suggestion.replacement

  const actions = document.createElement('span')
  actions.className = 'suggestion-review-actions suggestion-review-actions--inline'

  const group = document.createElement('span')
  group.className = 'suggestion-review-actions__group'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Review change')

  const rejectButton = createActionButton({
    label: 'Reject',
    variant: 'reject',
    onClick: () => {
      suggestionActionHandler?.({ action: 'reject', suggestionId: suggestion.suggestionId })
    },
  })

  const acceptButton = createActionButton({
    label: 'Accept',
    variant: 'accept',
    onClick: () => {
      suggestionActionHandler?.({ action: 'accept', suggestionId: suggestion.suggestionId })
    },
  })

  group.append(rejectButton, acceptButton)
  actions.append(group)
  container.append(insert, actions)

  return container
}

function createActionButton({
  label,
  variant,
  onClick,
}: {
  label: string
  variant: 'accept' | 'reject'
  onClick: () => void
}): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `suggestion-review-actions__btn suggestion-review-actions__btn--${variant}`
  button.setAttribute('aria-label', `${label} change`)
  button.title = `${label} change`
  button.innerHTML = `${variant === 'accept' ? CHECK_ICON_SVG : X_ICON_SVG}<span>${label}</span>`
  button.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick()
  })
  return button
}

const CHECK_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

const X_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiSuggestions: {
      setAiSuggestions: (args: {
        suggestions: AiSuggestion[]
        activeSuggestionId?: string | null
      }) => ReturnType
      addAiSuggestion: (suggestion: AiSuggestion) => ReturnType
      clearAiSuggestions: () => ReturnType
      setActiveAiSuggestion: (suggestionId: string | null) => ReturnType
      focusAiSuggestion: (suggestionId: string) => ReturnType
      goToNextAiSuggestion: () => ReturnType
      goToPreviousAiSuggestion: () => ReturnType
      acceptAiSuggestion: (suggestionId: string) => ReturnType
      acceptAllAiSuggestions: () => ReturnType
      rejectAiSuggestion: (suggestionId: string) => ReturnType
      rejectAllAiSuggestions: () => ReturnType
    }
  }
}
