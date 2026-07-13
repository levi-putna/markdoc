import { describe, expect, it, vi } from 'vitest'
import type { DocumentSnapshot } from '@shared/ai/types'
import { buildAssistantTools } from '../../src/main/ai/tools'

const baseSnapshot: DocumentSnapshot = {
  filePath: '/tmp/doc.md',
  markdown: '# Introduction\n\nAlpha beta gamma.\n\n## Details\n\nDelta epsilon.',
  plainText: 'Introduction\n\nAlpha beta gamma.\n\nDetails\n\nDelta epsilon.',
  selection: { from: 20, to: 31, text: 'Alpha beta' },
  outline: [
    { id: 'h1-intro', text: 'Introduction', level: 1, pos: 0 },
    { id: 'h2-details', text: 'Details', level: 2, pos: 30 },
  ],
}

function createTools({
  snapshot = baseSnapshot,
  editMode = 'suggestion' as const,
}: {
  snapshot?: DocumentSnapshot
  editMode?: 'suggestion' | 'auto'
} = {}) {
  const onProposeEdit = vi.fn(async () => 'suggestion-1')
  const onApplyEdit = vi.fn(async () => {})

  const tools = buildAssistantTools({
    getSnapshot: async () => snapshot,
    onProposeEdit,
    onApplyEdit,
    editMode,
  })

  return { tools, onProposeEdit, onApplyEdit }
}

function toolExecutionOptions({ toolCallId }: { toolCallId: string }) {
  return { toolCallId, messages: [], context: {} }
}

describe('ai-tools', () => {
  it('reads a document section by heading id', async () => {
    const { tools } = createTools()
    const result = await tools.read_document.execute!(
      { headingId: 'h2-details' },
      toolExecutionOptions({ toolCallId: 'read-1' })
    )

    expect(result).toMatchObject({
      filePath: '/tmp/doc.md',
    })
    expect((result as { markdown: string }).markdown).toContain('Delta epsilon')
    expect((result as { markdown: string }).markdown).not.toContain('# Introduction')
  })

  it('reads the current selection with positions', async () => {
    const { tools } = createTools()
    const result = await tools.read_selection.execute!({}, toolExecutionOptions({ toolCallId: 'sel-1' }))

    expect(result).toEqual({
      selection: baseSnapshot.selection,
      filePath: '/tmp/doc.md',
    })
  })

  it('searches the document for plain text matches', async () => {
    const { tools } = createTools()
    const result = await tools.search_document.execute!(
      { query: 'gamma' },
      toolExecutionOptions({ toolCallId: 'search-1' })
    )

    expect((result as { matches: Array<{ line: number }> }).matches).toHaveLength(1)
    expect((result as { matches: Array<{ text: string }> }).matches[0].text).toContain('gamma')
  })

  it('proposes an edit in suggestion mode', async () => {
    const { tools, onProposeEdit, onApplyEdit } = createTools({ editMode: 'suggestion' })
    const result = await tools.propose_edit.execute!(
      {
        originalText: 'Alpha beta',
        replacement: 'Alpha delta',
        rationale: 'Clearer wording',
      },
      toolExecutionOptions({ toolCallId: 'edit-1' })
    )

    expect(onProposeEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 20,
        to: 31,
        originalText: 'Alpha beta',
        replacement: 'Alpha delta',
      })
    )
    expect(onApplyEdit).not.toHaveBeenCalled()
    expect(result).toMatchObject({ mode: 'suggestion', suggestionId: 'suggestion-1' })
  })

  it('applies an edit immediately in auto mode', async () => {
    const { tools, onProposeEdit, onApplyEdit } = createTools({ editMode: 'auto' })
    const result = await tools.propose_edit.execute!(
      {
        originalText: 'Alpha beta',
        replacement: 'Alpha delta',
      },
      toolExecutionOptions({ toolCallId: 'edit-2' })
    )

    expect(onApplyEdit).toHaveBeenCalled()
    expect(onProposeEdit).not.toHaveBeenCalled()
    expect(result).toMatchObject({ mode: 'auto', applied: true })
  })

  it('apply_edit always uses auto mode even when assistant edit mode is suggestion', async () => {
    const { tools, onApplyEdit } = createTools({ editMode: 'suggestion' })
    await tools.apply_edit.execute!(
      {
        originalText: 'gamma',
        replacement: 'zeta',
      },
      toolExecutionOptions({ toolCallId: 'edit-3' })
    )

    expect(onApplyEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        replacement: 'zeta',
      })
    )
  })
})
