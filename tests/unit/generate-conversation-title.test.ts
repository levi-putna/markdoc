import { describe, expect, it } from 'vitest'
import {
  fallbackConversationTitle,
  truncateConversationTitle,
} from '../../src/main/ai/generate-conversation-title'

describe('generate-conversation-title', () => {
  it('truncates long titles for the history list', () => {
    const title = truncateConversationTitle({
      title: 'Summarise the quarterly planning document for the product team',
    })

    expect(title.length).toBeLessThanOrEqual(48)
    expect(title.endsWith('…')).toBe(true)
  })

  it('builds a fallback title from the user prompt', () => {
    expect(
      fallbackConversationTitle({
        userPrompt: 'Help me rewrite the introduction paragraph',
      })
    ).toBe('Help me rewrite the introduction paragraph')
  })
})
