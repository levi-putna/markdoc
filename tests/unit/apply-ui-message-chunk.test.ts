import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { applyUIMessageChunk } from '../../src/renderer/hooks/apply-ui-message-chunk'

function createAssistantMessage(): UIMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    parts: [],
  }
}

describe('applyUIMessageChunk', () => {
  it('streams legacy text deltas without reordering parts', () => {
    let message = createAssistantMessage()
    let activeTextPartIndexes = {}

    for (const delta of ['Hello', ' world']) {
      const result = applyUIMessageChunk({
        message,
        chunk: { type: 'text-delta', delta },
        activeTextPartIndexes,
      })
      message = result.message
      activeTextPartIndexes = result.activeTextPartIndexes
    }

    expect(message.parts).toEqual([{ type: 'text', text: 'Hello world' }])
  })

  it('keeps post-tool text after the tool part', () => {
    let message = createAssistantMessage()
    let activeTextPartIndexes = {}

    const steps: Parameters<typeof applyUIMessageChunk>[0]['chunk'][] = [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Before tool. ' },
      { type: 'tool-input-available', toolCallId: 'tool-1', toolName: 'read_document', input: {} },
      { type: 'tool-output-available', toolCallId: 'tool-1', output: { ok: true } },
      { type: 'text-start', id: 'text-2' },
      { type: 'text-delta', id: 'text-2', delta: 'After tool.' },
    ]

    for (const chunk of steps) {
      const result = applyUIMessageChunk({
        message,
        chunk,
        activeTextPartIndexes,
      })
      message = result.message
      activeTextPartIndexes = result.activeTextPartIndexes
    }

    expect(message.parts).toHaveLength(3)
    expect(message.parts[0]).toMatchObject({ type: 'text', text: 'Before tool. ' })
    expect(message.parts[1]).toMatchObject({
      type: 'tool-read_document',
      toolCallId: 'tool-1',
      state: 'output-available',
    })
    expect(message.parts[2]).toMatchObject({ type: 'text', text: 'After tool.' })
  })
})
