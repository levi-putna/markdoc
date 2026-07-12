import { describe, it, expect } from 'vitest'
import { parseMarkdownAsync } from '@shared/markdown-async'

describe('parseMarkdownAsync', () => {
  it('parses markdown and returns index metadata', async () => {
    const result = await parseMarkdownAsync({
      markdown: '# Hello\n\nWorld',
    })
    expect(result.wordCount).toBeGreaterThan(0)
    expect(result.html).toContain('Hello')
    expect(result.outline).toHaveLength(1)
  })
})
