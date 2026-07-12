import { describe, it, expect } from 'vitest'
import {
  isDescendantOf,
  isValidDrop,
  projectDropDepth,
  computeHeadingLevelDelta,
} from '@shared/outline-drag'
import type { FlatOutlineItem } from '@shared/types'

const flatItems: FlatOutlineItem[] = [
  { id: 'h1', text: 'One', level: 1, depth: 0, pos: 0, sectionEnd: 100, parentId: null },
  { id: 'h2', text: 'Two', level: 2, depth: 1, pos: 10, sectionEnd: 50, parentId: 'h1' },
  { id: 'h3', text: 'Three', level: 2, depth: 1, pos: 60, sectionEnd: 90, parentId: 'h1' },
]

describe('outline drag helpers', () => {
  it('detects descendant relationships', () => {
    expect(
      isDescendantOf({
        active: flatItems[1],
        candidate: flatItems[0],
        flatItems,
      })
    ).toBe(true)
  })

  it('projects depth from horizontal drag offset', () => {
    expect(projectDropDepth({ activeDepth: 1, deltaX: 12 })).toBe(2)
    expect(projectDropDepth({ activeDepth: 1, deltaX: -12 })).toBe(0)
  })

  it('rejects drops into descendant sections', () => {
    expect(
      isValidDrop({
        activeItem: flatItems[0],
        overItem: flatItems[1],
        projectedDepth: 2,
        flatItems,
      })
    ).toBe(false)
  })

  it('computes heading level delta on re-nest', () => {
    expect(computeHeadingLevelDelta({ originalLevel: 2, projectedDepth: 0 })).toBe(-1)
  })
})
