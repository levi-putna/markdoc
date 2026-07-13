import { describe, expect, it } from 'vitest'
import {
  aiDisabledError,
  missingKeyError,
  normaliseGatewayError,
} from '../../src/main/ai/gateway-errors'

describe('gateway-errors', () => {
  it('returns ai disabled error', () => {
    const error = aiDisabledError()
    expect(error.code).toBe('ai_disabled')
    expect(error.message).toContain('Preferences')
  })

  it('returns missing key error', () => {
    const error = missingKeyError()
    expect(error.code).toBe('missing_key')
  })

  it('maps 401 to invalid_key', () => {
    const error = normaliseGatewayError({ error: new Error('HTTP 401 Unauthorized') })
    expect(error.code).toBe('invalid_key')
  })

  it('maps insufficient credit errors', () => {
    const error = normaliseGatewayError({ error: new Error('insufficient credit balance') })
    expect(error.code).toBe('insufficient_credit')
    expect(error.message).toContain('vercel.com')
  })

  it('maps rate limit errors', () => {
    const error = normaliseGatewayError({ error: new Error('429 rate limit exceeded') })
    expect(error.code).toBe('rate_limit')
    expect(error.retryAfterMs).toBeGreaterThan(0)
  })

  it('maps timeout errors', () => {
    const error = normaliseGatewayError({ error: new Error('request timeout') })
    expect(error.code).toBe('timeout')
  })

  it('maps retired model provider errors', () => {
    const error = normaliseGatewayError({
      error: {
        lastError: {
          cause: {
            responseBody: JSON.stringify({
              providerMetadata: {
                gateway: {
                  routing: {
                    modelAttempts: [
                      {
                        providerAttempts: [
                          {
                            error:
                              'This model version has reached the end of its life. Please refer to the AWS documentation for more details.',
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            }),
          },
        },
      },
    })

    expect(error.code).toBe('model_unavailable')
    expect(error.message).toContain('retired')
  })
})
