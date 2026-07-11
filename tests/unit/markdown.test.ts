import { describe, it, expect } from 'vitest'
import { parseMarkdownFile, serializeMarkdownFile, getAssetFolderPath, getStyleSidecarPath } from '@shared/file-utils'
import { buildOutlineFromDoc, flattenOutline, countWords } from '@shared/document-index'
import { getDocumentSizeTier, getDebounceMs } from '@shared/types'
import { markdownRoundTrip, loadMarkdownIntoEditor, getMarkdownFromEditor } from '@shared/markdown'
import { readFileSync } from 'fs'
import { join } from 'path'

const fixturesDir = join(__dirname, '../fixtures')

describe('file-utils', () => {
  it('parses and serialises front matter', () => {
    const content = readFileSync(join(fixturesDir, 'with-frontmatter.md'), 'utf-8')
    const { frontMatter, body } = parseMarkdownFile(content)
    expect(frontMatter.title).toBe('Front Matter Test')
    expect(body).toContain('# Document With Front Matter')
    const roundTripped = serializeMarkdownFile({ frontMatter, body })
    expect(roundTripped).toContain('title: Front Matter Test')
  })

  it('returns asset folder path', () => {
    expect(getAssetFolderPath('/path/to/notes.md')).toBe('/path/to/notes.assets')
  })

  it('returns style sidecar path', () => {
    expect(getStyleSidecarPath('/path/to/notes.md')).toBe('/path/to/notes.markdoc-style.json')
  })
})

describe('document-index', () => {
  it('counts words correctly', () => {
    expect(countWords('hello world')).toBe(2)
    expect(countWords('')).toBe(0)
  })

  it('determines document size tier', () => {
    expect(getDocumentSizeTier({ wordCount: 1000, byteSize: 5000 })).toBe('standard')
    expect(getDocumentSizeTier({ wordCount: 50000, byteSize: 5_000_000 })).toBe('large')
    expect(getDocumentSizeTier({ wordCount: 150000, byteSize: 25_000_000 })).toBe('very-large')
  })

  it('returns tier-appropriate debounce', () => {
    expect(getDebounceMs('standard')).toBe(200)
    expect(getDebounceMs('large')).toBe(750)
    expect(getDebounceMs('very-large')).toBe(1000)
  })
})

describe('markdown round-trip (TC-MD)', () => {
  it('round-trips headings', () => {
    const input = '# Heading 1\n\n## Heading 2\n\nParagraph text.'
    const output = markdownRoundTrip(input)
    expect(output).toContain('# Heading 1')
    expect(output).toContain('## Heading 2')
    expect(output).toContain('Paragraph text.')
  })

  it('round-trips bold and italic', () => {
    const input = '**bold** and *italic* text'
    const output = markdownRoundTrip(input)
    expect(output).toContain('**bold**')
    expect(output).toContain('*italic*')
  })

  it('round-trips unordered lists', () => {
    const input = '- Item 1\n- Item 2\n  - Nested'
    const output = markdownRoundTrip(input)
    expect(output).toContain('- Item 1')
    expect(output).toContain('- Item 2')
  })

  it('round-trips blockquotes', () => {
    const input = '> Quote text'
    const output = markdownRoundTrip(input)
    expect(output).toContain('> Quote text')
  })

  it('round-trips code blocks', () => {
    const input = '```javascript\nconst x = 1\n```'
    const output = markdownRoundTrip(input)
    expect(output).toContain('```')
    expect(output).toContain('const x = 1')
  })

  it('builds outline from headings', () => {
    const editor = loadMarkdownIntoEditor(readFileSync(join(fixturesDir, 'headings-only.md'), 'utf-8'))
    const outline = buildOutlineFromDoc(editor.state.doc)
    editor.destroy()
    expect(outline.length).toBe(2)
    expect(outline[0].text).toBe('Chapter One')
    expect(outline[0].children.length).toBeGreaterThan(0)
  })

  it('flattens outline tree', () => {
    const editor = loadMarkdownIntoEditor(readFileSync(join(fixturesDir, 'headings-only.md'), 'utf-8'))
    const outline = buildOutlineFromDoc(editor.state.doc)
    const flat = flattenOutline(outline)
    editor.destroy()
    expect(flat.length).toBeGreaterThan(2)
    expect(flat[0].level).toBe(1)
  })
})

describe('TC-EDIT.1 input rules', () => {
  it('converts heading shorthand on save', () => {
    const editor = loadMarkdownIntoEditor('# Heading\n\nBody text.')
    const md = getMarkdownFromEditor(editor)
    editor.destroy()
    expect(md).toMatch(/^# Heading/m)
  })
})
