import { describe, it, expect } from 'vitest'
import { exportToDocx, wrapStandaloneHtml } from '@shared/export'
import { loadStyleOverrides, saveStyleOverrides } from '@shared/style-engine'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'

describe('TC-EXPORT export utilities', () => {
  it('TC-EXPORT.2 exports DOCX with headings', async () => {
    const buffer = await exportToDocx({
      title: 'Test',
      nodes: [
        { type: 'heading', text: 'Chapter 1', level: 1 },
        { type: 'paragraph', text: 'Body text here.' },
      ],
    })
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer[0]).toBe(0x50) // PK zip header 'P'
  })

  it('TC-EXPORT.7 wraps standalone HTML', () => {
    const html = wrapStandaloneHtml({
      bodyHtml: '<h1>Title</h1><p>Content</p>',
      title: 'Test Doc',
      styleOverrides: { '--content-text': '#333' },
    })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('--content-text')
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
