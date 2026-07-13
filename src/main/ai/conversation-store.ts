import { createHash } from 'crypto'
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { UIMessage } from 'ai'
import { nanoid } from 'nanoid'
import type { ConversationSummary, StoredConversation } from '@shared/ai/types'
import { fallbackConversationTitle } from './generate-conversation-title'

const CONVERSATIONS_DIR = 'Conversations'
const NEW_CONVERSATION_TITLE = 'New conversation'

interface DocumentConversationsFile {
  activeConversationId: string
  conversations: StoredConversation[]
}

/**
 * Returns the conversations storage directory.
 */
function conversationsDir(): string {
  return join(app.getPath('userData'), CONVERSATIONS_DIR)
}

/**
 * Derives a stable storage key from a document path or session id.
 */
export function documentKeyFromPath({ filePath, sessionId }: { filePath: string | null; sessionId?: string }): string {
  if (filePath) {
    return createHash('sha256').update(filePath).digest('hex').slice(0, 32)
  }
  return createHash('sha256').update(sessionId ?? 'untitled').digest('hex').slice(0, 32)
}

function conversationFilePath({ documentKey }: { documentKey: string }): string {
  return join(conversationsDir(), `${documentKey}.json`)
}

/**
 * Extracts plain text from the first user message in a thread.
 */
function firstUserPrompt({ messages }: { messages: UIMessage[] }): string {
  const userMessage = messages.find((message) => message.role === 'user')
  if (!userMessage) return ''

  return userMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('')
    .trim()
}

/**
 * Builds a provisional title before AI generation runs.
 */
function provisionalTitle({ messages }: { messages: UIMessage[] }): string {
  const userPrompt = firstUserPrompt({ messages })
  if (!userPrompt) return NEW_CONVERSATION_TITLE
  return fallbackConversationTitle({ userPrompt })
}

/**
 * Creates an empty conversation record.
 */
function createConversation(): StoredConversation {
  const now = Date.now()
  return {
    id: nanoid(),
    title: NEW_CONVERSATION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
    aiTitleGenerated: false,
  }
}

/**
 * Normalises legacy and current on-disk conversation formats.
 */
function normaliseDocumentFile({ parsed }: { parsed: unknown }): DocumentConversationsFile {
  if (parsed && typeof parsed === 'object' && 'conversations' in parsed) {
    const file = parsed as Partial<DocumentConversationsFile>
    const conversations = Array.isArray(file.conversations)
      ? file.conversations
          .filter((conversation): conversation is StoredConversation => {
            return Boolean(
              conversation &&
                typeof conversation === 'object' &&
                typeof conversation.id === 'string' &&
                Array.isArray(conversation.messages)
            )
          })
          .map((conversation) => ({
            ...conversation,
            title: conversation.title || NEW_CONVERSATION_TITLE,
            createdAt: conversation.createdAt ?? conversation.updatedAt ?? Date.now(),
            updatedAt: conversation.updatedAt ?? conversation.createdAt ?? Date.now(),
            aiTitleGenerated: conversation.aiTitleGenerated ?? Boolean(conversation.title),
          }))
      : []

    if (conversations.length === 0) {
      const conversation = createConversation()
      return {
        activeConversationId: conversation.id,
        conversations: [conversation],
      }
    }

    const activeConversationId =
      typeof file.activeConversationId === 'string' &&
      conversations.some((conversation) => conversation.id === file.activeConversationId)
        ? file.activeConversationId
        : conversations[0].id

    return {
      activeConversationId,
      conversations,
    }
  }

  const legacy = parsed as { messages?: UIMessage[]; updatedAt?: number; title?: string }
  const messages = legacy.messages ?? []
  const now = legacy.updatedAt ?? Date.now()
  const conversation: StoredConversation = {
    id: nanoid(),
    title: legacy.title || provisionalTitle({ messages }),
    messages,
    createdAt: now,
    updatedAt: now,
    aiTitleGenerated: Boolean(legacy.title),
  }

  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  }
}

/**
 * Reads the conversation file for a document.
 */
async function readDocumentFile({ documentKey }: { documentKey: string }): Promise<DocumentConversationsFile> {
  try {
    const raw = await readFile(conversationFilePath({ documentKey }), 'utf-8')
    return normaliseDocumentFile({ parsed: JSON.parse(raw) })
  } catch {
    const conversation = createConversation()
    return {
      activeConversationId: conversation.id,
      conversations: [conversation],
    }
  }
}

/**
 * Persists the conversation file for a document.
 */
async function writeDocumentFile({
  documentKey,
  file,
}: {
  documentKey: string
  file: DocumentConversationsFile
}): Promise<void> {
  await mkdir(conversationsDir(), { recursive: true })
  await writeFile(conversationFilePath({ documentKey }), JSON.stringify(file, null, 2), 'utf-8')
}

