import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from '../../src/shared/tiptap-extensions'
import {
  buildAutocompleteEditorContext,
  buildAutocompletePrompt,
  normaliseAutocompleteSuggestion,
} from '../../src/shared/ai-autocomplete-context'

function createTestEditor(content: string) {
  return new Editor({
    extensions: createTiptapExtensions(),
    content,
  })
}

function findPositionForPlainOffset({
  editor,
  offset,
}: {
  editor: Editor
  offset: number
}): number {
  const doc = editor.state.doc
  const plainText = doc.textBetween(0, doc.content.size, '\n')

  for (let pos = 0; pos <= doc.content.size; pos += 1) {
    if (doc.textBetween(0, pos, '\n').length === offset) {
      return pos
    }
  }

  throw new Error(`Could not map plain offset ${offset} in "${plainText}"`)
}

describe('ai-autocomplete-context', () => {
  it('uses textBetween positions instead of slicing by ProseMirror position', () => {
    const editor = createTestEditor('<p>Alpha beta</p><p>Gamma delta</p>')
    const plainText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
    editor.commands.setTextSelection(
      findPositionForPlainOffset({ editor, offset: plainText.indexOf('beta') + 'beta'.length })
    )

    const context = buildAutocompleteEditorContext({
      editor,
      contextWindow: 'document',
      outline: [],
    })

    expect(context).not.toBeNull()
    expect(context!.prefix).toContain('Alpha beta')
    expect(context!.prefix).not.toContain('Gamma')

    editor.destroy()
  })

  it('scopes paragraph context to the current block', () => {
    const editor = createTestEditor('<p>Alpha beta</p><p>Gamma delta</p>')
    const plainText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
    const cursorPos = plainText.indexOf('Gamma') + 'Gamma'.length
    editor.commands.setTextSelection(findPositionForPlainOffset({ editor, offset: cursorPos }))

    const context = buildAutocompleteEditorContext({
      editor,
      contextWindow: 'paragraph',
      outline: [],
    })

    expect(context).not.toBeNull()
    expect(context!.prefix.trim()).toBe('Gamma')
    expect(context!.suffix.trim()).toBe('delta')

    editor.destroy()
  })

  it('adds a leading space when continuing after a word', () => {
    const suggestion = normaliseAutocompleteSuggestion({
      suggestion: 'world',
      prefix: 'hello',
      suffix: '',
      charBeforeCursor: 'o',
      charAfterCursor: '',
      cursorInWord: false,
    })

    expect(suggestion).toBe(' world')
  })

  it('preserves an explicit leading space from the model', () => {
    const suggestion = normaliseAutocompleteSuggestion({
      suggestion: ' world',
      prefix: 'hello',
      suffix: '',
      charBeforeCursor: 'o',
      charAfterCursor: '',
      cursorInWord: false,
    })

    expect(suggestion).toBe(' world')
  })

  it('suppresses suggestions when the cursor is inside a word', () => {
    const suggestion = normaliseAutocompleteSuggestion({
      suggestion: 'lpha',
      prefix: 'al',
      suffix: 'pha',
      charBeforeCursor: 'l',
      charAfterCursor: 'p',
      cursorInWord: true,
    })

    expect(suggestion).toBeNull()
  })

  it('builds a richer prompt with block and section context', () => {
    const { system, prompt } = buildAutocompletePrompt({
      context: {
        prefix: 'The project aims to',
        suffix: '',
        charBeforeCursor: 'o',
        charAfterCursor: '',
        cursorInWord: false,
        contextWindow: 'section',
        block: {
          blockType: 'paragraph',
          sectionTitle: 'Introduction',
        },
      },
    })

    expect(system).toContain('inline writing autocomplete')
    expect(prompt).toContain('Current section: Introduction')
    expect(prompt).toContain('<<<BEFORE_CURSOR')
    expect(prompt).toContain('<CURSOR>')
    expect(prompt).toContain('<<<AFTER_CURSOR')
  })
})
