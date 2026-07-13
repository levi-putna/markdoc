import { mkdtemp, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import conversationFixture from '../fixtures/ai/conversation-thread.json'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return userDataDir
      throw new Error(`Unexpected electron path: ${name}`)
    },
  },
}))

const {
  documentKeyFromPath,
  getConversation,
  listConversations,
  saveConversation,
  loadConversation,
  startNewConversation,
  clearConversation,
  clearAllConversations,
} = await import('../../src/main/ai/conversation-store')

const fixtureMessages = conversationFixture.messages as UIMessage[]

describe('conversation-store', () => {
  beforeEach(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'markdoc-conversations-'))
  })

  afterEach(async () => {
    await rm(userDataDir, { recursive: true, force: true })
  })

  it('derives stable document keys from file paths and session ids', () => {
    const fromPath = documentKeyFromPath({ filePath: '/tmp/a.md', sessionId: 'session-a' })
    const fromSamePath = documentKeyFromPath({ filePath: '/tmp/a.md', sessionId: 'session-b' })
    const fromSession = documentKeyFromPath({ filePath: null, sessionId: 'session-a' })

    expect(fromPath).toHaveLength(32)
    expect(fromPath).toBe(fromSamePath)
    expect(fromSession).not.toBe(fromPath)
  })

  it('persists and reloads the active conversation for a document', async () => {
    const documentKey = documentKeyFromPath({ filePath: '/tmp/doc-a.md', sessionId: 's1' })
    const initial = await getConversation({ documentKey })

    await saveConversation({
      documentKey,
      conversationId: initial.conversationId,
      messages: fixtureMessages,
    })

    const reloaded = await getConversation({ documentKey })

    expect(reloaded.messages).toHaveLength(fixtureMessages.length)
    const firstPart = fixtureMessages[0].parts[0]
    const firstText = firstPart.type === 'text' ? firstPart.text : ''
    expect(reloaded.messages[0].parts[0]).toMatchObject({ type: 'text', text: firstText })
    expect(reloaded.title).toContain('Summarise')
  })

  it('lists only conversations that contain messages', async () => {
    const documentKey = documentKeyFromPath({ filePath: '/tmp/doc-b.md', sessionId: 's2' })
    const initial = await getConversation({ documentKey })

    expect(await listConversations({ documentKey })).toHaveLength(0)

    await saveConversation({
      documentKey,
      conversationId: initial.conversationId,
      messages: fixtureMessages,
    })

    const summaries = await listConversations({ documentKey })

    expect(summaries).toHaveLength(1)
    expect(summaries[0].isActive).toBe(true)
    expect(summaries[0].hasMessages).toBe(true)
  })

  it('switches active conversation when loading history', async () => {
    const documentKey = documentKeyFromPath({ filePath: '/tmp/doc-c.md', sessionId: 's3' })
    const initial = await getConversation({ documentKey })

    await saveConversation({
      documentKey,
      conversationId: initial.conversationId,
      messages: fixtureMessages,
    })

    const fresh = await startNewConversation({ documentKey })
    await saveConversation({
      documentKey,
      conversationId: fresh.conversationId,
      messages: [
        {
          id: 'msg-user-2',
          role: 'user',
          parts: [{ type: 'text', text: 'Rewrite the conclusion' }],
        },
      ],
    })

    const loaded = await loadConversation({
      documentKey,
      conversationId: initial.conversationId,
    })

    expect(loaded.conversationId).toBe(initial.conversationId)
    expect(loaded.messages).toHaveLength(fixtureMessages.length)

    const active = await getConversation({ documentKey })
    expect(active.conversationId).toBe(initial.conversationId)
  })

  it('reuses the empty active conversation instead of creating duplicates', async () => {
    const documentKey = documentKeyFromPath({ filePath: '/tmp/doc-d.md', sessionId: 's4' })
    const first = await getConversation({ documentKey })

    await saveConversation({
      documentKey,
      conversationId: first.conversationId,
      messages: [],
    })

    const second = await startNewConversation({ documentKey })

    expect(second.conversationId).toBe(first.conversationId)
  })

  it('migrates legacy single-thread conversation files', async () => {
    const documentKey = documentKeyFromPath({ filePath: '/tmp/legacy.md', sessionId: 'legacy' })

    await rm(userDataDir, { recursive: true, force: true })
    userDataDir = await mkdtemp(join(tmpdir(), 'markdoc-conversations-'))
    const { mkdir, writeFile } = await import('fs/promises')
    await mkdir(join(userDataDir, 'Conversations'), { recursive: true })
    const legacyPath = join(userDataDir, 'Conversations', `${documentKey}.json`)
    await writeFile(
      legacyPath,
      JSON.stringify({
        messages: fixtureMessages,
        updatedAt: Date.now(),
        title: 'Legacy title',
      }),
      'utf-8'
    )

    const conversation = await getConversation({ documentKey })

    expect(conversation.messages).toHaveLength(fixtureMessages.length)
    expect(conversation.title).toBe('Legacy title')
  })

  it('clears conversation storage for one document and all documents', async () => {
    const documentKeyA = documentKeyFromPath({ filePath: '/tmp/doc-e.md', sessionId: 's5' })
    const documentKeyB = documentKeyFromPath({ filePath: '/tmp/doc-f.md', sessionId: 's6' })

    const conversationA = await getConversation({ documentKey: documentKeyA })
    const conversationB = await getConversation({ documentKey: documentKeyB })

    await saveConversation({
      documentKey: documentKeyA,
      conversationId: conversationA.conversationId,
      messages: fixtureMessages,
    })
    await saveConversation({
      documentKey: documentKeyB,
      conversationId: conversationB.conversationId,
      messages: fixtureMessages,
    })

    await clearConversation({ documentKey: documentKeyA })
    await expect(readFile(join(userDataDir, 'Conversations', `${documentKeyA}.json`), 'utf-8')).rejects.toThrow()

    await clearAllConversations()
    await expect(readFile(join(userDataDir, 'Conversations', `${documentKeyB}.json`), 'utf-8')).rejects.toThrow()
  })
})
