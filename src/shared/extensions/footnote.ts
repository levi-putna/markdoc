import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Inline footnote reference — serialises as GFM `[^label]`.
 */
export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: { default: '1' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'sup[data-footnote-ref]',
        getAttrs: (element) => ({
          label: (element as HTMLElement).getAttribute('data-label') ?? '1',
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        'data-footnote-ref': '',
        'data-label': node.attrs.label,
        class: 'footnote-ref',
      }),
      `[^${node.attrs.label}]`,
    ]
  },
})

/**
 * Footnote definition block — serialises as GFM `[^label]: text`.
 */
export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      label: { default: '1' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-footnote-def]',
        getAttrs: (element) => ({
          label: (element as HTMLElement).getAttribute('data-label') ?? '1',
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-footnote-def': '',
        'data-label': node.attrs.label,
        class: 'footnote-definition',
      }),
      0,
    ]
  },
})
