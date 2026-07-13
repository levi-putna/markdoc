import { ipcMain, type WebContents } from 'electron'
import { IPC_CHANNELS, type ChatSendPayload } from '@shared/ipc'
import { DEFAULT_AUTOCOMPLETE_MODEL } from '@shared/ai/default-models'
import type { PreferencesStore } from '../preferences-store'
import { getApiKey, setApiKey, clearApiKey, hasApiKey } from './keychain'
import { listGatewayModels, testApiKey } from './gateway-client'
import {
  getConversation,
  listConversations,
  loadConversation,
  saveConversation,
  startNewConversation,
  clearConversation,
  clearAllConversations,
  updateConversationTitle,
  documentKeyFromPath,
} from './conversation-store'
import { runAssistantAgent, runAutocomplete } from './agent'
import { generateConversationTitle } from './generate-conversation-title'
import { aiDisabledError, missingKeyError } from './gateway-errors'
import type { UIMessage } from 'ai'
import log from 'electron-log'

const activeChatAborts = new Map<number, AbortController>()
const activeAutocompleteAborts = new Map<string, AbortController>()

/**
 * Notifies the renderer that conversation metadata changed.
 */
function notifyConversationsChanged({
  webContents,
  documentKey,
}: {
  webContents: WebContents
  documentKey: string
}): void {
  webContents.send(IPC_CHANNELS.AI_CONVERSATIONS_CHANGED, { documentKey })
}

/**
 * Generates and stores a conversation title when needed.
 */
async function maybeGenerateConversationTitle({
  webContents,
  documentKey,
  conversationId,
  userPrompt,
  apiKey,
  modelId,
}: {
  webContents: WebContents
  documentKey: string
  conversationId: string
  userPrompt: string
  apiKey: string
  modelId: string
}): Promise<void> {
  try {
    const title = await generateConversationTitle({
      apiKey,
      modelId,
      userPrompt,
    })
    await updateConversationTitle({ documentKey, conversationId, title })
    notifyConversationsChanged({ webContents, documentKey })
  } catch (error) {
    log.warn('[assistant] conversation title generation failed', error)
  }
}

/**
 * Registers AI-related IPC handlers.
 */
