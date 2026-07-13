import { useMemo, useState, useCallback, useEffect, type ComponentProps } from 'react'
import type { UIMessage } from 'ai'
import { Bot, FileDiff, FileText, MessageSquarePlus, Search, Wrench, Zap, type LucideIcon } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@renderer/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@renderer/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  type PromptInputMessage,
} from '@renderer/components/ai-elements/prompt-input'
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from '@renderer/components/ai-elements/queue'
import { SuggestionReviewActions } from './SuggestionReviewActions'
import { Shimmer } from '@renderer/components/ai-elements/shimmer'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import { useDocumentStore } from '../store/document-store'
import { useAssistantChat } from '../hooks/use-assistant-chat'
import { tierModels, formatCostTooltip, type CostTier, type GatewayModelInfo } from '@shared/ai/model-pricing'
import type { AssistantEditMode } from '@shared/ai/types'

interface AssistantPanelProps {
  sessionId: string
  hasSelection: boolean
  isDocumentEmpty: boolean
  prefillText?: string | null
  onPrefillConsumed?: () => void
  onHeadingClick: (headingId: string) => void
  onOpenPreferences: () => void
  pendingSuggestionCount: number
  pendingSuggestionIds: string[]
  suggestionResolutions: Record<string, 'accepted' | 'rejected'>
  onAcceptSuggestion: ({ suggestionId }: { suggestionId: string }) => void
  onRejectSuggestion: ({ suggestionId }: { suggestionId: string }) => void
  onAcceptAllSuggestions: () => void
  onRejectAllSuggestions: () => void
  onFocusSuggestion: ({ suggestionId }: { suggestionId: string }) => void
}

const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 480

const ASSISTANT_COMPOSER_SELECT_CLASS =
  'h-control shrink-0 appearance-none rounded-xs border border-border-subtle bg-surface-primary px-2 text-xs leading-none shadow-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0'

const ASSISTANT_COMPOSER_MODEL_CLASS =
  `${ASSISTANT_COMPOSER_SELECT_CLASS} min-w-0 w-full max-w-full justify-start gap-1.5 overflow-hidden pl-1 pr-2 text-left [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left [&>svg:last-child]:order-first [&>svg:last-child]:size-3.5 [&>svg:last-child]:shrink-0`

const ASSISTANT_COMPOSER_ICON_SELECT_CLASS =
  `${ASSISTANT_COMPOSER_SELECT_CLASS} !w-control !min-w-control shrink-0 justify-center px-0 [&>svg:last-child]:hidden`

type AssistantPanelTab = 'chat' | 'history'

const ASSISTANT_MESSAGE_CLASS = 'assistant-message gap-1.5'
const ASSISTANT_MESSAGE_CONTENT_CLASS =
  'assistant-message-content text-[13px] leading-[18px] gap-1.5 group-[.is-user]:rounded-xs group-[.is-user]:px-2.5 group-[.is-user]:py-1.5'

const ASSISTANT_TABS: { id: AssistantPanelTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'history', label: 'History' },
]

/**
 * Extracts plain text from a UI message for history previews.
 */
function messageText({ message }: { message: UIMessage }): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()
}

/**
 * Whether a tool part has finished successfully and should be hidden.
 */
function isToolPartComplete({ part }: { part: UIMessage['parts'][number] }): boolean {
  return part.type.startsWith('tool-') && 'state' in part && part.state === 'output-available'
}

/**
 * Whether a message has tool calls still in progress.
 */
function hasRunningToolParts({ message }: { message: UIMessage }): boolean {
  return message.parts.some(
    (part) =>
      part.type.startsWith('tool-') &&
      (!('state' in part) ||
        part.state === 'input-available' ||
        part.state === 'input-streaming' ||
        part.state === 'approval-requested')
  )
}

/**
 * Human-readable label for a tool name.
 */
function formatToolLabel({ toolName }: { toolName: string }): string {
  return toolName.replace(/_/g, ' ')
}

/**
 * Icon for a tool activity row.
 */
