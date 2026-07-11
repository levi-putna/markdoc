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

  it('TC-OUTLINE.10 uses stable heading ids when positions shift', () => {
    const before = loadMarkdownIntoEditor('# Hello\n\n## World')
    const after = loadMarkdownIntoEditor('Preamble\n\n# Hello\n\n## World')
    const idBefore = buildOutlineFromDoc(before.state.doc)[0].id
    const idAfter = buildOutlineFromDoc(after.state.doc)[0].id
    before.destroy()
    after.destroy()
    expect(idBefore).toBe(idAfter)
    expect(idBefore).toBe('h1-hello-0')
  })
})
