import type { JSONContent } from '@tiptap/core'
import { isMermaidLanguage, renderMermaidDiagram, svgToPngDataUrl } from './mermaid'

/**
 * Replaces Mermaid `codeBlock` nodes in the document JSON with centred
 * `image` nodes carrying PNG data URLs so DOCX export can embed them
 * without running Mermaid in the main process (TR-9.5).
 */
export async function prepareDocJsonForExport({
  doc,
  isDark = false,
}: {
  doc: JSONContent
  isDark?: boolean
}): Promise<{ doc: JSONContent; warnings: string[] }> {
  const warnings: string[] = []
  const content = await Promise.all(
    (doc.content ?? []).map(async (node) => transformNodeForExport({ node, isDark, warnings }))
  )

  return {
    doc: { ...doc, content: content.flat() },
    warnings,
  }
}

async function transformNodeForExport({
  node,
  isDark,
  warnings,
}: {
  node: JSONContent
  isDark: boolean
  warnings: string[]
}): Promise<JSONContent[]> {
  if (node.type === 'codeBlock' && isMermaidLanguage({ language: String(node.attrs?.language ?? '') })) {
    return convertMermaidCodeBlockToImage({ node, isDark, warnings })
  }

  if (!node.content?.length) return [node]

  const nested = await Promise.all(
    node.content.map(async (child) => transformNodeForExport({ node: child, isDark, warnings }))
  )

  return [{ ...node, content: nested.flat() }]
}

async function convertMermaidCodeBlockToImage({
  node,
  isDark,
  warnings,
}: {
  node: JSONContent
  isDark: boolean
  warnings: string[]
}): Promise<JSONContent[]> {
  const source = (node.content ?? []).map((child) => child.text ?? '').join('')
  const { svg, error } = await renderMermaidDiagram({ source, isDark })

  if (!svg) {
    warnings.push(error ?? 'A Mermaid diagram failed to render for export.')
    return [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `[Diagram error: ${error ?? 'Failed to render diagram'}]`,
            marks: [{ type: 'italic' }],
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'mermaid' },
        content: [{ type: 'text', text: source }],
      },
    ]
  }

  const pngDataUrl = await svgToPngDataUrl({ svg })
  if (!pngDataUrl) {
    warnings.push('A Mermaid diagram could not be rasterised for Word export.')
    return [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '[Diagram could not be rasterised for export]', marks: [{ type: 'italic' }] }],
      },
    ]
  }

  return [
    {
      type: 'image',
      attrs: {
        src: pngDataUrl,
        alt: 'Mermaid diagram',
        title: 'Mermaid diagram',
      },
    },
  ]
}