/**
 * Returns the active conversation for a document.
 */
function getActiveConversation({ file }: { file: DocumentConversationsFile }): StoredConversation {
  return (
    file.conversations.find((conversation) => conversation.id === file.activeConversationId) ??
    file.conversations[0]
  )
}

/**
 * Loads the active conversation messages for a document.
 */
export async function getConversation({
  documentKey,
}: {
  documentKey: string
}): Promise<{ conversationId: string; title: string; messages: UIMessage[] }> {
  const file = await readDocumentFile({ documentKey })
  const active = getActiveConversation({ file })

  return {
    conversationId: active.id,
    title: active.title,
    messages: active.messages,
  }
}

/**
 * Lists conversation summaries for a document, sorted by last activity.
 */
export async function listConversations({
  documentKey,
}: {
  documentKey: string
}): Promise<ConversationSummary[]> {
  const file = await readDocumentFile({ documentKey })

  return file.conversations
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      isActive: conversation.id === file.activeConversationId,
      hasMessages: conversation.messages.length > 0,
    }))
    .filter((conversation) => conversation.hasMessages)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

/**
 * Persists the active conversation messages for a document.
 */
export async function saveConversation({
  documentKey,
  conversationId,
  messages,
}: {
  documentKey: string
  conversationId: string
  messages: UIMessage[]
}): Promise<{ needsTitle: boolean; userPrompt: string }> {
  const file = await readDocumentFile({ documentKey })
  const now = Date.now()
  const index = file.conversations.findIndex((conversation) => conversation.id === conversationId)
  const existing = index === -1 ? null : file.conversations[index]
  const userPrompt = firstUserPrompt({ messages })
  const title =
    existing?.title && existing.title !== NEW_CONVERSATION_TITLE
      ? existing.title
      : provisionalTitle({ messages })

  const nextConversation: StoredConversation = {
    id: conversationId,
    title,
    messages,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    aiTitleGenerated: existing?.aiTitleGenerated ?? false,
  }

  if (index === -1) {
    file.conversations.push(nextConversation)
    file.activeConversationId = conversationId
  } else {
    file.conversations[index] = nextConversation
  }

  await writeDocumentFile({ documentKey, file })

  return {
    needsTitle: Boolean(userPrompt) && !nextConversation.aiTitleGenerated,
    userPrompt,
  }
}

/**
 * Updates the generated title for a stored conversation.
 */
export async function updateConversationTitle({
  documentKey,
  conversationId,
  title,
}: {
  documentKey: string
  conversationId: string
  title: string
}): Promise<void> {
  const file = await readDocumentFile({ documentKey })
  const index = file.conversations.findIndex((conversation) => conversation.id === conversationId)
  if (index === -1) return

  file.conversations[index] = {
    ...file.conversations[index],
    title,
    updatedAt: Date.now(),
    aiTitleGenerated: true,
  }

  await writeDocumentFile({ documentKey, file })
}

/**
 * Switches the active conversation for a document.
 */
export async function loadConversation({
  documentKey,
  conversationId,
}: {
  documentKey: string
  conversationId: string
}): Promise<{ conversationId: string; title: string; messages: UIMessage[] }> {
  const file = await readDocumentFile({ documentKey })
  const conversation = file.conversations.find((entry) => entry.id === conversationId)
  if (!conversation) {
    return getConversation({ documentKey })
  }

  file.activeConversationId = conversationId
  await writeDocumentFile({ documentKey, file })

  return {
    conversationId: conversation.id,
    title: conversation.title,
    messages: conversation.messages,
  }
}

/**
 * Archives the current conversation and starts a fresh thread.
 */
export async function startNewConversation({
  documentKey,
}: {
  documentKey: string
}): Promise<{ conversationId: string; title: string; messages: UIMessage[] }> {
  const file = await readDocumentFile({ documentKey })
  const active = getActiveConversation({ file })

  if (active.messages.length === 0) {
    return {
      conversationId: active.id,
      title: active.title,
      messages: active.messages,
    }
  }

  const conversation = createConversation()
  file.conversations.push(conversation)
  file.activeConversationId = conversation.id
  await writeDocumentFile({ documentKey, file })

  return {
    conversationId: conversation.id,
    title: conversation.title,
    messages: conversation.messages,
  }
}

/**
 * Clears conversation history for one document.
 */
export async function clearConversation({ documentKey }: { documentKey: string }): Promise<void> {
  try {
    await unlink(conversationFilePath({ documentKey }))
  } catch {
    // File may not exist
  }
}

/**
 * Clears all stored conversation histories.
 */
export async function clearAllConversations(): Promise<void> {
  try {
    const dir = conversationsDir()
    const files = await readdir(dir)
    await Promise.all(
      files.filter((file) => file.endsWith('.json')).map((file) => unlink(join(dir, file)))
    )
  } catch {
    // Directory may not exist
  }
}
