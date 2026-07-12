import { describe, it, expect } from 'vitest'
import { chunkedFindMatches } from '@shared/chunked-scan'

describe('chunkedFindMatches', () => {
  it('finds all case-insensitive matches without blocking', async () => {
    const text = 'alpha\nbeta alpha\ngamma'
    const matches = await chunkedFindMatches({ text, query: 'alpha', chunkSize: 1 })
    expect(matches).toHaveLength(2)
    expect(matches[0].index).toBe(0)
    expect(matches[1].index).toBe(text.indexOf('alpha', 1))
  })
})
