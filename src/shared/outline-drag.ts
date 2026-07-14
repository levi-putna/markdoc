import type { FlatOutlineItem } from './types'

/**
 * Returns true when `active` is a descendant of `candidate` in the flat outline.
 */
export function isDescendantOf({
  active,
  candidate,
  flatItems,
}: {
  active: FlatOutlineItem
  candidate: FlatOutlineItem
  flatItems: FlatOutlineItem[]
}): boolean {
  let parentId = active.parentId
  while (parentId) {
    if (parentId === candidate.id) return true
    parentId = flatItems.find((item) => item.id === parentId)?.parentId ?? null
  }
  return false
}

/**
 * Projects nesting depth from horizontal drag offset (Notion/Linear convention).
 */
export function projectDropDepth({
  activeDepth,
  deltaX,
  indentPx = 12,
}: {
  activeDepth: number
  deltaX: number
  indentPx?: number
}): number {
  const delta = Math.round(deltaX / indentPx)
  return Math.max(0, activeDepth + delta)
}

/**
 * Converts outline tree depth (0-based) to a heading level (1–6).
 */
export function depthToHeadingLevel(depth: number): number {
  return Math.min(6, depth + 1)
}

/**
 * Returns whether a drop at `projectedDepth` is valid for the dragged heading.
 */
export function isValidDrop({
  activeItem,
  overItem,
  projectedDepth,
  flatItems,
}: {
  activeItem: FlatOutlineItem
  overItem: FlatOutlineItem
  projectedDepth: number
  flatItems: FlatOutlineItem[]
}): boolean {
  if (activeItem.id === overItem.id) return false
  if (isDescendantOf({ active: overItem, candidate: activeItem, flatItems })) return false
  if (depthToHeadingLevel(projectedDepth) > 6) return false
  return true
}

/**
 * Computes heading-level delta when re-nesting a moved section.
 */
export function computeHeadingLevelDelta({
  originalLevel,
  projectedDepth,
}: {
  originalLevel: number
  projectedDepth: number
}): number {
  const targetLevel = depthToHeadingLevel(projectedDepth)
  return targetLevel - originalLevel
}

/**
 * Finds the previous sibling of `item` at the same outline depth, if any.
 */
export function findPreviousSibling({
  item,
  flatItems,
}: {
  item: FlatOutlineItem
  flatItems: FlatOutlineItem[]
}): FlatOutlineItem | null {
  const index = flatItems.findIndex((entry) => entry.id === item.id)
  if (index <= 0) return null

  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = flatItems[i]
    if (candidate.depth < item.depth) return null
    if (candidate.depth === item.depth) return candidate
  }
  return null
}

/**
 * Returns whether the heading can be indented under the sibling above it.
 */
export function canIndentOutlineItem({
  item,
  flatItems,
}: {
  item: FlatOutlineItem
  flatItems: FlatOutlineItem[]
}): boolean {
  if (item.level >= 6) return false
  return findPreviousSibling({ item, flatItems }) != null
}

/**
 * Returns whether the heading can be outdented to become a peer of its parent.
 */
export function canOutdentOutlineItem({
  item,
}: {
  item: FlatOutlineItem
}): boolean {
  return item.depth > 0 && item.level > 1
}
