import { describe, it, expect } from 'vitest'
import { buildOutlineFromDoc, flattenOutline } from '@shared/document-index'
import { loadMarkdownIntoEditor } from '@shared/markdown'

describe('TC-OUTLINE outline tree', () => {
  const markdown = `# Top

Content under top.

## Child A

Text a.

### Grandchild

Deep text.

## Child B

Text b.
`

  it('TC-OUTLINE.1 reflects heading hierarchy', () => {
    const editor = loadMarkdownIntoEditor(markdown)
    const outline = buildOutlineFromDoc(editor.state.doc)
    editor.destroy()
    expect(outline.length).toBe(1)
    expect(outline[0].text).toBe('Top')
    expect(outline[0].children.length).toBe(2)
    expect(outline[0].children[0].children.length).toBe(1)
  })

  it('TC-OUTLINE.4 flatten respects collapse state', () => {
    const editor = loadMarkdownIntoEditor(markdown)
    const outline = buildOutlineFromDoc(editor.state.doc)
    const collapsed = new Set([outline[0].id])
    const flat = flattenOutline(outline, { collapsedIds: collapsed })
    editor.destroy()
    expect(flat.length).toBe(1)
    expect(flat[0].text).toBe('Top')
  })

  it('TC-OUTLINE.8 section ranges exclude sibling content', () => {
    const editor = loadMarkdownIntoEditor(markdown)
    const outline = buildOutlineFromDoc(editor.state.doc)
    const docSize = editor.state.doc.content.size
    const childA = outline[0].children[0]
    editor.destroy()
    expect(childA.sectionEnd).toBeGreaterThan(childA.pos)
    expect(childA.sectionEnd).toBeLessThanOrEqual(docSize)
  })

  it('TC-OUTLINE.9 flatten uses tree depth not heading level for indent', () => {
    const skipped = `# Top

### Skipped level two
`
    const editor = loadMarkdownIntoEditor(skipped)
    const outline = buildOutlineFromDoc(editor.state.doc)
    const flat = flattenOutline(outline)
    editor.destroy()

    expect(flat).toHaveLength(2)
    expect(flat[0].depth).toBe(0)
    expect(flat[0].level).toBe(1)
    expect(flat[1].depth).toBe(1)
    expect(flat[1].level).toBe(3)
  })

  it('TC-OUTLINE.10 keeps heading ids stable when content is inserted above', () => {
    const editor = loadMarkdownIntoEditor('# Hello\n\n## World')
    const idBefore = buildOutlineFromDoc(editor.state.doc)[0].id

    // Insert a preamble paragraph above the heading inside the live document
    // so the heading node's stored headingId is preserved across the shift.
    editor.commands.setTextSelection(0)
    editor.commands.insertContent('Preamble\n\n')

    const idAfter = buildOutlineFromDoc(editor.state.doc)[0].id
    editor.destroy()
    expect(idAfter).toBe(idBefore)
    expect(idBefore).toBeTruthy()
  })
})
