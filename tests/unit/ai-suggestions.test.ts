import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from '../../src/shared/tiptap-extensions'
import { AiSuggestions, aiSuggestionsKey } from '../../src/shared/ai-suggestions'

describe('ai-suggestions', () => {
  it('accepts a suggestion as a single undoable document change', () => {
    const editor = new Editor({
      extensions: [...createTiptapExtensions(), AiSuggestions],
      content: '<p>Alpha beta gamma</p>',
    })

    editor.commands.addAiSuggestion({
      suggestionId: 'suggestion-1',
      from: 7,
      to: 11,
      originalText: 'beta',
      replacement: 'delta',
    })

    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).toContain('beta')

    const accepted = editor.commands.acceptAiSuggestion('suggestion-1')

    expect(accepted).toBe(true)
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).toContain('delta')
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).not.toContain('beta')
    expect(aiSuggestionsKey.getState(editor.state)?.suggestions).toHaveLength(0)

    editor.commands.undo()
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).toContain('beta')

    editor.destroy()
  })

  it('rejects a suggestion without changing the document', () => {
    const editor = new Editor({
      extensions: [...createTiptapExtensions(), AiSuggestions],
      content: '<p>Alpha beta gamma</p>',
    })

    const original = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')

    editor.commands.addAiSuggestion({
      suggestionId: 'suggestion-2',
      from: 7,
      to: 11,
      originalText: 'beta',
      replacement: 'delta',
    })

    const rejected = editor.commands.rejectAiSuggestion('suggestion-2')

    expect(rejected).toBe(true)
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')).toBe(original)
    expect(aiSuggestionsKey.getState(editor.state)?.suggestions).toHaveLength(0)

    editor.destroy()
  })
})
