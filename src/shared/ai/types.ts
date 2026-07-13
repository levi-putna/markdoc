import type { UIMessage } from 'ai'

export type { AutocompleteEditorContext, AutocompleteBlockContext } from '../ai-autocomplete-context'

export type AssistantEditMode = 'suggestion' | 'auto'

export type AutocompleteContextWindow = 'paragraph' | 'section' | 'document'

export type AiErrorCode =
  | 'ai_disabled'
  | 'missing_key'
  | 'insufficient_credit'
  | 'invalid_key'
  | 'rate_limit'
  | 'timeout'
  | 'model_unavailable'
  | 'network'
  | 'unknown'

export interface AiErrorPayload {
  code: AiErrorCode
  message: string
  detail?: string
  retryAfterMs?: number
}

export interface DocumentSnapshot {
  filePath: string | null
  markdown: string
  plainText: string
  selection: {
    from: number
    to: number
    text: string
  } | null
  outline: OutlineSnapshotItem[]
}

export interface OutlineSnapshotItem {
  id: string
  text: string
  level: number
  pos: number
}

export interface ChatSendPayload {
  filePath: string | null
  sessionId: string
  messages: UIMessage[]
  modelId: string
  editMode: AssistantEditMode
  selectionContext?: string
}

export interface ChatStreamChunk {
  type: 'ui-message-chunk' | 'error' | 'done'
  chunk?: unknown
  error?: AiErrorPayload
}

export interface SuggestionDecorationPayload {
  suggestionId: string
  from?: number
  to?: number
  originalText?: string
  replacement: string
  rationale?: string
  summary?: string
}

export interface ApplyEditPayload {
  from: number
  to: number
  replacement: string
}

export interface QueuedPromptItem {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
}

/** Summary row shown in the assistant history list. */
export interface ConversationSummary {
  id: string
  title: string
  updatedAt: number
  isActive: boolean
  hasMessages: boolean
}

/** Full conversation persisted for a document. */
export interface StoredConversation {
  id: string
  title: string
  messages: UIMessage[]
  createdAt: number
  updatedAt: number
  aiTitleGenerated?: boolean
}

export const AI_BILLING_URL = 'https://vercel.com/docs/ai-gateway/pricing'

/** Vercel dashboard — AI Gateway API Keys page (opens directly in the browser). */
export const AI_GATEWAY_KEYS_URL =
  'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys&title=AI+Gateway+API+Keys'
