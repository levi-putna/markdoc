import type { AiErrorPayload } from '@shared/ai/types'
import { AI_BILLING_URL } from '@shared/ai/types'
import { APICallError } from 'ai'

/**
 * Extracts nested provider error text from Vercel AI Gateway / AI SDK errors.
 */
function extractGatewayProviderError({ error }: { error: unknown }): string | null {
  const visited = new Set<unknown>()
  const queue: unknown[] = [error]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)

    if (typeof current === 'string') {
      if (current.includes('end of its life') || current.includes('model version has reached')) {
        return current
      }

      try {
        const parsed = JSON.parse(current) as {
          providerMetadata?: {
            gateway?: {
              routing?: {
                modelAttempts?: Array<{
                  providerAttempts?: Array<{ error?: string }>
                }>
              }
            }
          }
        }

        for (const attempt of parsed.providerMetadata?.gateway?.routing?.modelAttempts ?? []) {
          for (const providerAttempt of attempt.providerAttempts ?? []) {
            if (providerAttempt.error) queue.push(providerAttempt.error)
          }
        }
      } catch {
        // Not JSON — continue scanning other fields.
      }
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>
      for (const value of Object.values(record)) {
        queue.push(value)
      }
    }
  }

  return null
}

/**
 * Normalises gateway / fetch errors into user-facing AI error payloads.
 */
export function normaliseGatewayError({ error }: { error: unknown }): AiErrorPayload {
  const providerError = extractGatewayProviderError({ error })
  if (providerError?.toLowerCase().includes('end of its life')) {
    return {
      code: 'model_unavailable',
      message:
        'This model has been retired by the provider. Choose a newer model from the selector or update your defaults in Preferences.',
      detail: providerError,
    }
  }

  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
        return {
          code: 'invalid_key',
          message: 'Your AI Gateway API key is invalid. Update it in Preferences.',
          detail: error.message,
        }
      case 402:
        return {
          code: 'insufficient_credit',
          message: `Insufficient AI Gateway credits. Add credits in your Vercel dashboard: ${AI_BILLING_URL}`,
          detail: error.message,
        }
      case 403:
        return {
          code: 'insufficient_credit',
          message: `Insufficient AI Gateway credits. Add credits in your Vercel dashboard: ${AI_BILLING_URL}`,
          detail: error.message,
        }
      case 429:
        return {
          code: 'rate_limit',
          message: 'Rate limited. Please wait a moment and try again.',
          detail: error.message,
          retryAfterMs: 5000,
        }
      case 404:
        return {
          code: 'model_unavailable',
          message: 'This model is unavailable. Try another model from the selector.',
          detail: error.message,
        }
      case 503:
        return {
          code: 'network',
          message: 'The AI Gateway is temporarily unavailable. Please try again shortly.',
          detail: error.message,
        }
      default:
        break
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid api key')) {
      return {
        code: 'invalid_key',
        message: 'Your AI Gateway API key is invalid. Update it in Preferences.',
        detail: error.message,
      }
    }

    if (
      message.includes('402') ||
      message.includes('403') ||
      message.includes('insufficient') ||
      message.includes('credit') ||
      message.includes('quota')
    ) {
      return {
        code: 'insufficient_credit',
        message: `Insufficient AI Gateway credits. Add credits in your Vercel dashboard: ${AI_BILLING_URL}`,
        detail: error.message,
      }
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return {
        code: 'rate_limit',
        message: 'Rate limited. Please wait a moment and try again.',
        detail: error.message,
        retryAfterMs: 5000,
      }
    }

    if (message.includes('timeout') || message.includes('aborted') || message.includes('abort')) {
      return {
        code: 'timeout',
        message: 'The request timed out. You can retry your message.',
        detail: error.message,
      }
    }

    if (message.includes('model') && (message.includes('not found') || message.includes('unavailable'))) {
      return {
        code: 'model_unavailable',
        message: 'This model is unavailable. Try another model from the selector.',
        detail: error.message,
      }
    }

    if (message.includes('fetch') || message.includes('network') || message.includes('econnrefused')) {
      return {
        code: 'network',
        message: 'Could not reach the AI Gateway. Check your internet connection.',
        detail: error.message,
      }
    }

    return {
      code: 'unknown',
      message: 'Something went wrong with the AI request. Please try again.',
      detail: error.message,
    }
  }

  return {
    code: 'unknown',
    message: 'Something went wrong with the AI request. Please try again.',
  }
}

export function aiDisabledError(): AiErrorPayload {
  return {
    code: 'ai_disabled',
    message: 'AI is disabled. Enable it in Preferences to use the assistant.',
  }
}

export function missingKeyError(): AiErrorPayload {
  return {
    code: 'missing_key',
    message: 'Add your Vercel AI Gateway API key in Preferences.',
  }
}
