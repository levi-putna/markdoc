import type { Editor } from '@tiptap/core'
import { PluginKey, TextSelection } from '@tiptap/pm/state'
import { buildOutlineFromDoc } from './document-index'
import {
  computeHeadingNumbers,
  stripNumberingPrefix,
  type HeadingNumberingOverride,
  type NumberingConfig,
} from './heading-numbering'

/** Meta key marking transactions that apply or clear heading numbers. */
export const headingNumberingKey = new PluginKey('headingNumbering')

interface HeadingNumberUpdate {
  pos: number
  nodeSize: number
  attrs: Record<string, unknown>
  /** One-time migration from legacy inline numbers → bare title text. */
  migrationText?: string
}

/**
 * True when a display label can collide with normal English titles (classic I/A).
 */
function isAmbiguousNumberPrefix(displayLabel: string): boolean {
  const label = displayLabel.trim()
  if (!label) return true
  if (/^Chapter\s+\d+/i.test(label)) return false
  if (/^\.?\d+(?:\.\d+)*\.?0?$/.test(label)) return false
  if (/^\(\s*[a-zivxlcdm]+\s*\)$/i.test(label)) return false
  if (/^[IVXLCDM]{1,6}$/i.test(label)) return true
  if (/^[A-Za-z]$/.test(label)) return true
  return false
}

/**
 * Strips an embedded number prefix from heading text when loading or migrating
 * documents that still have numbers written into the markdown source.
 *
 * Uses strict stripping only — never peels ambiguous classic tokens off prose
 * titles like "A complete guide" or "I Love Cats".
 */
export function migrateLegacyNumberedHeadingText({
  text,
  displayLabel,
}: {
  text: string
  displayLabel: string
}): string | null {
  const live = text.trim()
  if (!live || !displayLabel) return null

  // Only peel a live prefix that matches the current label when that label is
  // unambiguous (decimal, chapter, etc.). Classic "I"/"A" must not strip
  // "I Love Cats" or "A complete guide".
  if (!isAmbiguousNumberPrefix(displayLabel)) {
    const expectedPrefix = `${displayLabel} `
    if (live.startsWith(expectedPrefix)) {
      const bare = live.slice(expectedPrefix.length).trim()
      return bare && bare !== live ? bare : null
    }
  }

  const stripped = stripNumberingPrefix({
    text: live,
    displayLabel: isAmbiguousNumberPrefix(displayLabel) ? undefined : displayLabel,
    loose: false,
  })
  if (stripped && stripped !== live) return stripped

  return null
}

/**
 * Applies heading numbering attrs (and optional one-time text migration).
 */
function applyHeadingNumberUpdates({
  editor,
  updates,
  meta,
}: {
  editor: Editor
  updates: HeadingNumberUpdate[]
  meta: Record<string, unknown>
}): boolean {
  if (updates.length === 0) return false

  const { from } = editor.state.selection
  let transaction = editor.state.tr
  const ordered = [...updates].sort((a, b) => b.pos - a.pos)

  for (const update of ordered) {
    transaction = transaction.setNodeMarkup(update.pos, undefined, update.attrs)

    if (update.migrationText !== undefined) {
      const textFrom = update.pos + 1
      const textTo = update.pos + update.nodeSize - 1
      if (textFrom < textTo || update.migrationText.length > 0) {
        transaction = transaction.insertText(update.migrationText, textFrom, textTo)
      }
    }
  }

  const mappedFrom = transaction.mapping.map(from)
  try {
    transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(mappedFrom)))
  } catch {
    // Selection may be invalid after structural edits — leave default
  }

  transaction.setMeta(headingNumberingKey, meta)
  transaction.setMeta('addToHistory', false)
  editor.view.dispatch(transaction)
  return true
}

/**
 * Sets `headingNumberLabel` on each heading without mutating bare title text.
 *
 * Numbers are rendered in the editor via `data-heading-number` (CSS) and written
 * into markdown on serialise. Keeping the title in `textContent` avoids the
 * fragile strip/re-apply loop that previously turned headings into "Untitled"
 * or single-letter remnants.
 */
export function syncHeadingNumbersInEditor({
  editor,
  config,
  overrides = {},
}: {
  editor: Editor
  config: NumberingConfig
  overrides?: Record<string, HeadingNumberingOverride>
}): boolean {
  if (!config.enabled) {
    return clearHeadingNumbersInEditor({ editor })
  }

  const outline = buildOutlineFromDoc(editor.state.doc)
  const numbers = computeHeadingNumbers({
    outline,
    config,
    overridesByHeadingId: overrides,
  })

  const updates: HeadingNumberUpdate[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return

    const headingId = node.attrs.headingId as string | null
    if (!headingId) return

    const result = numbers.get(headingId)
    if (!result) return

    const nextLabel = result.displayLabel || null
    const currentLabel = (node.attrs.headingNumberLabel as string | null) ?? null
    const migrationText =
      nextLabel != null
        ? migrateLegacyNumberedHeadingText({
            text: node.textContent,
            displayLabel: nextLabel,
          })
        : null

    if (currentLabel === nextLabel && !migrationText) return

    const attrs = { ...node.attrs, headingNumberLabel: nextLabel }
    // Drop deprecated headingTitle — it caused titles to be overwritten on sync.
    delete attrs.headingTitle

    updates.push({
      pos,
      nodeSize: node.nodeSize,
      attrs,
      ...(migrationText ? { migrationText } : {}),
    })
  })

  return applyHeadingNumberUpdates({ editor, updates, meta: { sync: true } })
}

/**
 * Clears numbering labels and migrates any legacy inline prefixes out of text.
 */
export function clearHeadingNumbersInEditor({ editor }: { editor: Editor }): boolean {
  const updates: HeadingNumberUpdate[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return

    const currentLabel = (node.attrs.headingNumberLabel as string | null) ?? null
    const live = node.textContent.trim()

    let migrationText: string | undefined
    if (currentLabel) {
      migrationText =
        migrateLegacyNumberedHeadingText({ text: live, displayLabel: currentLabel }) ?? undefined
    } else {
      const stripped = stripNumberingPrefix({ text: live, loose: false })
      if (stripped && stripped !== live) {
        migrationText = stripped
      }
    }

    const hasLegacyTitle = Boolean(node.attrs.headingTitle)
    if (!currentLabel && !migrationText && !hasLegacyTitle) return

    const attrs = { ...node.attrs, headingNumberLabel: null }
    delete attrs.headingTitle

    updates.push({
      pos,
      nodeSize: node.nodeSize,
      attrs,
      ...(migrationText ? { migrationText } : {}),
    })
  })

  return applyHeadingNumberUpdates({ editor, updates, meta: { clear: true } })
}

/**
 * Returns true when a transaction was produced by the numbering sync/clear helpers.
 */
export function isHeadingNumberingTransaction(transaction: {
  getMeta: (key: PluginKey | string) => unknown
}): boolean {
  return Boolean(transaction.getMeta(headingNumberingKey))
}
