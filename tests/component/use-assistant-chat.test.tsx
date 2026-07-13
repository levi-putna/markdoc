import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatStreamChunk } from '@shared/ai/types'
import streamChunksFixture from '../fixtures/ai/stream-chunks.json'
import errorFixture from '../fixtures/ai/error-insufficient-credit.json'
import { useAssistantChat } from '../../src/renderer/hooks/use-assistant-chat'

describe('useAssistantChat', () => {
  let streamHandler: ((chunk: ChatStreamChunk) => void) | null = null

  beforeEach(() => {
    streamHandler = null

    Object.assign(window.markdoc, {
      getConversation: vi.fn(async () => ({
        conversationId: 'conversation-1',
        title: 'New conversation',
        messages: [],
      })),
      listConversations: vi.fn(async () => ({ conversations: [] })),
      saveConversation: vi.fn(async () => ({ success: true })),
      sendChat: vi.fn(async () => ({ success: true })),
      cancelChat: vi.fn(async () => ({ success: true })),
      onConversationsChanged: vi.fn(() => () => {}),
      onChatStreamChunk: vi.fn((callback: (chunk: ChatStreamChunk) => void) => {
        streamHandler = callback
        return () => {
          streamHandler = null
        }
      }),
    })
  })

  it('streams assistant text deltas from fixture chunks', async () => {
    const { result } = renderHook(() =>
      useAssistantChat({
        filePath: '/tmp/doc.md',
        sessionId: 'session-1',
        modelId: 'google/gemini-2.5-flash',
        editMode: 'suggestion',
        enabled: true,
      })
    )

    await waitFor(() => {
      expect(result.current.conversationId).toBe('conversation-1')
    })

    await act(async () => {
      await result.current.sendMessage({ text: 'Hello assistant' })
    })

    expect(result.current.status).toBe('streaming')

    for (const entry of streamChunksFixture) {
      if (entry.type === 'ui-message-chunk') {
        act(() => {
          streamHandler?.({ type: 'ui-message-chunk', chunk: entry.chunk })
        })
      }
    }

    act(() => {
      streamHandler?.({ type: 'done' })
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    const assistantMessage = result.current.messages.find((message) => message.role === 'assistant')
    const assistantText = assistantMessage?.parts
      .filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? part.text : ''))
      .join('')

    expect(assistantText).toBe('Hello world')
    expect(window.markdoc.saveConversation).toHaveBeenCalled()
  })

  it('surfaces insufficient credit errors from fixture payloads', async () => {
    const { result } = renderHook(() =>
      useAssistantChat({
        filePath: null,
        sessionId: 'session-2',
        modelId: 'google/gemini-2.5-flash',
        editMode: 'suggestion',
        enabled: true,
      })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    act(() => {
      streamHandler?.(errorFixture as ChatStreamChunk)
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    expect(result.current.error).toContain('Insufficient AI Gateway credits')
  })

  it('queues prompts while a turn is streaming', async () => {
    const { result } = renderHook(() =>
      useAssistantChat({
        filePath: null,
        sessionId: 'session-3',
        modelId: 'google/gemini-2.5-flash',
        editMode: 'suggestion',
        enabled: true,
      })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    await act(async () => {
      await result.current.sendMessage({ text: 'First prompt' })
    })

    await act(async () => {
      await result.current.sendMessage({ text: 'Queued prompt' })
    })

    expect(result.current.queue).toHaveLength(1)
    expect(result.current.queue[0].text).toBe('Queued prompt')
  })
})
