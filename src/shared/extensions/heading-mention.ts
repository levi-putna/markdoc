import { mergeAttributes, type Editor } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { SuggestionOptions } from '@tiptap/suggestion'
import {
  getHeadingMentionLabel,
  listHeadingsForMention,
  type ResolvedHeading,
} from '../heading-mention-resolve'

export type HeadingMentionItem = ResolvedHeading

/**
 * Escapes markdown link text so labels with brackets don't break the mention syntax.
 */
function escapeMarkdownLinkLabel({ text }: { text: string }): string {
  return text.replace(/[[\]]/g, '\\$&')
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
            attrs: { headingId },
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
    }
  },

  parseHTML() {
    return [
      { tag: 'a[data-heading-mention]' },
      {
        tag: 'a[href^="heading://"]',
        getAttrs: (element) => {
          const href = (element as HTMLElement).getAttribute('href') ?? ''
          const headingId = href.replace(/^heading:\/\//, '')
          return headingId ? { headingId } : false
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const headingId = node.attrs.headingId as string
    const { label, broken } = getHeadingMentionLabel({
      doc: this.editor!.state.doc,
      headingId,
    })

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-heading-mention': '',
        'data-heading-id': headingId,
        'data-broken': broken ? 'true' : null,
        href: `heading://${headingId}`,
        class: broken ? 'heading-mention heading-mention--broken' : 'heading-mention',
      }),
      `@${label}`,
    ]
  },

  renderText({ node }) {
    const { label } = getHeadingMentionLabel({
      doc: this.editor!.state.doc,
      headingId: node.attrs.headingId,
    })
    return `@${label}`
  },

  addStorage() {
    return {
      markdown: {
        serialize(this: { editor: Editor }, state: { write: (text: string) => void }, node: ProseMirrorNode) {
          const headingId = node.attrs.headingId as string
          const { label } = getHeadingMentionLabel({
            doc: this.editor.state.doc,
            headingId,
          })
          state.write(`[@${escapeMarkdownLinkLabel({ text: label })}](heading://${headingId})`)
        },
        parse: {},
      },
    }
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
