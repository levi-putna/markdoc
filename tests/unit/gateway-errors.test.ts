import { describe, expect, it } from 'vitest'
import { APICallError } from 'ai'
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

  it('maps APICallError status codes to user-facing payloads', () => {
    expect(
      normaliseGatewayError({
        error: new APICallError({
          message: 'Unauthorized',
          url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 401,
          responseHeaders: {},
          responseBody: '',
          isRetryable: false,
        }),
      }).code
    ).toBe('invalid_key')

    expect(
      normaliseGatewayError({
        error: new APICallError({
          message: 'Payment required',
          url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 402,
          responseHeaders: {},
          responseBody: '',
          isRetryable: false,
        }),
      }).code
    ).toBe('insufficient_credit')

    expect(
      normaliseGatewayError({
        error: new APICallError({
          message: 'Forbidden',
          url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 403,
          responseHeaders: {},
          responseBody: '',
          isRetryable: false,
        }),
      }).code
    ).toBe('insufficient_credit')

    expect(
      normaliseGatewayError({
        error: new APICallError({
          message: 'Too many requests',
          url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 429,
          responseHeaders: {},
          responseBody: '',
          isRetryable: true,
        }),
      })
    ).toMatchObject({ code: 'rate_limit', retryAfterMs: 5000 })

    expect(
      normaliseGatewayError({
        error: new APICallError({
          message: 'Model not found',
          url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 404,
          responseHeaders: {},
          responseBody: '',
          isRetryable: false,
        }),
      }).code
    ).toBe('model_unavailable')

    expect(
      normaliseGatewayError({
        error: new APICallError({
          message: 'Service unavailable',
          url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
          requestBodyValues: {},
          statusCode: 503,
          responseHeaders: {},
          responseBody: '',
          isRetryable: true,
        }),
      }).code
    ).toBe('network')
  })
})
