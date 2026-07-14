import { describe, it, expect } from 'vitest'
import {
  isDescendantOf,
  isValidDrop,
  projectDropDepth,
  computeHeadingLevelDelta,
  canIndentOutlineItem,
  canOutdentOutlineItem,
  findPreviousSibling,
} from '@shared/outline-drag'
import type { FlatOutlineItem } from '@shared/types'
import { loadMarkdownIntoEditor, getMarkdownFromEditor } from '@shared/markdown'
import { buildOutlineFromDoc, flattenOutline } from '@shared/document-index'
import { shiftSectionNestingInEditor } from '@shared/outline-sync'

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

  it('finds the previous sibling at the same depth', () => {
    expect(findPreviousSibling({ item: flatItems[2], flatItems })?.id).toBe('h2')
    expect(findPreviousSibling({ item: flatItems[1], flatItems })).toBeNull()
  })

  it('allows indent only when a previous sibling exists', () => {
    expect(canIndentOutlineItem({ item: flatItems[2], flatItems })).toBe(true)
    expect(canIndentOutlineItem({ item: flatItems[1], flatItems })).toBe(false)
    expect(canIndentOutlineItem({ item: flatItems[0], flatItems })).toBe(false)
  })

  it('allows outdent only when the heading is nested', () => {
    expect(canOutdentOutlineItem({ item: flatItems[0] })).toBe(false)
    expect(canOutdentOutlineItem({ item: flatItems[1] })).toBe(true)
  })
})

describe('shiftSectionNestingInEditor', () => {
  it('indents a heading under the sibling above it', () => {
    const editor = loadMarkdownIntoEditor(`# Root

## First

## Second
`)
    const flat = flattenOutline(buildOutlineFromDoc(editor.state.doc))
    const second = flat.find((item) => item.text === 'Second')
    expect(second).toBeTruthy()

    shiftSectionNestingInEditor({ editor, item: second!, delta: 1 })
    const outline = buildOutlineFromDoc(editor.state.doc)
    expect(outline[0].children).toHaveLength(1)
    expect(outline[0].children[0].text).toBe('First')
    expect(outline[0].children[0].children[0].text).toBe('Second')
    expect(getMarkdownFromEditor(editor)).toContain('### Second')
    editor.destroy()
  })

  it('outdents a heading to a peer of its parent', () => {
    const editor = loadMarkdownIntoEditor(`# Root

## Parent

### Child
`)
    const flat = flattenOutline(buildOutlineFromDoc(editor.state.doc))
    const child = flat.find((item) => item.text === 'Child')
    expect(child).toBeTruthy()

    shiftSectionNestingInEditor({ editor, item: child!, delta: -1 })
    const outline = buildOutlineFromDoc(editor.state.doc)
    expect(outline[0].children.map((c) => c.text)).toEqual(['Parent', 'Child'])
    expect(getMarkdownFromEditor(editor)).toContain('## Child')
    editor.destroy()
  })
})
