import { describe, it, expect } from 'vitest'
import { loadMarkdownIntoEditor, getMarkdownFromEditor, markdownRoundTrip } from '@shared/markdown'
import { preprocessGfmExtensions, postprocessGfmExtensions } from '@shared/markdown-gfm'
import { buildOutlineFromDoc } from '@shared/document-index'
import {
  getHeadingMentionLabel,
  HEADING_DELETED_LABEL,
  listHeadingsForMention,
  resolveHeadingById,
} from '@shared/heading-mention-resolve'
import { prepareHtmlForExport, bookmarkIdForHeading } from '@shared/heading-mention-export'
import { exportToDocx } from '@shared/export'

describe('heading mentions', () => {
  it('assigns persistent headingId attributes to headings on load', () => {
    const editor = loadMarkdownIntoEditor('# Hello\n\n## World')
    const ids: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        expect(node.attrs.headingId).toBeTruthy()
        ids.push(node.attrs.headingId as string)
      }
    })
    editor.destroy()
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('uses stored headingId in the outline', () => {
    const editor = loadMarkdownIntoEditor('# Hello')
    const outline = buildOutlineFromDoc(editor.state.doc)
    let storedId: string | null = null
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') storedId = node.attrs.headingId as string
    })
    editor.destroy()
    expect(outline[0].id).toBe(storedId)
  })

  it('keeps headingId when the heading text is renamed', () => {
    const editor = loadMarkdownIntoEditor('# Hello')
    let headingPos = 0
    let headingId = ''
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headingPos = pos
        headingId = node.attrs.headingId as string
      }
    })

    editor.commands.setTextSelection(headingPos + 1)
    editor.commands.insertContent(' Renamed')

    let afterId = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') afterId = node.attrs.headingId as string
    })
    editor.destroy()
    expect(afterId).toBe(headingId)
  })

  it('round-trips [@Label](heading://id) through preprocess/postprocess', () => {
    const source = 'See [@Introduction](heading://abc123) for details.'
    const processed = preprocessGfmExtensions(source)
    expect(processed).toContain('data-heading-mention')
    expect(processed).toContain('data-heading-id="abc123"')
    const restored = postprocessGfmExtensions(processed)
    expect(restored).toContain('[@Introduction](heading://abc123)')
  })

  it('round-trips a heading mention through the editor', () => {
    const editor = loadMarkdownIntoEditor('# Introduction\n\nBody')
    let headingId = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') headingId = node.attrs.headingId as string
    })

    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent({
      type: 'headingMention',
      attrs: { headingId },
    })

    const markdown = getMarkdownFromEditor(editor)
    expect(markdown).toMatch(/\[@Introduction\]\(heading:\/\/[^)]+\)/)

    const reloaded = loadMarkdownIntoEditor(markdown)
    let mentionCount = 0
    let mentionId = ''
    reloaded.state.doc.descendants((node) => {
      if (node.type.name === 'headingMention') {
        mentionCount += 1
        mentionId = node.attrs.headingId as string
      }
    })
    editor.destroy()
    reloaded.destroy()
    expect(mentionCount).toBe(1)
    expect(mentionId).toBe(headingId)
  })

  it('updates the mention label when the heading is renamed', () => {
    const editor = loadMarkdownIntoEditor('# Introduction\n\nSee here')
    let headingId = ''
    let headingPos = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headingId = node.attrs.headingId as string
        headingPos = pos
      }
    })

    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent({
      type: 'headingMention',
      attrs: { headingId },
    })

    // Replace heading text
    const headingNode = editor.state.doc.nodeAt(headingPos)
    expect(headingNode).toBeTruthy()
    editor
      .chain()
      .setTextSelection({ from: headingPos + 1, to: headingPos + headingNode!.nodeSize - 1 })
      .insertContent('Updated Title')
      .run()

    const { label, broken } = getHeadingMentionLabel({
      doc: editor.state.doc,
      headingId,
    })
    editor.destroy()
    expect(broken).toBe(false)
    expect(label).toBe('Updated Title')
  })

  it('marks mentions as broken when the heading is deleted', () => {
    const editor = loadMarkdownIntoEditor('# Introduction\n\nSee here')
    let headingId = ''
    let headingPos = 0
    let headingSize = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headingId = node.attrs.headingId as string
        headingPos = pos
        headingSize = node.nodeSize
      }
    })

    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent({
      type: 'headingMention',
      attrs: { headingId },
    })

    editor.commands.deleteRange({ from: headingPos, to: headingPos + headingSize })

    const { label, broken } = getHeadingMentionLabel({
      doc: editor.state.doc,
      headingId,
    })
    editor.destroy()
    expect(broken).toBe(true)
    expect(label).toBe(HEADING_DELETED_LABEL)
  })

  it('keeps mentions resolving after the heading is moved', () => {
    const editor = loadMarkdownIntoEditor('# First\n\n## Second\n\nBody')
    const headings: Array<{ id: string; text: string; pos: number; size: number }> = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({
          id: node.attrs.headingId as string,
          text: node.textContent,
          pos,
          size: node.nodeSize,
        })
      }
    })

    const second = headings.find((h) => h.text === 'Second')!
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent({
      type: 'headingMention',
      attrs: { headingId: second.id },
    })

    // Move "Second" to the top by cutting and inserting at the start
    const slice = editor.state.doc.slice(second.pos, second.pos + second.size)
    const { tr } = editor.state
    tr.delete(second.pos, second.pos + second.size)
    tr.insert(0, slice.content)
    editor.view.dispatch(tr)

    const resolved = resolveHeadingById({ doc: editor.state.doc, headingId: second.id })
    editor.destroy()
    expect(resolved?.text).toBe('Second')
  })

  it('lists headings for the suggestion popup', () => {
    const editor = loadMarkdownIntoEditor('# Alpha\n\n## Beta\n\n### Gamma')
    const all = listHeadingsForMention({ doc: editor.state.doc })
    const filtered = listHeadingsForMention({ doc: editor.state.doc, query: 'bet' })
    editor.destroy()
    expect(all).toHaveLength(3)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].text).toBe('Beta')
  })

  it('prepares HTML export with id anchors and fragment links', () => {
    const html =
      '<h2 data-heading-id="abc123">Intro</h2><p>See <a data-heading-mention data-heading-id="abc123" href="heading://abc123" class="heading-mention">@Intro</a></p>'
    const prepared = prepareHtmlForExport({ html })
    expect(prepared).toContain('id="abc123"')
    expect(prepared).toContain('href="#abc123"')
    expect(prepared).not.toContain('href="heading://')
  })

  it('builds Word-safe bookmark ids', () => {
    expect(bookmarkIdForHeading({ headingId: 'abc-123' })).toBe('md_abc-123')
  })

  it('exports documents containing heading mentions to DOCX without throwing', async () => {
    const editor = loadMarkdownIntoEditor('# Introduction\n\nSee here')
    let headingId = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') headingId = node.attrs.headingId as string
    })
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent({
      type: 'headingMention',
      attrs: { headingId },
    })

    const { buffer, warnings } = await exportToDocx({
      doc: editor.getJSON(),
      title: 'Mention Test',
    })
    editor.destroy()
    expect(buffer.length).toBeGreaterThan(0)
    expect(warnings).toEqual([])
  })

  it('preserves heading ids through markdownRoundTrip when present', () => {
    const source = '# Hello {#fixed-id-01}\n\nBody'
    const result = markdownRoundTrip(source)
    expect(result).toContain('{#fixed-id-01}')
    expect(result).toContain('Hello')
  })
})
