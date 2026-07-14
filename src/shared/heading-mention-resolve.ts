import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/** A heading resolved for mention display / suggestion listing. */
export interface ResolvedHeading {
  headingId: string
  text: string
  level: number
  pos: number
}

/** Placeholder shown when a mention's target heading no longer exists. */
export const HEADING_DELETED_LABEL = 'Heading deleted'

/**
 * Builds a map of headingId → heading metadata from a ProseMirror document.
 */
export function buildHeadingLookup({
  doc,
}: {
  doc: ProseMirrorNode
}): Map<string, ResolvedHeading> {
  const lookup = new Map<string, ResolvedHeading>()

  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const headingId = node.attrs.headingId as string | null
    if (!headingId) return

    lookup.set(headingId, {
      headingId,
      text: node.textContent || 'Untitled',
      level: node.attrs.level as number,
      pos,
    })
  })

  return lookup
}

/**
 * Resolves a single heading by its stable headingId.
 */
export function resolveHeadingById({
  doc,
  headingId,
}: {
  doc: ProseMirrorNode
  headingId: string | null | undefined
}): ResolvedHeading | null {
  if (!headingId) return null
  return buildHeadingLookup({ doc }).get(headingId) ?? null
}

/**
 * Returns the display label for a heading mention (with leading @ omitted).
 */
export function getHeadingMentionLabel({
  doc,
  headingId,
}: {
  doc: ProseMirrorNode
  headingId: string | null | undefined
}): { label: string; broken: boolean } {
  const resolved = resolveHeadingById({ doc, headingId })
  if (!resolved) {
    return { label: HEADING_DELETED_LABEL, broken: true }
  }
  return { label: resolved.text, broken: false }
}

/**
 * Lists all headings in document order for the @ mention suggestion popup.
 */
export function listHeadingsForMention({
  doc,
  query = '',
}: {
  doc: ProseMirrorNode
  query?: string
}): ResolvedHeading[] {
  const headings = Array.from(buildHeadingLookup({ doc }).values()).sort(
    (a, b) => a.pos - b.pos
  )
  const normalised = query.trim().toLowerCase()
  if (!normalised) return headings
  return headings.filter((heading) => heading.text.toLowerCase().includes(normalised))
}
