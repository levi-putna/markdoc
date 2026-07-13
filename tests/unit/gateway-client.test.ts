import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listGatewayModels, testApiKey } from '../../src/main/ai/gateway-client'

describe('gateway-client', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('lists models from the gateway response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'google/gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            pricing: { input: '0.000001', output: '0.000002' },
          },
        ],
      }),
    }) as typeof fetch

    const { models } = await listGatewayModels({ apiKey: 'test-key', forceRefresh: true })

    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('google/gemini-2.5-flash')
    expect(models[0].pricing?.input).toBe('0.000001')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ai-gateway.vercel.sh/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    )
  })

  it('falls back to default models when the gateway is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch

    const { models } = await listGatewayModels({ forceRefresh: true })

    expect(models.length).toBeGreaterThan(0)
    expect(models.some((model) => model.id.includes('/'))).toBe(true)
  })

  it('validates a working API key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch

    const result = await testApiKey({ apiKey: 'valid-key' })

    expect(result).toEqual({ success: true })
  })

  it('rejects invalid API keys', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as typeof fetch

    const result = await testApiKey({ apiKey: 'bad-key' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid API key')
  })

  it('reports gateway HTTP errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as typeof fetch

    const result = await testApiKey({ apiKey: 'test-key' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('503')
  })
})