function toolIconForName({ toolName }: { toolName: string }): LucideIcon {
  if (toolName.includes('edit')) return FileDiff
  if (toolName.startsWith('read_')) return FileText
  if (toolName === 'search_document') return Search
  return Wrench
}

/**
 * Compact result row after an edit tool finishes, with inline review controls.
 */
function AssistantEditResultRow({
  toolName,
  part,
  pendingSuggestionIds,
  suggestionResolutions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onFocusSuggestion,
}: {
  toolName: string
  part: UIMessage['parts'][number]
  pendingSuggestionIds: string[]
  suggestionResolutions: Record<string, 'accepted' | 'rejected'>
  onAcceptSuggestion: ({ suggestionId }: { suggestionId: string }) => void
  onRejectSuggestion: ({ suggestionId }: { suggestionId: string }) => void
  onFocusSuggestion: ({ suggestionId }: { suggestionId: string }) => void
}) {
  const output =
    'output' in part && part.output && typeof part.output === 'object'
      ? (part.output as { summary?: string; applied?: boolean; mode?: string; suggestionId?: string })
      : null
  const input =
    'input' in part && part.input && typeof part.input === 'object'
      ? (part.input as { rationale?: string; replacement?: string })
      : null

  const summary = output?.summary ?? input?.rationale ?? formatToolLabel({ toolName })
  const suggestionId = output?.suggestionId
  const isAutoApplied = output?.applied || output?.mode === 'auto'
  const isPending = Boolean(suggestionId && pendingSuggestionIds.includes(suggestionId))
  const resolution = suggestionId ? suggestionResolutions[suggestionId] : undefined

  const status: 'pending' | 'accepted' | 'rejected' | 'applied' = isAutoApplied
    ? 'applied'
    : resolution ?? (isPending ? 'pending' : suggestionId ? 'accepted' : 'applied')

  return (
    <div
      className="assistant-edit-result"
      data-testid="assistant-edit-result"
    >
      {/* Change summary */}
      <div className="assistant-edit-result__content">
        <FileDiff className="assistant-edit-result__icon" aria-hidden />
        <div className="assistant-edit-result__copy">
          <p className="assistant-edit-result__title">{summary}</p>
          <p className="assistant-edit-result__meta">
            {status === 'pending'
              ? 'Pending review in document'
              : status === 'applied'
                ? 'Applied to document'
                : status === 'accepted'
                  ? 'Accepted'
                  : 'Rejected'}
          </p>
        </div>
      </div>

      {/* Inline review controls */}
      {suggestionId && status === 'pending' ? (
        <div className="assistant-edit-result__actions">
          <button
            type="button"
            className="assistant-edit-result__focus"
            onClick={() => onFocusSuggestion({ suggestionId })}
          >
            Show in document
          </button>
          <SuggestionReviewActions
            layout="assistant"
            status="pending"
            onReject={() => onRejectSuggestion({ suggestionId })}
            onAccept={() => onAcceptSuggestion({ suggestionId })}
          />
        </div>
      ) : (
        <SuggestionReviewActions
          layout="assistant"
          status={status}
          onReject={() => {}}
          onAccept={() => {}}
        />
      )}
    </div>
  )
}

/**
 * Sticky review strip when the assistant has pending document changes.
 */
function AssistantSuggestionReviewStrip({
  pendingCount,
  onAcceptAll,
  onRejectAll,
}: {
  pendingCount: number
  onAcceptAll: () => void
  onRejectAll: () => void
}) {
  if (pendingCount === 0) return null

  return (
    <div className="assistant-suggestion-review-strip" data-testid="assistant-suggestion-review-strip">
      <div className="assistant-suggestion-review-strip__copy">
        <p className="assistant-suggestion-review-strip__title">
          {pendingCount} change{pendingCount === 1 ? '' : 's'} waiting for review
        </p>
        <p className="assistant-suggestion-review-strip__meta">
          Accept or reject inline in the document, or use the controls below.
        </p>
      </div>
      <SuggestionReviewActions
        layout="assistant"
        onReject={onRejectAll}
        onAccept={onAcceptAll}
        rejectLabel="Reject all"
        acceptLabel="Accept all"
      />
    </div>
  )
}

