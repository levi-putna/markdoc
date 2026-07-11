import { describe, it, expect } from 'vitest'
import { highlightMarkdownSource, findHeadingCharOffset } from '@shared/markdown-highlight'

describe('markdown-highlight', () => {
  it('keeps heading # markers visible with level styling', () => {
    const html = highlightMarkdownSource('# Chapter One\n\n## Section')
    expect(html).toContain('md-heading-line--h1')
    expect(html).toContain('md-syntax-marker')
    expect(html).toContain('#')
    expect(html).toContain('md-heading-line--h2')
  })

  it('shows bold markers without changing text metrics', () => {
    const html = highlightMarkdownSource('This is **important** text.')
    expect(html).toContain('md-syntax-marker')
    expect(html).toContain('**')
    expect(html).toContain('md-syntax-content')
    expect(html).toContain('important')
    expect(html).not.toContain('<strong')
  })

  it('finds heading character offset in raw markdown', () => {
    const markdown = '# Chapter One\n\nBody text.'
    const offset = findHeadingCharOffset({
      markdown,
      headingText: 'Chapter One',
      level: 1,
    })
    expect(offset).toBe(0)
  })
})
