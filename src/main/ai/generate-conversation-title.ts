import { generateText } from 'ai'
import { buildGatewayStreamOptions } from './gateway-model'

const MAX_TITLE_LENGTH = 48

/**
 * Truncates a title so it fits roughly two lines in the assistant history list.
 */
export function truncateConversationTitle({ title }: { title: string }): string {
  const cleaned = title.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned
  return `${cleaned.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
}

/**
 * Builds a fallback title from the user's first prompt when AI generation is unavailable.
 */
export function fallbackConversationTitle({ userPrompt }: { userPrompt: string }): string {
  return truncateConversationTitle({ title: userPrompt })
}

/**
 * Generates a short conversation title from the user's opening prompt.
 */
export async function generateConversationTitle({
  apiKey,
  modelId,
  userPrompt,
  abortSignal,
}: {
  apiKey: string
  modelId: string
  userPrompt: string
  abortSignal?: AbortSignal
}): Promise<string> {
  const gatewayOptions = buildGatewayStreamOptions({ apiKey, modelId })
  const { text } = await generateText({
    ...gatewayOptions,
    system:
      'Write a very short conversation title for a narrow sidebar list. Use at most 6 words and stay under 45 characters. Return only the title with no quotes or trailing punctuation.',
    prompt: userPrompt.trim(),
    abortSignal,
    maxOutputTokens: 24,
  })

  const generated = text.replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim()
  if (!generated) {
    return fallbackConversationTitle({ userPrompt })
  }

  return truncateConversationTitle({ title: generated })
}