/**
 * Compact in-thread indicator while a tool is running.
 */
function AssistantToolCallRow({
  toolName,
  state,
}: {
  toolName: string
  state: string
}) {
  if (state === 'output-available') {
    return null
  }

  const isRunning =
    state === 'input-available' ||
    state === 'input-streaming' ||
    state === 'approval-requested'
  const label = isRunning
    ? `Running ${formatToolLabel({ toolName })}…`
    : state === 'output-error'
      ? `Failed ${formatToolLabel({ toolName })}`
      : formatToolLabel({ toolName })
  const Icon = toolIconForName({ toolName })

  return (
    <div
      className={cn(
        'assistant-tool-activity flex w-full items-center gap-1.5 rounded-xs py-0.5',
        isRunning && 'assistant-tool-activity--running'
      )}
      data-testid="assistant-tool-activity"
    >
      <Icon className="size-3 shrink-0 text-content-secondary" aria-hidden />
      {isRunning ? (
        <Shimmer as="span" className="text-[11px] leading-[14px]" duration={1.5}>
          {label}
        </Shimmer>
      ) : (
        <span className="text-[11px] leading-[14px] text-red-600">{label}</span>
      )}
    </div>
  )
}

/**
 * Skeleton placeholder while waiting for the first streamed assistant tokens.
 */
function AssistantStreamingSkeleton() {
  return (
    <div
      className="flex w-full max-w-[min(100%,16rem)] flex-col gap-2"
      aria-busy="true"
      aria-label="Assistant is responding"
      data-testid="assistant-streaming-skeleton"
    >
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[92%]" />
      <Skeleton className="h-3 w-[68%]" />
    </div>
  )
}

/**
 * Formats a conversation timestamp for the history list.
 */
function formatConversationDate({ timestamp }: { timestamp: number }): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

/**
 * Read-only conversation list for the History tab.
 */
