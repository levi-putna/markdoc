import { describe, expect, it } from 'vitest'
import { buildGatewayStreamOptions } from '../../src/main/ai/gateway-model'

describe('gateway-model', () => {
  it('resolves deprecated models and configures gateway fallbacks', () => {
    const options = buildGatewayStreamOptions({
      apiKey: 'test-key',
      modelId: 'anthropic/claude-3.5-haiku',
    })

    expect(options.providerOptions.gateway.models).toContain('anthropic/claude-sonnet-4.5')
    expect(options.providerOptions.gateway.models).not.toContain('anthropic/claude-haiku-4.5')
    expect(options.model).toBeDefined()
  })
})
