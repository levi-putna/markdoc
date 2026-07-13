import type { Editor } from '@tiptap/core'
import { DOMParser, Slice } from '@tiptap/pm/model'
import { findTextRangeInDocument, resolveEditRange } from './ai-edit-positions'

/**
 * Returns true when replacement markdown should be parsed as block content.
 */
export function hasBlockMarkdown({ text }: { text: string }): boolean {
  return (
    /(^|\n)\s*#{1,6}\s/.test(text) ||
    /(^|\n)\s*[-*+]\s/.test(text) ||
    /(^|\n)\s*\d+\.\s/.test(text) ||
    /\n\n/.test(text) ||
    /(^|\n)```/.test(text)
  )
}

/**
 * Parses AI replacement markdown into a ProseMirror slice for insertion.
 */
export function buildReplacementSlice({
  editor,
  replacement,
}: {
  editor: Editor
  replacement: string
}): Slice {
  const markdownStorage = editor.storage.markdown as {
    parser?: { parse: (content: string, options?: { inline?: boolean }) => string }
  } | undefined

  if (!replacement.trim()) {
    return Slice.empty
  }

  let html = replacement
  if (markdownStorage?.parser) {
    html = markdownStorage.parser.parse(replacement, {
      inline: !hasBlockMarkdown({ text: replacement }),
    })
  }

  const element = document.createElement('div')
  element.innerHTML = html
  return DOMParser.fromSchema(editor.schema).parseSlice(element, {
    preserveWhitespace: 'full',
  })
}

/**
 * Resolves and validates a suggestion range immediately before applying it.
 */
export function resolveSuggestionRange({
  editor,
  from,
  to,
  originalText,
}: {
  editor: Editor
  from: number
  to: number
  originalText?: string
}) {
  const resolved = resolveEditRange({
    doc: editor.state.doc,
    from,
    to,
    originalText,
  })

  if (!resolved) return null

  const actualText = editor.state.doc.textBetween(resolved.from, resolved.to, '\n')
  const expected = originalText?.trim()

  if (expected && !textsRoughlyMatch({ actual: actualText, expected })) {
    const refound = findTextRangeInDocument({
      doc: editor.state.doc,
      searchText: expected,
    })

    if (!refound) return null

    return {
      from: refound.from,
      to: refound.to,
      originalText: editor.state.doc.textBetween(refound.from, refound.to, '\n'),
    }
  }

  return resolved
}

function textsRoughlyMatch({ actual, expected }: { actual: string; expected: string }): boolean {
  const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
  const left = normalise(actual)
  const right = normalise(expected)

  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}