function AssistantHistoryView({
  conversations,
  activeConversationId,
  onSelectConversation,
}: {
  conversations: Array<{
    id: string
    title: string
    updatedAt: number
    isActive: boolean
  }>
  activeConversationId: string | null
  onSelectConversation: ({ conversationId }: { conversationId: string }) => void
}) {
  if (conversations.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center"
        data-testid="assistant-history-empty"
      >
        <p className="text-sm font-medium text-content-text">No conversations yet</p>
        <p className="text-xs leading-relaxed text-content-secondary">
          Start a chat, then return here to browse and reopen past conversations for this document.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* History purpose */}
      <p className="px-1 text-xs leading-relaxed text-content-secondary">
        Select a conversation to load it into Chat.
      </p>

      {/* Conversation list — sorted by last active */}
      <ul className="flex flex-col gap-1" data-testid="assistant-history-list">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId

          return (
            <li key={conversation.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full flex-col gap-0.5 rounded-xs border px-2 py-1.5 text-left transition-colors',
                  isActive
                    ? 'border-brand/40 bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface-primary))]'
                    : 'border-border-subtle bg-[color-mix(in_srgb,var(--surface-sidebar)_15%,var(--surface-primary))] hover:bg-[color-mix(in_srgb,var(--surface-sidebar)_25%,var(--surface-primary))]'
                )}
                onClick={() => onSelectConversation({ conversationId: conversation.id })}
                data-testid={`assistant-history-item-${conversation.id}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  isActive
                    ? `${conversation.title}, active conversation`
                    : `Open conversation: ${conversation.title}`
                }
              >
                <span className="flex items-start justify-between gap-2">
                  {/* Title — clamped to two lines */}
                  <span className="line-clamp-2 text-[13px] leading-[18px] font-medium text-content-text">
                    {conversation.title}
                  </span>
                  {isActive ? (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-brand">
                      Active
                    </span>
                  ) : null}
                </span>
                {/* Last active date */}
                <span className="text-[11px] leading-[14px] text-content-secondary">
                  {formatConversationDate({ timestamp: conversation.updatedAt })}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Converts bare heading:// tokens into markdown links for Streamdown.
 */
function normaliseHeadingReferences({ text }: { text: string }): string {
  return text.replace(/(?<!\]\()heading:\/\/([a-zA-Z0-9_-]+)/g, '[$1](heading://$1)')
}

/**
 * Renders assistant message text with Streamdown and clickable heading:// links.
 */
function AssistantMessageText({
  text,
  onHeadingClick,
  isAnimating = false,
}: {
  text: string
  onHeadingClick: (headingId: string) => void
  isAnimating?: boolean
}) {
  const markdown = useMemo(() => normaliseHeadingReferences({ text }), [text])

  const components = useMemo(
    () => ({
      a: ({ href, children, ...props }: ComponentProps<'a'>) => {
        if (href?.startsWith('heading://')) {
          const headingId = href.slice('heading://'.length)
          return (
            <button
              type="button"
              className="text-brand underline hover:opacity-80"
              onClick={() => onHeadingClick(headingId)}
            >
              {children}
            </button>
          )
        }

        return (
          <a href={href} className="text-brand underline hover:opacity-80" {...props}>
            {children}
          </a>
        )
      },
    }),
    [onHeadingClick]
  )

  return (
    <MessageResponse
      className="assistant-message-body text-[13px] leading-[18px] text-content-text"
      components={components}
      isAnimating={isAnimating}
    >
      {markdown}
    </MessageResponse>
  )
}

/**
 * Renders one assistant message part (text via Streamdown, or tool activity).
 */
function AssistantMessagePart({
  message,
  part,
  partIndex,
  onHeadingClick,
  isAnimating = false,
  pendingSuggestionIds,
  suggestionResolutions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onFocusSuggestion,
}: {
  message: UIMessage
  part: UIMessage['parts'][number]
  partIndex: number
  onHeadingClick: (headingId: string) => void
  isAnimating?: boolean
  pendingSuggestionIds: string[]
  suggestionResolutions: Record<string, 'accepted' | 'rejected'>
  onAcceptSuggestion: ({ suggestionId }: { suggestionId: string }) => void
  onRejectSuggestion: ({ suggestionId }: { suggestionId: string }) => void
  onFocusSuggestion: ({ suggestionId }: { suggestionId: string }) => void
}) {
  if (part.type === 'text') {
    if (!part.text) return null
    return (
      <AssistantMessageText
        text={part.text}
        onHeadingClick={onHeadingClick}
        isAnimating={isAnimating}
      />
    )
  }

  if (part.type.startsWith('tool-')) {
    const toolName = part.type.replace(/^tool-/, '')
    const toolState = 'state' in part ? String(part.state) : 'input-available'

    if (toolState === 'output-available' && (toolName === 'propose_edit' || toolName === 'apply_edit')) {
      return (
        <AssistantEditResultRow
          toolName={toolName}
          part={part}
          pendingSuggestionIds={pendingSuggestionIds}
          suggestionResolutions={suggestionResolutions}
          onAcceptSuggestion={onAcceptSuggestion}
          onRejectSuggestion={onRejectSuggestion}
          onFocusSuggestion={onFocusSuggestion}
        />
      )
    }

    if (isToolPartComplete({ part })) {
      return null
    }

    return (
      <AssistantToolCallRow toolName={toolName} state={toolState} />
    )
  }

  return null
}

/**
 * Contextual suggested prompts for empty conversation state (FR-14.16).
 */
function buildSuggestedPrompts({
  hasSelection,
  isDocumentEmpty,
  wordCount,
}: {
  hasSelection: boolean
  isDocumentEmpty: boolean
  wordCount: number
}): string[] {
  if (hasSelection) {
    return ['Summarise selection', 'Rewrite', 'Expand', 'Fix grammar', 'Make more formal']
  }
  if (isDocumentEmpty) {
    return ['Help me outline this document', 'Suggest a structure for my notes']
  }
  if (wordCount > 800) {
    return [
      'Summarise this document',
      'What are the main points?',
      'Suggest improvements',
      'Add a one-paragraph summary at the top',
    ]
  }
  return ['Summarise this document', 'Suggest improvements', 'What are the main points?']
}

/**
 * Empty thread with compact, width-aware suggested prompts.
 */
function AssistantEmptyState({
  suggestedPrompts,
  onSelectPrompt,
}: {
  suggestedPrompts: string[]
  onSelectPrompt: ({ text }: { text: string }) => void
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4 py-1"
      data-testid="assistant-empty-state"
    >
      {/* Intro */}
      <div className="flex flex-col gap-2">
        <div className="flex size-9 items-center justify-center rounded-xs border border-border-subtle bg-[color-mix(in_srgb,var(--surface-sidebar)_20%,var(--surface-primary))]">
          <Bot className="size-4 text-content-secondary" aria-hidden />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-content-text">Ask about your document</h3>
          <p className="text-xs leading-relaxed text-content-secondary">
            Summarise, rewrite, or ask questions about the current file.
          </p>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-medium text-content-secondary">Try asking</p>
        <ul className="flex flex-col gap-1.5">
          {suggestedPrompts.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                className="assistant-suggestion"
                onClick={() => onSelectPrompt({ text: prompt })}
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Right-hand document assistant panel (FR-14.9).
 */
export function AssistantPanel({
  sessionId,
  hasSelection,
  isDocumentEmpty,
  prefillText,
  onPrefillConsumed,
  onHeadingClick,
  onOpenPreferences,
  pendingSuggestionCount,
  pendingSuggestionIds,
  suggestionResolutions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onAcceptAllSuggestions,
  onRejectAllSuggestions,
  onFocusSuggestion,
}: AssistantPanelProps) {
  const preferences = useDocumentStore((s) => s.preferences)
  const filePath = useDocumentStore((s) => s.filePath)
  const assistantWidth = useDocumentStore((s) => s.assistantWidth)
  const setAssistantWidth = useDocumentStore((s) => s.setAssistantWidth)
  const wordCount = useDocumentStore((s) => s.wordCount)
  const aiModels = useDocumentStore((s) => s.aiModels)

  const enabledModels: GatewayModelInfo[] =
    aiModels.length > 0
      ? aiModels
      : preferences.enabledModelIds.map((id) => ({ id, name: id.split('/').pop() ?? id }))

  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<AssistantPanelTab>('chat')
  const [selectedModel, setSelectedModel] = useState(preferences.defaultAssistantModel)
  const [editMode, setEditMode] = useState<AssistantEditMode>(preferences.assistantEditMode)

  useEffect(() => {
    const fallbackModel = preferences.enabledModelIds.includes(preferences.defaultAssistantModel)
      ? preferences.defaultAssistantModel
      : preferences.enabledModelIds[0]

    setSelectedModel((current) => {
      if (preferences.enabledModelIds.includes(current)) return current
      return fallbackModel ?? current
    })
  }, [preferences.defaultAssistantModel, preferences.enabledModelIds])

  useEffect(() => {
    if (prefillText) {
      setInput(prefillText)
      onPrefillConsumed?.()
    }
  }, [prefillText, onPrefillConsumed])

  const {
    messages,
    conversationId,
    conversationHistory,
    status,
    error,
    queue,
    sendMessage,
    startNewConversation,
    openConversation,
    reloadConversationHistory,
    cancel,
  } = useAssistantChat({
      filePath,
      sessionId,
      modelId: selectedModel,
      editMode,
      enabled: preferences.aiEnabled,
    })

  const costTiers = useMemo(() => tierModels({ models: enabledModels }), [enabledModels])

  const selectedModelLabel = useMemo(() => {
    const model = enabledModels.find((entry) => entry.id === selectedModel)
    return model?.name ?? selectedModel.split('/').pop() ?? selectedModel
  }, [enabledModels, selectedModel])

  const suggestedPrompts = buildSuggestedPrompts({ hasSelection, isDocumentEmpty, wordCount })

  const handleNewChat = useCallback(async () => {
    await startNewConversation()
    setActiveTab('chat')
  }, [startNewConversation])

  const handleSelectConversation = useCallback(
    async ({ conversationId: nextConversationId }: { conversationId: string }) => {
      if (nextConversationId === conversationId) {
        setActiveTab('chat')
        return
      }

      await openConversation({ conversationId: nextConversationId })
      setActiveTab('chat')
    },
    [conversationId, openConversation]
  )

  useEffect(() => {
    if (activeTab === 'history') {
      void reloadConversationHistory()
    }
  }, [activeTab, reloadConversationHistory])

  const handleTabKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const currentIndex = ASSISTANT_TABS.findIndex(({ id }) => id === activeTab)
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = ASSISTANT_TABS[(currentIndex + delta + ASSISTANT_TABS.length) % ASSISTANT_TABS.length]
    setActiveTab(next.id)
  }

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = (message.text ?? input).trim()
      if (!text) return
      void sendMessage({ text })
      setInput('')
    },
    [sendMessage, input]
  )

  const handleResizeStart = (event: React.MouseEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = assistantWidth || DEFAULT_WIDTH

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
      setAssistantWidth(next)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const aiReady = preferences.aiEnabled && preferences.aiDisclosureAccepted
  const pendingQueue = queue.filter((q) => q.status === 'pending')
  const inProgressQueue = queue.filter((q) => q.status === 'in_progress')
  const isStreaming = status === 'streaming' || status === 'submitted'
  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages]
  )
  const awaitingFirstStreamChunk =
    isStreaming &&
    (!lastAssistantMessage ||
      (messageText({ message: lastAssistantMessage }) === '' &&
        !hasRunningToolParts({ message: lastAssistantMessage })))

  return (
    <aside
      className="assistant-panel relative flex shrink-0 flex-col border-l border-border-subtle"
      style={{ width: assistantWidth || DEFAULT_WIDTH }}
      data-testid="assistant-panel"
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-brand/20"
        onMouseDown={handleResizeStart}
        aria-hidden
      />

      {/* Panel header — segmented Chat / History tabs and new chat */}
      <div className="sidebar-toolbar shrink-0" data-testid="assistant-toolbar">
        {aiReady ? (
          <>
            <div
              className="view-mode-tabs"
              role="tablist"
              aria-label="Assistant"
              onKeyDown={handleTabKeyDown}
            >
              {ASSISTANT_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  tabIndex={activeTab === id ? 0 : -1}
                  className={`view-mode-tab ${activeTab === id ? 'view-mode-tab--active' : ''}`}
                  onClick={() => setActiveTab(id)}
                  data-testid={`assistant-tab-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="toolbar-icon-btn"
                onClick={() => void handleNewChat()}
                aria-label="New chat"
                title="New chat"
                data-testid="assistant-new-chat"
              >
                <MessageSquarePlus />
              </button>
            </div>
          </>
        ) : (
          <span className="sr-only">Assistant</span>
        )}
      </div>

      {!preferences.aiEnabled && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface-primary p-6 text-center">
          <p className="text-sm text-content-secondary">
            AI is disabled. Enable it in Preferences to use the assistant.
          </p>
          <button
            type="button"
            className="text-sm text-brand underline hover:opacity-80"
            onClick={onOpenPreferences}
          >
            Open Preferences
          </button>
        </div>
      )}

      {preferences.aiEnabled && !preferences.aiDisclosureAccepted && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface-primary p-6 text-center">
          <p className="text-sm text-content-secondary">
            Accept the AI disclosure in Preferences before sending messages.
          </p>
          <button
            type="button"
            className="text-sm text-brand underline hover:opacity-80"
            onClick={onOpenPreferences}
          >
            Open Preferences
          </button>
        </div>
      )}

      {aiReady && (
        <>
          {/* Prompt queue — chat tab only */}
          {activeTab === 'chat' && queue.length > 0 && (
            <div className="shrink-0 border-b border-border-subtle bg-surface-primary px-2 py-1.5">
              <Queue>
                {pendingQueue.length > 0 && (
                  <QueueSection defaultOpen>
                    <QueueSectionTrigger>
                      <QueueSectionLabel label="Queued" count={pendingQueue.length} />
                    </QueueSectionTrigger>
                    <QueueSectionContent>
                      <QueueList>
                        {pendingQueue.map((item) => (
                          <QueueItem key={item.id}>
                            <div className="flex items-center gap-2">
                              <QueueItemIndicator />
                              <QueueItemContent>{item.text}</QueueItemContent>
                            </div>
                          </QueueItem>
                        ))}
                      </QueueList>
                    </QueueSectionContent>
                  </QueueSection>
                )}
                {inProgressQueue.length > 0 && (
                  <QueueSection defaultOpen>
                    <QueueSectionTrigger>
                      <QueueSectionLabel label="In progress" count={inProgressQueue.length} />
                    </QueueSectionTrigger>
                    <QueueSectionContent>
                      <QueueList>
                        {inProgressQueue.map((item) => (
                          <QueueItem key={item.id}>
                            <div className="flex items-center gap-2">
                              <QueueItemIndicator completed />
                              <QueueItemContent>
                                <Shimmer duration={1.5}>{item.text}</Shimmer>
                              </QueueItemContent>
                            </div>
                          </QueueItem>
                        ))}
                      </QueueList>
                    </QueueSectionContent>
                  </QueueSection>
                )}
              </Queue>
            </div>
          )}

          {/* Conversation thread / history */}
          {activeTab === 'chat' ? (
          <Conversation className="min-h-0 flex-1 bg-surface-primary">
            <ConversationContent className="assistant-conversation-content gap-2 p-2">
              {messages.length === 0 ? (
                <AssistantEmptyState
                  suggestedPrompts={suggestedPrompts}
                  onSelectPrompt={({ text }) => void sendMessage({ text })}
                />
              ) : (
                messages.map((message, messageIndex) => {
                  const text = messageText({ message })
                  const hasRunningTools = hasRunningToolParts({ message })
                  if (message.role === 'assistant' && !text && !hasRunningTools && awaitingFirstStreamChunk) {
                    return null
                  }

                  const isAnimating =
                    isStreaming &&
                    message.role === 'assistant' &&
                    messageIndex === messages.length - 1

                  return (
                  <Message className={ASSISTANT_MESSAGE_CLASS} from={message.role} key={message.id}>
                    <MessageContent className={ASSISTANT_MESSAGE_CONTENT_CLASS}>
                      {message.parts.map((part, i) => (
                        <AssistantMessagePart
                          key={`${message.id}-${i}`}
                          message={message}
                          part={part}
                          partIndex={i}
                          onHeadingClick={onHeadingClick}
                          isAnimating={isAnimating && part.type === 'text'}
                          pendingSuggestionIds={pendingSuggestionIds}
                          suggestionResolutions={suggestionResolutions}
                          onAcceptSuggestion={onAcceptSuggestion}
                          onRejectSuggestion={onRejectSuggestion}
                          onFocusSuggestion={onFocusSuggestion}
                        />
                      ))}
                    </MessageContent>
                  </Message>
                  )
                })
              )}

              {awaitingFirstStreamChunk && (
                <Message className={ASSISTANT_MESSAGE_CLASS} from="assistant">
                  <MessageContent className={ASSISTANT_MESSAGE_CONTENT_CLASS}>
                    <AssistantStreamingSkeleton />
                  </MessageContent>
                </Message>
              )}

              {error && (
                <p
                  className="rounded-xs bg-red-500/10 px-2 py-1.5 text-[13px] leading-[18px] text-red-600"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-primary p-2">
              <AssistantHistoryView
                conversations={conversationHistory}
                activeConversationId={conversationId}
                onSelectConversation={handleSelectConversation}
              />
            </div>
          )}

          {/* Composer — chat tab only */}
          {activeTab === 'chat' && (
          <>
            <AssistantSuggestionReviewStrip
              pendingCount={pendingSuggestionCount}
              onAcceptAll={onAcceptAllSuggestions}
              onRejectAll={onRejectAllSuggestions}
            />
          <div className="assistant-panel__composer min-w-0 shrink-0 border-t border-border-subtle p-2">
            <PromptInput className="assistant-prompt-input w-full min-w-0" onSubmit={handleSubmit}>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your document…"
                className="min-h-[44px] px-2 py-1.5 text-[13px] leading-[18px]"
              />
              <PromptInputFooter className="assistant-composer-footer border-t border-border-subtle p-0">
                <div className="assistant-composer-actions" data-testid="assistant-composer-actions">
                  {/* Model picker — grows to fill remaining space */}
                  <div className="assistant-composer-actions__model">
                    <PromptInputSelect value={selectedModel} onValueChange={setSelectedModel}>
                      <PromptInputSelectTrigger
                        className={ASSISTANT_COMPOSER_MODEL_CLASS}
                        title={selectedModelLabel}
                      >
                        <PromptInputSelectValue className="min-w-0 flex-1 truncate text-left">
                          {selectedModelLabel}
                        </PromptInputSelectValue>
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent>
                        {preferences.enabledModelIds.map((id) => {
                          const model = enabledModels.find((m) => m.id === id)
                          const tier = costTiers.get(id) ?? ('$$' as CostTier)
                          return (
                            <PromptInputSelectItem
                              key={id}
                              value={id}
                              title={formatCostTooltip({ pricing: model?.pricing })}
                            >
                              {model?.name ?? id} {tier}
                            </PromptInputSelectItem>
                          )
                        })}
                      </PromptInputSelectContent>
                    </PromptInputSelect>
                  </div>

                  {/* Edit mode + submit — fixed width, never shrinks */}
                  <div className="assistant-composer-actions__controls">
                    <PromptInputSelect
                      value={editMode}
                      onValueChange={(value) => setEditMode(value as AssistantEditMode)}
                    >
                      <PromptInputSelectTrigger
                        className={ASSISTANT_COMPOSER_ICON_SELECT_CLASS}
                        aria-label={
                          editMode === 'suggestion' ? 'Suggestion mode' : 'Auto apply mode'
                        }
                        title={
                          editMode === 'suggestion'
                            ? 'Suggestion mode — track changes for review'
                            : 'Auto apply mode — edits apply immediately'
                        }
                      >
                        {editMode === 'suggestion' ? (
                          <FileDiff className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <Zap className="size-3.5 shrink-0" aria-hidden />
                        )}
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent>
                        <PromptInputSelectItem value="suggestion">
                          <span className="flex items-center gap-2">
                            <FileDiff className="size-3.5 shrink-0" aria-hidden />
                            Suggestion
                          </span>
                        </PromptInputSelectItem>
                        <PromptInputSelectItem value="auto">
                          <span className="flex items-center gap-2">
                            <Zap className="size-3.5 shrink-0" aria-hidden />
                            Auto
                          </span>
                        </PromptInputSelectItem>
                      </PromptInputSelectContent>
                    </PromptInputSelect>

                    <PromptInputSubmit
                      className="!h-control !w-control !min-w-control aspect-square shrink-0 bg-brand p-0 text-white hover:bg-brand/90 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 disabled:opacity-50 [&_svg]:size-3.5"
                      data-testid="assistant-composer-submit"
                      status={
                        status === 'streaming'
                          ? 'streaming'
                          : status === 'error'
                            ? 'error'
                            : 'ready'
                      }
                      onStop={() => void cancel()}
                      disabled={!input.trim() && !isStreaming}
                    />
                  </div>
                </div>
              </PromptInputFooter>
            </PromptInput>
          </div>
          </>
          )}
        </>
      )}
    </aside>
  )
}
