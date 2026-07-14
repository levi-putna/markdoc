import { mergeAttributes, type Editor } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { SuggestionOptions } from '@tiptap/suggestion'
import {
  buildHeadingLookup,
  getHeadingMentionDisplayLabel,
  getHeadingMentionLabel,
  listHeadingsForMention,
  type ResolvedHeading,
} from '../heading-mention-resolve'

export type HeadingMentionItem = ResolvedHeading

const headingMentionLabelKey = new PluginKey('headingMentionLabelSync')

/**
 * Escapes markdown link text so labels with brackets don't break the mention syntax.
 */
function escapeMarkdownLinkLabel({ text }: { text: string }): string {
  return text.replace(/[[\]]/g, '\\$&')
}

/**
 * Reads the display label from a mention HTML element (strip leading @).
 */
function labelFromElement({ element }: { element: HTMLElement }): string | null {
  const dataLabel = element.getAttribute('data-label')
  if (dataLabel?.trim()) return dataLabel.trim()
  const text = element.textContent?.replace(/^@/, '').trim()
  return text || null
}

/**
 * Builds default suggestion options that list document headings after `@`.
 */
export function createHeadingMentionSuggestion({
  suggestion = {},
}: {
  suggestion?: Partial<SuggestionOptions<HeadingMentionItem>>
} = {}): Omit<SuggestionOptions<HeadingMentionItem>, 'editor'> {
  return {
    char: '@',
    allowSpaces: true,
    allowedPrefixes: [' ', '\n'],
    items: ({ query, editor }) => {
      return listHeadingsForMention({ doc: editor.state.doc, query }).slice(0, 12)
    },
    command: ({ editor, range, props }) => {
      const headingId = props.headingId
      if (!headingId) return

      const nodeAfter = editor.view.state.selection.$to.nodeAfter
      const overrideSpace = nodeAfter?.text?.startsWith(' ')
      if (overrideSpace) {
        range.to += 1
      }

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'headingMention',
            attrs: {
              headingId,
              // Cache the title at insert time so a later delete can still show it.
              label: props.text ?? props.label ?? null,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run()

      editor.view.dom.ownerDocument.defaultView?.getSelection()?.collapseToEnd()
    },
    ...suggestion,
  }
}

/**
 * Inline atom node for @heading mentions — links to a stable headingId.
 * Stores a cached `label` of the last known heading title for broken-state display.
 */
export const HeadingMention = Mention.extend({
  name: 'headingMention',

  addAttributes() {
    return {
      headingId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-heading-id') ?? element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.headingId) return {}
          return { 'data-heading-id': attributes.headingId }
        },
      },
      label: {
        default: null,
        parseHTML: (element) => labelFromElement({ element: element as HTMLElement }),
        renderHTML: (attributes) => {
          if (!attributes.label) return {}
          return { 'data-label': attributes.label }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'a[data-heading-mention]' },
      {
        tag: 'a[href^="heading://"]',
        getAttrs: (element) => {
          const el = element as HTMLElement
          const href = el.getAttribute('href') ?? ''
          const headingId = href.replace(/^heading:\/\//, '')
          if (!headingId) return false
          return { headingId, label: labelFromElement({ element: el }) }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const headingId = node.attrs.headingId as string
    const cachedLabel = node.attrs.label as string | null
    const showNumbersInMentions =
      this.storage.mentionDisplay?.showNumbersInMentions ?? false
    const { display, broken } = getHeadingMentionDisplayLabel({
      doc: this.editor!.state.doc,
      headingId,
      cachedLabel,
      showNumbersInMentions,
    })

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-heading-mention': '',
        'data-heading-id': headingId,
        'data-label': display,
        'data-broken': broken ? 'true' : null,
        href: `heading://${headingId}`,
        class: broken ? 'heading-mention heading-mention--broken' : 'heading-mention',
      }),
      display,
    ]
  },

  renderText({ node }) {
    const showNumbersInMentions =
      this.storage.mentionDisplay?.showNumbersInMentions ?? false
    const { display } = getHeadingMentionDisplayLabel({
      doc: this.editor!.state.doc,
      headingId: node.attrs.headingId,
      cachedLabel: node.attrs.label,
      showNumbersInMentions,
    })
    return display
  },

  addStorage() {
    return {
      mentionDisplay: {
        showNumbersInMentions: true,
      },
      markdown: {
        serialize(this: { editor: Editor }, state: { write: (text: string) => void }, node: ProseMirrorNode) {
          const headingId = node.attrs.headingId as string
          // Markdown keeps the bare title — numbering is document display only.
          const { label } = getHeadingMentionLabel({
            doc: this.editor.state.doc,
            headingId,
            cachedLabel: node.attrs.label,
          })
          state.write(`[@${escapeMarkdownLinkLabel({ text: label })}](heading://${headingId})`)
        },
        parse: {},
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: headingMentionLabelKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged)) return null

          const lookup = buildHeadingLookup({ doc: newState.doc })
          let transaction = newState.tr
          let changed = false

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'headingMention') return
            const headingId = node.attrs.headingId as string | null
            if (!headingId) return
            const resolved = lookup.get(headingId)
            // Only refresh the cached label while the heading still exists —
            // on delete we keep the previous title for the broken (red) chip.
            if (!resolved) return
            if (node.attrs.label === resolved.text) return
            transaction = transaction.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              label: resolved.text,
            })
            changed = true
          })

          return changed ? transaction : null
        },
      }),
    ]
  },
})

/**
 * Creates a HeadingMention extension with live-editor suggestion UI hooks.
 */
export function createHeadingMentionExtension({
  suggestion,
}: {
  suggestion?: Partial<SuggestionOptions<HeadingMentionItem>>
} = {}) {
  return HeadingMention.configure({
    HTMLAttributes: {
      class: 'heading-mention',
    },
    deleteTriggerWithBackspace: true,
    suggestion: createHeadingMentionSuggestion({ suggestion }),
  })
}

/**
 * Syncs whether @heading mentions should show computed number prefixes.
 */
export function setHeadingMentionNumberDisplay({
  editor,
  showNumbersInMentions,
}: {
  editor: Editor
  showNumbersInMentions: boolean
}): void {
  const storage = editor.storage.headingMention as
    | { mentionDisplay?: { showNumbersInMentions?: boolean } }
    | undefined
  if (!storage?.mentionDisplay) return
  storage.mentionDisplay.showNumbersInMentions = showNumbersInMentions
}
