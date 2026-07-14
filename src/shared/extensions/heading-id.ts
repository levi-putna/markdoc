import Heading from '@tiptap/extension-heading'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { nanoid } from 'nanoid'

const headingIdPluginKey = new PluginKey('headingIdAssign')

/**
 * Heading extension with a persistent `headingId` attribute.
 * IDs are assigned once on first encounter and survive renames/moves/level changes.
 * Serialises as ATX markdown with a Pandoc-style `{#id}` suffix so source mode
 * stays readable while still round-tripping stable ids.
 */
export const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      headingId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-heading-id'),
        renderHTML: (attributes) => {
          if (!attributes.headingId) return {}
          return { 'data-heading-id': attributes.headingId }
        },
      },
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void
            closeBlock: (node: ProseMirrorNode) => void
            renderInline: (node: ProseMirrorNode) => void
          },
          node: ProseMirrorNode
        ) {
          const headingId = node.attrs.headingId as string | null
          const level = node.attrs.level as number

          state.write(`${'#'.repeat(level)} `)
          state.renderInline(node)
          if (headingId) {
            state.write(` {#${headingId}}`)
          }
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: headingIdPluginKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged)) return null

          let transaction = newState.tr
          let changed = false
          const assigned = new Set<string>()

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return

            let headingId = node.attrs.headingId as string | null
            const needsId = !headingId
            const isDuplicate = Boolean(headingId && assigned.has(headingId))

            if (!needsId && !isDuplicate && headingId) {
              assigned.add(headingId)
              return
            }

            headingId = nanoid(12)
            transaction.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              headingId,
            })
            assigned.add(headingId)
            changed = true
          })

          return changed ? transaction : null
        },
      }),
    ]
  },
})