export function registerAiIpcHandlers({
  preferencesStore,
}: {
  preferencesStore: PreferencesStore
}): void {
  const ensureAiReady = async (): Promise<{ ok: true; apiKey: string } | { ok: false; error: ReturnType<typeof aiDisabledError> }> => {
    const prefs = preferencesStore.store
    if (!prefs.aiEnabled) return { ok: false, error: aiDisabledError() }
    const apiKey = await getApiKey()
    if (!apiKey) return { ok: false, error: missingKeyError() }
    return { ok: true, apiKey }
  }

  ipcMain.handle(IPC_CHANNELS.AI_KEY_SET, async (_, { apiKey }: { apiKey: string }) => {
    await setApiKey({ apiKey })
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEY_CLEAR, async () => {
    await clearApiKey()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_KEY_HAS, async () => hasApiKey())

  ipcMain.handle(IPC_CHANNELS.AI_KEY_TEST, async (_, { apiKey }: { apiKey?: string }) => {
    const key = apiKey ?? (await getApiKey())
    if (!key) return { success: false, error: 'No API key provided.' }
    return testApiKey({ apiKey: key })
  })

  ipcMain.handle(IPC_CHANNELS.AI_MODELS_LIST, async () => {
    const apiKey = await getApiKey()
    const { models, cachedAt } = await listGatewayModels({ apiKey })
    return { models, cachedAt }
  })

  ipcMain.handle(
    IPC_CHANNELS.AI_CONVERSATIONS_GET,
    async (_, { filePath, sessionId }: { filePath: string | null; sessionId: string }) => {
      const documentKey = documentKeyFromPath({ filePath, sessionId })
      return getConversation({ documentKey })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_CONVERSATIONS_LIST,
    async (_, { filePath, sessionId }: { filePath: string | null; sessionId: string }) => {
      const documentKey = documentKeyFromPath({ filePath, sessionId })
      const conversations = await listConversations({ documentKey })
      return { conversations }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_CONVERSATIONS_LOAD,
    async (
      event,
      {
        filePath,
        sessionId,
        conversationId,
      }: { filePath: string | null; sessionId: string; conversationId: string }
    ) => {
      const documentKey = documentKeyFromPath({ filePath, sessionId })
      const conversation = await loadConversation({ documentKey, conversationId })
      notifyConversationsChanged({ webContents: event.sender, documentKey })
      return conversation
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_CONVERSATIONS_SAVE,
    async (
      event,
      {
        filePath,
        sessionId,
        conversationId,
        messages,
      }: {
        filePath: string | null
        sessionId: string
        conversationId: string
        messages: UIMessage[]
      }
    ) => {
      const documentKey = documentKeyFromPath({ filePath, sessionId })
      const { needsTitle, userPrompt } = await saveConversation({
        documentKey,
        conversationId,
        messages,
      })

      notifyConversationsChanged({ webContents: event.sender, documentKey })

      if (needsTitle) {
        const ready = await ensureAiReady()
        if (ready.ok) {
          const prefs = preferencesStore.store
          void maybeGenerateConversationTitle({
            webContents: event.sender,
            documentKey,
            conversationId,
            userPrompt,
            apiKey: ready.apiKey,
            modelId: prefs.defaultAutocompleteModel || DEFAULT_AUTOCOMPLETE_MODEL,
          })
        }
      }

      return { success: true }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_CONVERSATIONS_START_NEW,
    async (event, { filePath, sessionId }: { filePath: string | null; sessionId: string }) => {
      const documentKey = documentKeyFromPath({ filePath, sessionId })
      const conversation = await startNewConversation({ documentKey })
      notifyConversationsChanged({ webContents: event.sender, documentKey })
      return conversation
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_CONVERSATIONS_CLEAR,
    async (event, { filePath, sessionId }: { filePath: string | null; sessionId: string }) => {
      const documentKey = documentKeyFromPath({ filePath, sessionId })
      await clearConversation({ documentKey })
      notifyConversationsChanged({ webContents: event.sender, documentKey })
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.AI_CONVERSATIONS_CLEAR_ALL, async () => {
    await clearAllConversations()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CHAT_SEND, async (event, payload: ChatSendPayload) => {
    const webContents = event.sender
    const ready = await ensureAiReady()
    if (!ready.ok) {
      webContents.send(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, { type: 'error', error: ready.error })
      return { success: false }
    }

    const prefs = preferencesStore.store
    if (!prefs.aiDisclosureAccepted) {
      webContents.send(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, {
        type: 'error',
        error: {
          code: 'ai_disabled',
          message: 'Please accept the AI disclosure in Preferences before sending messages.',
        },
      })
      return { success: false }
    }

    const existing = activeChatAborts.get(webContents.id)
    existing?.abort()
    const abortController = new AbortController()
    activeChatAborts.set(webContents.id, abortController)

    void runAssistantAgent({
      apiKey: ready.apiKey,
      modelId: payload.modelId,
      messages: payload.messages,
      editMode: payload.editMode,
      webContents,
      abortSignal: abortController.signal,
    }).finally(() => {
      if (activeChatAborts.get(webContents.id) === abortController) {
        activeChatAborts.delete(webContents.id)
      }
    })

    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_CHAT_CANCEL, async (event) => {
    const controller = activeChatAborts.get(event.sender.id)
    controller?.abort()
    activeChatAborts.delete(event.sender.id)
    return { success: true }
  })

  ipcMain.handle(
    IPC_CHANNELS.AI_AUTOCOMPLETE_REQUEST,
    async (
      event,
      {
        requestId,
        modelId,
        context,
      }: {
        requestId: string
        modelId: string
        context: import('@shared/ai-autocomplete-context').AutocompleteEditorContext
      }
    ) => {
      const webContents = event.sender
      const prefs = preferencesStore.store
      if (!prefs.aiEnabled || !prefs.autocompleteEnabled) return { success: false }

      const ready = await ensureAiReady()
      if (!ready.ok) return { success: false }

      activeAutocompleteAborts.get(requestId)?.abort()
      const abortController = new AbortController()
      activeAutocompleteAborts.set(requestId, abortController)

      try {
        const text = await runAutocomplete({
          apiKey: ready.apiKey,
          modelId,
          context,
          abortSignal: abortController.signal,
        })
        webContents.send(IPC_CHANNELS.AI_AUTOCOMPLETE_RESULT, { requestId, text })
        return { success: true }
      } catch (error) {
        webContents.send(IPC_CHANNELS.AI_AUTOCOMPLETE_RESULT, {
          requestId,
          text: '',
          error: error instanceof Error ? error.message : 'Autocomplete failed',
        })
        return { success: false }
      } finally {
        activeAutocompleteAborts.delete(requestId)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.AI_AUTOCOMPLETE_CANCEL, async (_, { requestId }: { requestId: string }) => {
    activeAutocompleteAborts.get(requestId)?.abort()
    activeAutocompleteAborts.delete(requestId)
    return { success: true }
  })

  const forwardSuggestion = (channel: string, webContents: WebContents, payload?: unknown) => {
    webContents.send(channel, payload)
  }

  ipcMain.handle(IPC_CHANNELS.AI_SUGGESTION_ACCEPT, async (event, payload) => {
    forwardSuggestion(IPC_CHANNELS.AI_SUGGESTION_ACCEPT, event.sender, payload)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_SUGGESTION_REJECT, async (event, payload) => {
    forwardSuggestion(IPC_CHANNELS.AI_SUGGESTION_REJECT, event.sender, payload)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_SUGGESTION_ACCEPT_ALL, async (event) => {
    forwardSuggestion(IPC_CHANNELS.AI_SUGGESTION_ACCEPT_ALL, event.sender)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AI_SUGGESTION_REJECT_ALL, async (event) => {
    forwardSuggestion(IPC_CHANNELS.AI_SUGGESTION_REJECT_ALL, event.sender)
    return { success: true }
  })
}
