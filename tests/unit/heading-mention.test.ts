import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { loadMarkdownIntoEditor, getMarkdownFromEditor, markdownRoundTrip } from '@shared/markdown'
import {
  preprocessGfmExtensions,
  postprocessGfmExtensions,
  extractHeadingIdsFromMarkdown,
} from '@shared/markdown-gfm'
import { buildOutlineFromDoc } from '@shared/document-index'
import {
  getHeadingMentionLabel,
  HEADING_DELETED_LABEL,
  listHeadingsForMention,
  resolveHeadingById,
  shouldOpenMentionPopupUpwards,
} from '@shared/heading-mention-resolve'
import { prepareHtmlForExport, bookmarkIdForHeading } from '@shared/heading-mention-export'
import { exportToDocx } from '@shared/export'

const fixturesDir = join(__dirname, '../fixtures')

describe('TC-MENTION heading mentions', () => {
  it('TC-MENTION.1 assigns persistent headingId attributes to headings on load', () => {
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

  it('TC-MENTION.2 uses stored headingId in the outline', () => {
    const editor = loadMarkdownIntoEditor('# Hello')
    const outline = buildOutlineFromDoc(editor.state.doc)
    let storedId: string | null = null
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') storedId = node.attrs.headingId as string
    })
    editor.destroy()
    expect(outline[0].id).toBe(storedId)
  })

  it('TC-MENTION.3 keeps headingId when the heading text is renamed', () => {
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

  it('TC-MENTION.4 keeps headingId when content is inserted above', () => {
    const editor = loadMarkdownIntoEditor('# Hello\n\n## World')
    const idBefore = buildOutlineFromDoc(editor.state.doc)[0].id
    editor.commands.setTextSelection(0)
    editor.commands.insertContent('Preamble\n\n')
    const idAfter = buildOutlineFromDoc(editor.state.doc)[0].id
    editor.destroy()
    expect(idAfter).toBe(idBefore)
  })

  it('TC-MENTION.5 round-trips [@Label](heading://id) through preprocess/postprocess', () => {
    const source = 'See [@Introduction](heading://abc123) for details.'
    const processed = preprocessGfmExtensions(source)
    expect(processed).toContain('data-heading-mention')
    expect(processed).toContain('data-heading-id="abc123"')
    const restored = postprocessGfmExtensions(processed)
    expect(restored).toContain('[@Introduction](heading://abc123)')
  })

  it('TC-MENTION.6 round-trips a heading mention through the editor', () => {
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

  it('TC-MENTION.7 updates the mention label when the heading is renamed', () => {
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

  it('TC-MENTION.8 keeps the previous heading name in red when deleted', () => {
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
      attrs: { headingId, label: 'Introduction' },
    })

    editor.commands.deleteRange({ from: headingPos, to: headingPos + headingSize })

    const { label, broken } = getHeadingMentionLabel({
      doc: editor.state.doc,
      headingId,
      cachedLabel: 'Introduction',
    })

    let mentionLabel: string | null = null
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'headingMention') {
        mentionLabel = node.attrs.label as string
      }
    })
    editor.destroy()
    expect(broken).toBe(true)
    expect(label).toBe('Introduction')
    expect(mentionLabel).toBe('Introduction')
    expect(label).not.toBe(HEADING_DELETED_LABEL)
  })

  it('TC-MENTION.8a relinks a broken mention to another heading', () => {
    const editor = loadMarkdownIntoEditor('# Keep Me\n\n## Gone Soon\n\nBody')
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

    const keep = headings.find((h) => h.text === 'Keep Me')!
    const gone = headings.find((h) => h.text === 'Gone Soon')!

    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent({
      type: 'headingMention',
      attrs: { headingId: gone.id, label: 'Gone Soon' },
    })

    editor.commands.deleteRange({ from: gone.pos, to: gone.pos + gone.size })

    let mentionPos = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'headingMention') mentionPos = pos
    })
    expect(mentionPos).toBeGreaterThanOrEqual(0)

    editor
      .chain()
      .command(({ tr, dispatch }) => {
        const node = tr.doc.nodeAt(mentionPos)
        if (!node || node.type.name !== 'headingMention') return false
        if (dispatch) {
          tr.setNodeMarkup(mentionPos, undefined, {
            ...node.attrs,
            headingId: keep.id,
            label: keep.text,
          })
        }
        return true
      })
      .run()

    const { label, broken } = getHeadingMentionLabel({
      doc: editor.state.doc,
      headingId: keep.id,
      cachedLabel: keep.text,
    })
    editor.destroy()
    expect(broken).toBe(false)
    expect(label).toBe('Keep Me')
  })

  it('TC-MENTION.9 keeps mentions resolving after the heading is moved', () => {
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

    const slice = editor.state.doc.slice(second.pos, second.pos + second.size)
    const { tr } = editor.state
    tr.delete(second.pos, second.pos + second.size)
    tr.insert(0, slice.content)
    editor.view.dispatch(tr)

    const resolved = resolveHeadingById({ doc: editor.state.doc, headingId: second.id })
    editor.destroy()
    expect(resolved?.text).toBe('Second')
  })

  it('TC-MENTION.10 lists headings for the suggestion popup', () => {
    const editor = loadMarkdownIntoEditor('# Alpha\n\n## Beta\n\n### Gamma')
    const all = listHeadingsForMention({ doc: editor.state.doc })
    const filtered = listHeadingsForMention({ doc: editor.state.doc, query: 'bet' })
    editor.destroy()
    expect(all).toHaveLength(3)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].text).toBe('Beta')
  })

  it('TC-MENTION.11 preserves heading ids through markdownRoundTrip when present', () => {
    const source = '# Hello {#fixed-id-01}\n\nBody'
    const result = markdownRoundTrip(source)
    expect(result).toContain('{#fixed-id-01}')
    expect(result).toContain('Hello')
  })

  it('TC-MENTION.12 prepares HTML export with id anchors and fragment links', () => {
    const html =
      '<h2 data-heading-id="abc123">Intro</h2><p>See <a data-heading-mention data-heading-id="abc123" href="heading://abc123" class="heading-mention">@Intro</a></p>'
    const prepared = prepareHtmlForExport({ html })
    expect(prepared).toContain('id="abc123"')
    expect(prepared).toContain('href="#abc123"')
    expect(prepared).not.toContain('href="heading://')
  })

  it('TC-MENTION.13 exports documents containing heading mentions to DOCX without throwing', async () => {
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

  it('TC-MENTION.16 opens the popup upwards only in the bottom half of the viewport', () => {
    expect(shouldOpenMentionPopupUpwards({ caretTop: 100, viewportHeight: 800 })).toBe(false)
    expect(shouldOpenMentionPopupUpwards({ caretTop: 400, viewportHeight: 800 })).toBe(true)
    expect(shouldOpenMentionPopupUpwards({ caretTop: 399, viewportHeight: 800 })).toBe(false)
  })

  it('loads the heading-mentions fixture with stable ids and mention nodes', () => {
    const source = readFileSync(join(fixturesDir, 'heading-mentions.md'), 'utf-8')
    expect(extractHeadingIdsFromMarkdown({ markdown: source })).toEqual([
      'intro-heading',
      'details-heading',
    ])

    const editor = loadMarkdownIntoEditor(source)
    const outline = buildOutlineFromDoc(editor.state.doc)
    expect(outline[0].id).toBe('intro-heading')
    expect(outline[0].children[0].id).toBe('details-heading')

    let mentionCount = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'headingMention') mentionCount += 1
    })
    editor.destroy()
    expect(mentionCount).toBe(2)
  })

  it('builds Word-safe bookmark ids', () => {
    expect(bookmarkIdForHeading({ headingId: 'abc-123' })).toBe('md_abc-123')
  })
})
