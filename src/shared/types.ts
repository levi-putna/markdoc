import type { JSONContent } from '@tiptap/core'

/** A single heading node in the document outline tree. */
export interface OutlineNode {
  id: string
  text: string
  level: number
  pos: number
  /** End position of this heading's section (exclusive). */
  sectionEnd: number
  children: OutlineNode[]
}

/** Flat representation of an outline node for drag-and-drop. */
export interface FlatOutlineItem {
  id: string
  text: string
  level: number
  /** Nesting depth in the outline tree (0 = root). */
  depth: number
  pos: number
  sectionEnd: number
  parentId: string | null
  collapsed?: boolean
}

/** Document search result entry. */
export interface SearchResult {
  id: string
  text: string
  type: 'heading' | 'body'
  pos: number
  score: number
}

/** Document size tier for performance degradation. */
export type DocumentSizeTier = 'standard' | 'large' | 'very-large'

export const TIER_THRESHOLDS = {
  standard: { words: 10_000, bytes: 2 * 1024 * 1024 },
  large: { words: 100_000, bytes: 20 * 1024 * 1024 },
} as const

/**
 * Determines the document size tier from word count and byte size.
 */
export function getDocumentSizeTier({
  wordCount,
  byteSize,
}: {
  wordCount: number
  byteSize: number
}): DocumentSizeTier {
  if (wordCount > TIER_THRESHOLDS.large.words || byteSize > TIER_THRESHOLDS.large.bytes) {
    return 'very-large'
  }
  if (wordCount > TIER_THRESHOLDS.standard.words || byteSize > TIER_THRESHOLDS.standard.bytes) {
    return 'large'
  }
  return 'standard'
}

/**
 * Returns debounce interval in ms based on document tier.
 */
export function getDebounceMs(tier: DocumentSizeTier): number {
  switch (tier) {
    case 'large':
      return 750
    case 'very-large':
      return 1000
    default:
      return 200
  }
}

export type { JSONContent }
