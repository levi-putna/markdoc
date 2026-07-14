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
 * Returns whether the mention popup should open above the caret
 * (bottom half of the viewport) or below it (top half).
 */
export function shouldOpenMentionPopupUpwards({
  caretTop,
  viewportHeight,
}: {
  caretTop: number
  viewportHeight: number
}): boolean {
  return caretTop >= viewportHeight / 2
}

/** Viewport margin used to keep mention popups off screen edges. */
export const MENTION_POPUP_VIEWPORT_MARGIN = 8

/** Gap between the caret/chip and the mention popup. */
export const MENTION_POPUP_ANCHOR_GAP = 4

/**
 * Resolves horizontal placement for a mention popup (viewport coordinates).
 *
 * Follows common combobox / typeahead patterns (VS Code, Slack, Floating UI):
 * 1. Prefer opening to the right of the caret with left edges aligned.
 * 2. If that would overflow the right edge, flip so the menu grows leftward
 *    from the caret — natural when typing `@` near the right margin.
 * 3. If the menu is wider than the viewport, clamp it inside the margins.
 */
export function resolveMentionPopupHorizontalPlacement({
  anchorLeft,
  popupWidth,
  viewportWidth,
  margin = MENTION_POPUP_VIEWPORT_MARGIN,
}: {
  anchorLeft: number
  popupWidth: number
  viewportWidth: number
  margin?: number
}): {
  left: number
  flipLeft: boolean
} {
  const spaceRight = viewportWidth - anchorLeft - margin
  const spaceLeft = anchorLeft - margin

  if (popupWidth <= spaceRight) {
    return { left: anchorLeft, flipLeft: false }
  }

  if (popupWidth <= spaceLeft) {
    return { left: anchorLeft, flipLeft: true }
  }

  return {
    left: Math.max(margin, viewportWidth - margin - popupWidth),
    flipLeft: false,
  }
}

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
 * Reads the computed numbering label stored on a heading node.
 */
export function getHeadingNumberLabel({
  doc,
  headingId,
}: {
  doc: ProseMirrorNode
  headingId: string | null | undefined
}): string | null {
  const resolved = resolveHeadingById({ doc, headingId })
  if (!resolved) return null
  const headingNode = doc.nodeAt(resolved.pos)
  if (!headingNode || headingNode.type.name !== 'heading') return null
  const label = headingNode.attrs.headingNumberLabel as string | null | undefined
  return label?.trim() || null
}

/**
 * Builds the visible @mention text, optionally prefixing the bare title with
 * the heading's computed number label.
 */
export function formatHeadingMentionDisplay({
  title,
  numberLabel,
  showNumber = false,
}: {
  title: string
  numberLabel?: string | null
  showNumber?: boolean
}): string {
  const bare = title.trim()
  if (!showNumber || !numberLabel?.trim() || !bare) return bare
  return `${numberLabel.trim()} ${bare}`
}

/**
 * Returns the display label for a heading mention (with leading @ omitted).
 * When the target heading is gone, keeps the last-known `cachedLabel` so the
 * chip still shows what was deleted (styled red by the UI).
 */
export function getHeadingMentionLabel({
  doc,
  headingId,
  cachedLabel = null,
}: {
  doc: ProseMirrorNode
  headingId: string | null | undefined
  cachedLabel?: string | null
}): { label: string; broken: boolean } {
  const resolved = resolveHeadingById({ doc, headingId })
  if (!resolved) {
    const fallback = cachedLabel?.trim() || HEADING_DELETED_LABEL
    return { label: fallback, broken: true }
  }
  return { label: resolved.text, broken: false }
}

/**
 * Resolves the full visible mention label, optionally including numbering.
 */
export function getHeadingMentionDisplayLabel({
  doc,
  headingId,
  cachedLabel = null,
  showNumbersInMentions = false,
}: {
  doc: ProseMirrorNode
  headingId: string | null | undefined
  cachedLabel?: string | null
  showNumbersInMentions?: boolean
}): { label: string; display: string; broken: boolean } {
  const { label, broken } = getHeadingMentionLabel({ doc, headingId, cachedLabel })
  if (broken) {
    return { label, display: label, broken }
  }

  const numberLabel = showNumbersInMentions
    ? getHeadingNumberLabel({ doc, headingId })
    : null
  const display = formatHeadingMentionDisplay({
    title: label,
    numberLabel,
    showNumber: showNumbersInMentions,
  })

  return { label, display, broken }
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
