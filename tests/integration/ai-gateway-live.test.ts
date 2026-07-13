import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTOCOMPLETE_MODEL } from '@shared/ai/default-models'
import { getAiGatewayApiKey, hasAiGatewayApiKey } from '../helpers/ai-gateway-key'
import { listGatewayModels, testApiKey } from '../../src/main/ai/gateway-client'
import { runAutocomplete } from '../../src/main/ai/agent'
import { generateConversationTitle } from '../../src/main/ai/generate-conversation-title'

/**
 * Optional live tests against Vercel AI Gateway.
 * Skipped in CI unless AI_GATEWAY_API_KEY is provided.
 */
describe.runIf(hasAiGatewayApiKey())('ai-gateway live integration', () => {
  const apiKey = getAiGatewayApiKey()!
  const modelId = DEFAULT_AUTOCOMPLETE_MODEL

  it('validates the configured API key', async () => {
    const result = await testApiKey({ apiKey })

    expect(result.success).toBe(true)
  })

  it('lists available gateway models', async () => {
    const { models } = await listGatewayModels({ apiKey, forceRefresh: true })

    expect(models.length).toBeGreaterThan(5)
    expect(models.some((model) => model.id === modelId)).toBe(true)
  })

  it('generates inline autocomplete suggestions', async () => {
    const suggestion = await runAutocomplete({
      apiKey,
      modelId,
      context: {
        prefix: 'The quarterly report highlights',
        suffix: '',
        charBeforeCursor: 's',
        charAfterCursor: '',
        cursorInWord: false,
        contextWindow: 'paragraph',
        block: {
          blockType: 'paragraph',
          sectionTitle: 'Summary',
        },
      },
      abortSignal: new AbortController().signal,
    })

    expect(typeof suggestion).toBe('string')
    expect(suggestion.length).toBeLessThanOrEqual(120)
  }, 30_000)

  it('generates a short conversation title', async () => {
    const title = await generateConversationTitle({
      apiKey,
      modelId,
      userPrompt: 'Help me rewrite the introduction paragraph to be more concise',
    })

    expect(title.length).toBeGreaterThan(0)
    expect(title.length).toBeLessThanOrEqual(48)
    expect(title).not.toMatch(/^help me rewrite the introduction paragraph to be more concise$/i)
  }, 30_000)
})
