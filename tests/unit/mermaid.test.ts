import { describe, it, expect, vi } from 'vitest'
import * as mermaidUtils from '@renderer/utils/mermaid'
import { prepareDocJsonForExport } from '@renderer/utils/mermaid-export'

const {
  isMermaidLanguage,
  renderMermaidDiagram,
  renderMermaidBlocksInHtml,
} = mermaidUtils

describe('TC-DIAG Mermaid rendering', () => {
  it('TC-DIAG.1 recognises the mermaid language tag', () => {
    expect(isMermaidLanguage({ language: 'mermaid' })).toBe(true)
    expect(isMermaidLanguage({ language: 'Mermaid' })).toBe(true)
    expect(isMermaidLanguage({ language: 'javascript' })).toBe(false)
  })

  it('TC-DIAG.1 renders a valid flowchart to SVG', async () => {
    const { svg, error } = await renderMermaidDiagram({
      source: 'graph TD\n    A[Start] --> B[End]',
    })

    expect(error).toBeNull()
    expect(svg).toContain('<svg')
  })

  it('TC-DIAG.2 surfaces malformed Mermaid syntax as an inline error', async () => {
    const { svg, error } = await renderMermaidDiagram({
      source: 'graph TD\n    A -->',
    })

    expect(svg).toBeNull()
    expect(error).toBeTruthy()
  })

  it('TC-DIAG.4 inlines rendered SVG into export HTML', async () => {
    const { html, warnings } = await renderMermaidBlocksInHtml({
      html: '<pre><code class="language-mermaid">graph TD\nA-->B</code></pre>',
    })

    expect(warnings).toEqual([])
    expect(html).toContain('<svg')
    expect(html).not.toContain('language-mermaid')
  })

  it('TC-EXPORT.4 converts Mermaid code blocks to image nodes for DOCX export', async () => {
    vi.spyOn(mermaidUtils, 'svgToPngDataUrl').mockResolvedValue('data:image/png;base64,ZmFrZQ==')

    const { doc, warnings } = await prepareDocJsonForExport({
      doc: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'mermaid' },
            content: [{ type: 'text', text: 'graph TD\nA-->B' }],
          },
        ],
      },
    })

    expect(warnings).toEqual([])
    expect(doc.content?.[0]?.type).toBe('image')
    expect(String(doc.content?.[0]?.attrs?.src ?? '')).toMatch(/^data:image\/png;base64,/)
  })
})
