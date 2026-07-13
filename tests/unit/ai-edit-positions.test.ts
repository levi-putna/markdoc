import { describe, expect, it } from 'vitest'
import { Schema } from '@tiptap/pm/model'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from '../../src/shared/tiptap-extensions'
import {
  documentPlainText,
  findTextRangeInDocument,
  positionAtPlainOffset,
  resolveEditRange,
  summariseEdit,
} from '../../src/shared/ai-edit-positions'
import { buildReplacementSlice, resolveSuggestionRange } from '../../src/shared/ai-suggestion-apply'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
  },
})

function docFromText(text: string) {
  const lines = text.split('\n')
  return schema.node(
    'doc',
    null,
    lines.map((line) =>
      schema.node('paragraph', null, line ? [schema.text(line)] : undefined)
    )
  )
}

function createTestEditor(markdown: string) {
  const editor = new Editor({
    extensions: createTiptapExtensions(),
    content: markdown,
  })
  return editor
}

describe('ai-edit-positions', () => {
  it('maps plain-text offsets back to document positions', () => {
    const doc = docFromText('Hello world\nSecond line')
    const plainText = documentPlainText({ doc })

    expect(plainText).toBe('Hello world\nSecond line')
    expect(positionAtPlainOffset({ doc, offset: plainText.indexOf('Second') })).toBeGreaterThan(0)
  })

  it('finds a text range in the document', () => {
    const doc = docFromText('Rewrite this sentence.')
    const range = findTextRangeInDocument({ doc, searchText: 'this sentence' })

    expect(range).not.toBeNull()
    expect(doc.textBetween(range!.from, range!.to, '\n')).toBe('this sentence')
  })

  it('finds a text range with flexible whitespace', () => {
    const doc = docFromText('Rewrite this   sentence.')
    const range = findTextRangeInDocument({ doc, searchText: 'this sentence' })

    expect(range).not.toBeNull()
    expect(doc.textBetween(range!.from, range!.to, '\n')).toBe('this   sentence')
  })

  it('resolves edits using originalText fallback', () => {
    const doc = docFromText('Alpha beta gamma')
    const resolved = resolveEditRange({
      doc,
      originalText: 'beta',
      replacement: 'delta',
    })

    expect(resolved?.originalText).toBe('beta')
    expect(doc.textBetween(resolved!.from, resolved!.to, '\n')).toBe('beta')
  })

  it('summarises an edit for the assistant thread', () => {
    expect(
      summariseEdit({
        originalText: 'old intro',
        replacement: 'new intro',
      })
    ).toBe('Replace "old intro" with "new intro"')
  })
})

describe('ai-suggestion-apply', () => {
  it('applies inline markdown replacements without clearing the whole paragraph', () => {
    const editor = createTestEditor('Alpha beta gamma')
    const resolved = resolveSuggestionRange({
      editor,
      from: 1,
      to: editor.state.doc.content.size,
      originalText: 'beta',
    })

    expect(resolved).not.toBeNull()

    const slice = buildReplacementSlice({ editor, replacement: '**delta**' })
    const tr = editor.state.tr.replaceRange(resolved!.from, resolved!.to, slice)
    editor.view.dispatch(tr)

    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).toContain('delta')
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).not.toBe('')

    editor.destroy()
  })
})
