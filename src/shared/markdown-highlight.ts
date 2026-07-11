import { createLowlight } from 'lowlight'
import markdown from 'highlight.js/lib/languages/markdown'
import { toHtml } from 'hast-util-to-html'

const lowlight = createLowlight()
lowlight.register('markdown', markdown)

/**
 * Highlights Markdown source with visible syntax tokens.
 * Uses colour only so the overlay keeps the same metrics as the textarea (cursor alignment).
 */
export function highlightMarkdownSource(code: string): string {
  const tree = lowlight.highlight('markdown', code)
  let html = toHtml(tree)

  // Bold markers — visible delimiters, inner text unchanged metrics
  html = html.replace(
    /(\*\*|__)(.+?)\1/g,
    '<span class="md-syntax-marker">$1</span><span class="md-syntax-content">$2</span><span class="md-syntax-marker">$1</span>'
  )

  // Italic markers
  html = html.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_/g,
    (match, g1, g2) => {
      const inner = g1 ?? g2
      const marker = match.startsWith('*') ? '*' : '_'
      return `<span class="md-syntax-marker">${marker}</span><span class="md-syntax-content">${inner}</span><span class="md-syntax-marker">${marker}</span>`
    }
  )

  // Inline code markers
  html = html.replace(
    /`([^`]+)`/g,
    '<span class="md-syntax-marker">`</span><span class="md-syntax-code">$1</span><span class="md-syntax-marker">`</span>'
  )

  // ATX headings — show # markers, colour only (no font-size changes)
  html = html.replace(
    /<span class="hljs-section">(#+)([^<]*)<\/span>/g,
    (_match, hashes: string, rest: string) => {
      const level = Math.min(hashes.length, 6)
      return `<span class="md-heading-line md-heading-line--h${level}"><span class="md-syntax-marker">${hashes}</span><span class="md-syntax-content">${rest}</span></span>`
    }
  )

  return html
}

/**
 * Finds the character offset of a heading in raw Markdown for scroll-to behaviour.
 */
export function findHeadingCharOffset({
  markdown,
  headingText,
  level,
}: {
  markdown: string
  headingText: string
  level: number
}): number {
  const prefix = `${'#'.repeat(level)} `
  const target = `${prefix}${headingText}`
  const idx = markdown.indexOf(target)
  return idx >= 0 ? idx : 0
}
