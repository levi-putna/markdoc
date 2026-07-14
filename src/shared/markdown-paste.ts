import { Extension } from '@tiptap/core'
import { DOMParser } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const markdownPasteKey = new PluginKey('markdownPaste')

/** Detects pasted Markdown that should be parsed as block content, not inline-only. */
const BLOCK_MARKDOWN_PATTERN = /(?:^|\n\n|\n)(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```)/m

/**
 * Wraps parsed HTML the same way tiptap-markdown does so leading/trailing whitespace is preserved.
 */
function elementFromString({ value }: { value: string }): HTMLElement {
  const wrappedValue = `<body>${value}</body>`
  return new window.DOMParser().parseFromString(wrappedValue, 'text/html').body
}

/**
 * Improves Markdown paste handling — block-level Markdown (lists, headings, fences) is parsed
 * as full document structure instead of tiptap-markdown's inline-only paste mode.
 */
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  priority: 100,

  addOptions() {
    return {
      enabled: true,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: markdownPasteKey,
        props: {
          clipboardTextParser: (text, context, plainText) => {
            if (plainText || !this.options.enabled) {
              return null
            }

            if (!BLOCK_MARKDOWN_PATTERN.test(text)) {
              return null
            }

            const parsed = this.editor.storage.markdown.parser.parse(text, { inline: false })

            return DOMParser.fromSchema(this.editor.schema).parseSlice(
              elementFromString({ value: parsed }),
              {
                preserveWhitespace: true,
                context,
              }
            )
          },
        },
      }),
    ]
  },
})
