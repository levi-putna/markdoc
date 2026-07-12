import { describe, it, expect } from 'vitest'
import { preprocessGfmExtensions, postprocessGfmExtensions } from '@shared/markdown-gfm'
import { markdownRoundTrip } from '@shared/markdown'

describe('GFM extensions', () => {
  it('round-trips footnote references and definitions', () => {
    const source = 'Text with footnote[^1].\n\n[^1]: Footnote body.'
    const processed = preprocessGfmExtensions(source)
    expect(processed).toContain('data-footnote-ref')
    const roundTripped = postprocessGfmExtensions(processed)
    expect(roundTripped).toContain('[^1]')
    expect(roundTripped).toContain('[^1]: Footnote body.')
  })

  it('round-trips definition lists', () => {
    const source = 'Term\n: Definition line'
    const processed = preprocessGfmExtensions(source)
    expect(processed).toContain('definition-list')
    const restored = postprocessGfmExtensions(processed)
    expect(restored).toContain('Term')
    expect(restored).toContain(': Definition line')
  })

  it('preserves footnotes through full markdown round-trip', () => {
    const source = 'Hello[^note].\n\n[^note]: World.'
    const result = markdownRoundTrip(source)
    expect(result).toContain('[^note]')
  })
})
