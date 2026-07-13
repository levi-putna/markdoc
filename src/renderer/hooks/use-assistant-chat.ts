import { useCallback, useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import type { AssistantEditMode, ChatStreamChunk, ConversationSummary } from '@shared/ai/types'
import { AI_BILLING_URL } from '@shared/ai/types'
import type { QueuedPromptItem } from '@shared/ai/types'
import { nanoid } from 'nanoid'

export type AssistantChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

interface UseAssistantChatOptions {
  filePath: string | null
  sessionId: string
  modelId: string
  editMode: AssistantEditMode
  enabled: boolean
}

/**
 * IPC-backed assistant chat hook with prompt queue and conversation history support.
 */
export function useAssistantChat({
  filePath,
  sessionId,
  modelId,
  editMode,
  enabled,
}: UseAssistantChatOptions) {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string>('New conversation')
  const [conversationHistory, setConversationHistory] = useState<ConversationSummary[]>([])
  const [status, setStatus] = useState<AssistantChatStatus>('ready')
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueuedPromptItem[]>([])
  const assistantIdRef = useRef<string | null>(null)
  const messagesRef = useRef(messages)
  const conversationIdRef = useRef(conversationId)
  const statusRef = useRef(status)
  const loadRequestIdRef = useRef(0)
  messagesRef.current = messages
  conversationIdRef.current = conversationId
  statusRef.current = status

  const loadConversationHistory = useCallback(async () => {
    if (!window.markdoc || !enabled) {
      setConversationHistory([])
      return
    }

    const { conversations } = await window.markdoc.listConversations({ filePath, sessionId })
    setConversationHistory(conversations)
  }, [filePath, sessionId, enabled])

  const loadConversation = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current

    if (!window.markdoc || !enabled) {
      setMessages([])
      setConversationId(null)
      setConversationTitle('New conversation')
      setConversationHistory([])
      return
    }

    const [activeConversation, history] = await Promise.all([
      window.markdoc.getConversation({ filePath, sessionId }),
      window.markdoc.listConversations({ filePath, sessionId }),
    ])

    if (requestId !== loadRequestIdRef.current) return
    if (statusRef.current === 'streaming' || statusRef.current === 'submitted') return

    setMessages(activeConversation.messages)
    setConversationId(activeConversation.conversationId)
    setConversationTitle(activeConversation.title)
    setConversationHistory(history.conversations)
  }, [filePath, sessionId, enabled])

  useEffect(() => {
    void loadConversation()
  }, [loadConversation])

  useEffect(() => {
    if (!window.markdoc) return

    const unsubscribe = window.markdoc.onConversationsChanged(() => {
      void loadConversationHistory()
      if (statusRef.current !== 'streaming' && statusRef.current !== 'submitted') {
        void loadConversation()
      }
    })

    return unsubscribe
  }, [loadConversation, loadConversationHistory])

  const persistConversation = useCallback(
    async (nextMessages: UIMessage[]) => {
      if (!window.markdoc || !conversationIdRef.current) return
      await window.markdoc.saveConversation({
        filePath,
        sessionId,
        conversationId: conversationIdRef.current,
        messages: nextMessages,
      })
      void loadConversationHistory()
    },
    [filePath, sessionId, loadConversationHistory]
  )

  const sendInternal = useCallback(
    async ({ text }: { text: string }) => {
      if (!window.markdoc || !text.trim()) return

      setError(null)
      setStatus('submitted')

      const userMessage: UIMessage = {
        id: nanoid(),
        role: 'user',
        parts: [{ type: 'text', text: text.trim() }],
      }

      const nextMessages = [...messagesRef.current, userMessage]
      setMessages(nextMessages)
      setStatus('streaming')

      assistantIdRef.current = nanoid()
      const assistantMessage: UIMessage = {
        id: assistantIdRef.current,
        role: 'assistant',
        parts: [{ type: 'text', text: '' }],
      }
      setMessages([...nextMessages, assistantMessage])

      try {
        const result = await window.markdoc.sendChat({
          filePath,
          sessionId,
          messages: [...nextMessages],
          modelId,
          editMode,
        })

        if (!result.success && statusRef.current !== 'error') {
          setStatus('ready')
        }
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : 'Failed to send message.')
        setStatus('error')
      }
    },
    [filePath, sessionId, modelId, editMode]
  )

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') {
        setQueue((q) => [...q, { id: nanoid(), text, status: 'pending' }])
        return
      }
      await sendInternal({ text })
    },
    [sendInternal]
  )

  const startNewConversation = useCallback(async () => {
    if (!window.markdoc) return
    const conversation = await window.markdoc.startNewConversation({ filePath, sessionId })
    setMessages(conversation.messages)
    setConversationId(conversation.conversationId)
    setConversationTitle(conversation.title)
    setQueue([])
    setError(null)
    setStatus('ready')
    void loadConversationHistory()
  }, [filePath, sessionId, loadConversationHistory])

  const openConversation = useCallback(
    async ({ conversationId: nextConversationId }: { conversationId: string }) => {
      if (!window.markdoc) return
      const conversation = await window.markdoc.loadConversation({
        filePath,
        sessionId,
        conversationId: nextConversationId,
      })
      setMessages(conversation.messages)
      setConversationId(conversation.conversationId)
      setConversationTitle(conversation.title)
      setQueue([])
      setError(null)
      setStatus('ready')
      void loadConversationHistory()
    },
    [filePath, sessionId, loadConversationHistory]
  )

  useEffect(() => {
    if (!window.markdoc) return

    const unsubscribe = window.markdoc.onChatStreamChunk((chunk: ChatStreamChunk) => {
      if (chunk.type === 'error' && chunk.error) {
        const message =
          chunk.error.code === 'insufficient_credit'
            ? `Insufficient AI Gateway credits. Add credits in your Vercel dashboard: ${AI_BILLING_URL}`
            : chunk.error.message
        setError(message)
        setStatus('error')
        return
      }

      if (chunk.type === 'done') {
        setMessages((current) => {
          void persistConversation(current)
          return current
        })
        setStatus('ready')
        assistantIdRef.current = null

        setQueue((current) => {
          const pending = current.find((item) => item.status === 'pending')
          if (pending) {
            const rest = current.map((item) =>
              item.id === pending.id ? { ...item, status: 'completed' as const } : item
            )
            void sendInternal({ text: pending.text })
            return rest.filter((item) => item.status !== 'completed')
          }
          return current
        })
        return
      }

      if (chunk.type === 'ui-message-chunk' && chunk.chunk) {
        const raw = chunk.chunk as {
          type?: string
          delta?: string
          errorText?: string
          toolCallId?: string
          toolName?: string
          input?: unknown
          output?: unknown
        }

        if (raw.type === 'error') {
          setError(raw.errorText ?? 'Something went wrong with the AI request. Please try again.')
          setStatus('error')
          return
        }

        if (raw.type === 'text-delta' && typeof raw.delta === 'string') {
          setMessages((current) =>
            current.map((msg) => {
              if (msg.id !== assistantIdRef.current) return msg

              const textPart = msg.parts.find((part) => part.type === 'text')
              const existing = textPart && 'text' in textPart ? textPart.text : ''
              const otherParts = msg.parts.filter((part) => part.type !== 'text')

              return {
                ...msg,
                parts: [{ type: 'text' as const, text: existing + raw.delta }, ...otherParts],
              }
            })
          )
          return
        }

        if (raw.type === 'tool-input-available' && raw.toolCallId && raw.toolName) {
          setMessages((current) =>
            current.map((msg) => {
              if (msg.id !== assistantIdRef.current) return msg

              const toolPart = {
                type: `tool-${raw.toolName}`,
                toolCallId: raw.toolCallId,
                state: 'input-available',
                input: raw.input,
              } as UIMessage['parts'][number]

              const existingIndex = msg.parts.findIndex(
                (part) => 'toolCallId' in part && part.toolCallId === raw.toolCallId
              )

              if (existingIndex === -1) {
                return { ...msg, parts: [...msg.parts, toolPart] }
              }

              const nextParts = [...msg.parts]
              nextParts[existingIndex] = toolPart
              return { ...msg, parts: nextParts }
            })
          )
          return
        }

        if (raw.type === 'tool-output-available' && raw.toolCallId) {
          setMessages((current) =>
            current.map((msg) => {
              if (msg.id !== assistantIdRef.current) return msg

              const existingIndex = msg.parts.findIndex(
                (part) => 'toolCallId' in part && part.toolCallId === raw.toolCallId
              )

              if (existingIndex === -1) return msg

              const existing = msg.parts[existingIndex]
              const nextParts = [...msg.parts]
              nextParts[existingIndex] = {
                ...existing,
                state: 'output-available',
                output: raw.output,
              } as UIMessage['parts'][number]

              return { ...msg, parts: nextParts }
            })
          )
          return
        }

        if (raw.type === 'tool-output-error' && raw.toolCallId) {
          setMessages((current) =>
            current.map((msg) => {
              if (msg.id !== assistantIdRef.current) return msg

              const existingIndex = msg.parts.findIndex(
                (part) => 'toolCallId' in part && part.toolCallId === raw.toolCallId
              )

              if (existingIndex === -1) return msg

              const existing = msg.parts[existingIndex]
              const nextParts = [...msg.parts]
              nextParts[existingIndex] = {
                ...existing,
                state: 'output-error',
                errorText: raw.errorText,
              } as UIMessage['parts'][number]

              return { ...msg, parts: nextParts }
            })
          )
        }
      }
    })

    return unsubscribe
  }, [persistConversation, sendInternal])

  const cancel = useCallback(async () => {
    await window.markdoc?.cancelChat()
    setStatus('ready')
  }, [])

  return {
    messages,
    conversationId,
    conversationTitle,
    conversationHistory,
    status,
    error,
    queue,
    sendMessage,
    startNewConversation,
    openConversation,
    reloadConversationHistory: loadConversationHistory,
    cancel,
    reloadConversation: loadConversation,
  }
}
