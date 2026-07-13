import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/**
 * Returns the editor plain text used for AI range resolution.
 */
export function documentPlainText({ doc }: { doc: ProseMirrorNode }): string {
  return doc.textBetween(0, doc.content.size, '\n')
}

/**
 * Normalises text for fuzzy matching between markdown and editor plain text.
 */
function normaliseSearchText({ text }: { text: string }): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Strips common markdown syntax so AI-provided text can match the editor plain text.
 */
function stripMarkdownForSearch({ text }: { text: string }): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Maps a plain-text offset from documentPlainText to a ProseMirror position.
 */
export function positionAtPlainOffset({
  doc,
  offset,
}: {
  doc: ProseMirrorNode
  offset: number
}): number | null {
  if (offset < 0) return null
  if (offset === 0) return 0

  const plainLength = documentPlainText({ doc }).length
  if (offset > plainLength) return null
  if (offset === plainLength) return doc.content.size

  let low = 0
  let high = doc.content.size

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const length = doc.textBetween(0, mid, '\n').length
    if (length < offset) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

/**
 * Clamps a ProseMirror range to the document bounds.
 */
export function clampDocumentRange({
  doc,
  from,
  to,
}: {
  doc: ProseMirrorNode
  from: number
  to: number
}): { from: number; to: number } | null {
  const max = doc.content.size
  const clampedFrom = Math.max(0, Math.min(from, max))
  const clampedTo = Math.max(0, Math.min(to, max))

  if (clampedFrom > clampedTo) return null
  return { from: clampedFrom, to: clampedTo }
}

/**
 * Finds the first plain-text match and maps it to a ProseMirror range.
 */
export function findTextRangeInDocument({
  doc,
  searchText,
}: {
  doc: ProseMirrorNode
  searchText: string
}): { from: number; to: number } | null {
  const needle = searchText.trim()
  if (!needle) return null

  const plainText = documentPlainText({ doc })
  const candidates = [
    needle,
    stripMarkdownForSearch({ text: needle }),
    normaliseSearchText({ text: needle }),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue

    const offsetRange = findOffsetRangeInPlainText({ plainText, candidate })
    if (!offsetRange) continue

    const mapped = mapPlainOffsetRangeToDocument({
      doc,
      start: offsetRange.start,
      end: offsetRange.end,
    })
    if (mapped) return mapped
  }

  return null
}

/**
 * Finds a candidate string within plain text, allowing flexible whitespace.
 */
function findOffsetRangeInPlainText({
  plainText,
  candidate,
}: {
  plainText: string
  candidate: string
}): { start: number; end: number } | null {
  const directIndex = plainText.indexOf(candidate)
  if (directIndex !== -1) {
    return { start: directIndex, end: directIndex + candidate.length }
  }

  const escaped = candidate
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
  const match = new RegExp(escaped, 'i').exec(plainText)
  if (match?.index !== undefined) {
    return { start: match.index, end: match.index + match[0].length }
  }

  return null
}

/**
 * Maps a plain-text offset range to a ProseMirror document range.
 */
function mapPlainOffsetRangeToDocument({
  doc,
  start,
  end,
}: {
  doc: ProseMirrorNode
  start: number
  end: number
}): { from: number; to: number } | null {
  const from = positionAtPlainOffset({ doc, offset: start })
  const to = positionAtPlainOffset({ doc, offset: end })
  if (from === null || to === null || from > to) return null
  if (from === to) {
    return { from, to: Math.min(from + 1, doc.content.size) }
  }
  return { from, to }
}

/**
 * Resolves an AI edit range against the live document.
 */
export function resolveEditRange({
  doc,
  from,
  to,
  originalText,
}: {
  doc: ProseMirrorNode
  from?: number
  to?: number
  originalText?: string
}): { from: number; to: number; originalText: string } | null {
  if (originalText?.trim()) {
    const found = findTextRangeInDocument({ doc, searchText: originalText })
    if (found) {
      return {
        ...found,
        originalText: originalText.trim(),
      }
    }

    const trimmed = originalText.trim()
    if (trimmed.length > 16) {
      const partial = findTextRangeInDocument({ doc, searchText: trimmed.slice(0, 24) })
      if (partial) {
        return {
          ...partial,
          originalText: doc.textBetween(partial.from, partial.to, '\n'),
        }
      }
    }
  }

  if (typeof from === 'number' && typeof to === 'number') {
    const clamped = clampDocumentRange({ doc, from, to })
    if (clamped) {
      const resolvedOriginal =
        originalText?.trim() ||
        (clamped.from < clamped.to ? doc.textBetween(clamped.from, clamped.to, '\n') : '')

      return {
        ...clamped,
        originalText: resolvedOriginal,
      }
    }
  }

  return null
}

/**
 * Builds a short human-readable summary for a single edit.
 */
export function summariseEdit({
  originalText,
  replacement,
  rationale,
}: {
  originalText: string
  replacement: string
  rationale?: string
}): string {
  if (rationale?.trim()) return rationale.trim()

  const original = truncateForSummary({ text: originalText })
  const next = truncateForSummary({ text: replacement })

  if (!original && next) return `Insert "${next}"`
  if (original && !next) return `Remove "${original}"`
  if (original && next) return `Replace "${original}" with "${next}"`
  return 'Proposed an edit'
}

function truncateForSummary({ text }: { text: string }): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 48) return cleaned
  return `${cleaned.slice(0, 45)}…`
}
