import { describe, it, expect } from 'vitest'
import { exportToDocx, wrapStandaloneHtml } from '@shared/export'
import { loadStyleOverrides, saveStyleOverrides } from '@shared/style-engine'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'

describe('TC-EXPORT export utilities', () => {
  it('TC-EXPORT.2 exports DOCX with headings, lists, and tables from the document AST', async () => {
    const { buffer, warnings } = await exportToDocx({
      title: 'Test',
      doc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter 1' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Body text here, with ' },
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: '.' },
            ],
          },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] }] },
            ],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
                ],
              },
            ],
          },
        ],
      },
    })
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer[0]).toBe(0x50) // PK zip header 'P'
    expect(warnings).toEqual([])
  })

  it('TC-EXPORT.5/6 warns on unresolvable images instead of failing the export', async () => {
    const { buffer, warnings } = await exportToDocx({
      title: 'Test',
      doc: {
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'https://example.com/missing.png', alt: 'diagram' } }],
      },
    })
    expect(buffer.length).toBeGreaterThan(0)
    expect(warnings).toEqual(['Image "diagram" could not be embedded and was skipped.'])
  })

  it('TC-EXPORT.7 wraps standalone HTML with the live preview CSS embedded', () => {
    const html = wrapStandaloneHtml({
      bodyHtml: '<h1>Title</h1><p>Content</p>',
      title: 'Test Doc',
      css: 'html, body { height: 100%; overflow: hidden; } .preview-content { color: #333; }',
    })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('.preview-content { color: #333; }')
    expect(html).toContain('class="preview-content prose"')
    // Layout reset must come after collected CSS so PDF export isn't clipped
    expect(html).toContain('overflow: visible !important')
    expect(html.indexOf('overflow: visible !important')).toBeGreaterThan(
      html.indexOf('overflow: hidden')
    )
  })
})

describe('TC-STYLE style overrides', () => {
  const sidecarPath = join(__dirname, '../fixtures/test-style.markdoc-style.json')

  it('TC-STYLE.2 persists and loads style overrides', () => {
    saveStyleOverrides(sidecarPath, {
      bodyColor: '#ff0000',
      bodyFontSize: '18px',
      headingColors: { h1: '#0000ff' },
    })
    const overrides = loadStyleOverrides(sidecarPath)
    expect(overrides['--content-text']).toBe('#ff0000')
    expect(overrides['--editor-font-size']).toBe('18px')
    expect(overrides['--content-heading-1']).toBe('#0000ff')
    if (existsSync(sidecarPath)) unlinkSync(sidecarPath)
  })

  it('TC-STYLE.4 returns empty overrides when no sidecar exists', () => {
    const overrides = loadStyleOverrides('/nonexistent/path.markdoc-style.json')
    expect(overrides).toEqual({})
  })
})

describe('TC-PERF document tiers', () => {
  it('TC-PERF.2 large tier threshold detection', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const { countWords } = await import('@shared/document-index')
    const { getDocumentSizeTier } = await import('@shared/types')

    const perfLarge = join(__dirname, '../fixtures/perf-large.md')
    if (!existsSync(perfLarge)) {
      // Generate if missing
      const { execSync } = await import('child_process')
      execSync('npx tsx tests/fixtures/generate-large-docs.ts', { cwd: join(__dirname, '../..') })
    }

    const content = readFileSync(perfLarge, 'utf-8')
    const words = countWords(content)
    const tier = getDocumentSizeTier({ wordCount: words, byteSize: Buffer.byteLength(content) })
    expect(tier).toBe('large')
  })
})
