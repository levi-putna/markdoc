import {
  streamText,
  convertToModelMessages,
  generateText,
  isStepCount,
  type UIMessage,
} from 'ai'
import type { WebContents } from 'electron'
import log from 'electron-log'
import { IPC_CHANNELS } from '@shared/ipc'
import type { AiErrorPayload, AssistantEditMode } from '@shared/ai/types'
import { buildAssistantTools, requestDocumentSnapshot } from './tools'
import { normaliseGatewayError } from './gateway-errors'
import { ASSISTANT_MAX_STEPS, buildGatewayStreamOptions } from './gateway-model'
import {
  buildAutocompletePrompt,
  normaliseAutocompleteSuggestion,
  type AutocompleteEditorContext,
} from '@shared/ai-autocomplete-context'
import { nanoid } from 'nanoid'

const SYSTEM_PROMPT = `You are MarkDoc's document writing assistant. You help users understand and edit their Markdown document.

Use tools to read the document before making claims or edits. When referencing headings in your replies, use heading://<headingId> links (e.g. heading://h2-intro-0).

Markdown structure and formatting:
- Before editing, read enough context to see surrounding structure — use read_document (with a heading or line range), read_outline, and read_selection as needed. Inspect lines above and below the target range, not just the exact span being replaced.
- Match the document's existing Markdown conventions: heading levels, list style (- vs * vs numbered), emphasis style, indentation, and blank-line spacing between blocks.
- Preserve block structure. Do not flatten headings, lists, blockquotes, or fenced code blocks into plain text unless the user explicitly asks for that.
- Scope replacements correctly: use inline Markdown for inline edits; include full block syntax (heading markers, list markers, fence delimiters) when replacing whole blocks.
- Respect heading hierarchy — do not introduce a heading level that skips or disrupts the outline. Use read_outline before moving or rewriting sections.
- Keep list numbering and bullet continuity intact. When editing one list item, do not break the list or leave dangling markers.
- Preserve fenced code block language tags and closing fences. Never leave an unclosed fence or half a code block.
- Maintain blank lines between blocks as in the surrounding document. A missing or extra blank line can change rendering.
- If a requested change would break surrounding formatting, adjust the replacement, narrow or widen the edit range, or explain the trade-off in your reply instead of applying a damaging edit.

For edits:
- Call read_selection before editing selected text and use its from/to positions in propose_edit.
- Always include originalText in propose_edit — the exact text being replaced — even when from/to are provided.
- Use propose_edit in Suggestion mode so the user can review track changes in the editor.
- Use apply_edit only when the user has auto-apply mode enabled or explicitly asks for immediate changes.
- After making one or more edits, end with a short **Changes** section: one bullet per edit using the tool summary, not the full replacement text.`

interface RunAgentParams {
  apiKey: string
  modelId: string
  messages: UIMessage[]
  editMode: AssistantEditMode
  webContents: WebContents
  abortSignal: AbortSignal
}

/**
 * Sends a normalised assistant error to the renderer.
 */
function sendAssistantError({
  webContents,
  error,
}: {
  webContents: WebContents
  error: unknown
}): void {
  webContents.send(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, {
    type: 'error',
    error: normaliseGatewayError({ error }),
  })
}

/**
 * Runs the assistant agent loop and streams UI message chunks to the renderer.
 */
export async function runAssistantAgent({
  apiKey,
  modelId,
  messages,
  editMode,
  webContents,
  abortSignal,
}: RunAgentParams): Promise<void> {
  const gatewayOptions = buildGatewayStreamOptions({ apiKey, modelId })

  const getSnapshot = () => requestDocumentSnapshot({ webContents })

  const onProposeEdit = async ({
    from,
    to,
    originalText,
    replacement,
    rationale,
    summary,
  }: {
    from?: number
    to?: number
    originalText?: string
    replacement: string
    rationale?: string
    summary?: string
  }) => {
    const suggestionId = nanoid()
    webContents.send(IPC_CHANNELS.AI_SUGGESTION_APPLY, {
      suggestionId,
      from,
      to,
      originalText,
      replacement,
      rationale,
      summary,
    })
    return suggestionId
  }

  const onApplyEdit = async ({
    from,
    to,
    originalText,
    replacement,
    rationale,
    summary,
  }: {
    from?: number
    to?: number
    originalText?: string
    replacement: string
    rationale?: string
    summary?: string
  }) => {
    webContents.send(IPC_CHANNELS.AI_SUGGESTION_APPLY, {
      suggestionId: nanoid(),
      from,
      to,
      originalText,
      replacement,
      rationale,
      summary,
      autoApply: true,
    })
  }

  const tools = buildAssistantTools({
    getSnapshot,
    onProposeEdit,
    onApplyEdit,
    editMode,
  })

  let streamError: AiErrorPayload | null = null

  try {
    const result = streamText({
      ...gatewayOptions,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: isStepCount(ASSISTANT_MAX_STEPS),
      abortSignal,
      onError({ error }) {
        const payload = normaliseGatewayError({ error })
        streamError = payload
        log.warn('[assistant] streamText error', payload.detail ?? payload.message)
      },
    })

    const stream = result.toUIMessageStream({
      onError: (error) => {
        const payload = normaliseGatewayError({ error })
        streamError = payload
        return payload.message
      },
    })

    for await (const chunk of stream) {
      if (abortSignal.aborted) break

      if (chunk.type === 'error') {
        streamError = streamError ?? {
          code: 'unknown',
          message: chunk.errorText || 'Something went wrong with the AI request. Please try again.',
        }
        break
      }

      webContents.send(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, {
        type: 'ui-message-chunk',
        chunk,
      })
    }

    if (streamError) {
      sendAssistantError({ webContents, error: streamError })
      return
    }

    if (!abortSignal.aborted) {
      webContents.send(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, { type: 'done' })
    }
  } catch (error) {
    sendAssistantError({ webContents, error })
  }
}

/**
 * Generates inline autocomplete ghost text.
 */
export async function runAutocomplete({
  apiKey,
  modelId,
  context,
  abortSignal,
}: {
  apiKey: string
  modelId: string
  context: AutocompleteEditorContext
  abortSignal: AbortSignal
}): Promise<string> {
  const { system, prompt } = buildAutocompletePrompt({ context })
  const gatewayOptions = buildGatewayStreamOptions({ apiKey, modelId })
  const { text } = await generateText({
    ...gatewayOptions,
    system,
    prompt,
    abortSignal,
    maxOutputTokens: 80,
  })

  return (
    normaliseAutocompleteSuggestion({
      suggestion: text,
      prefix: context.prefix,
      suffix: context.suffix,
      charBeforeCursor: context.charBeforeCursor,
      charAfterCursor: context.charAfterCursor,
      cursorInWord: context.cursorInWord,
    }) ?? ''
  )
}
