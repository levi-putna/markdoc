import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

interface DocxNode {
  type: string
  text?: string
  level?: number
  children?: DocxNode[]
}

/**
 * Converts a simplified document AST to a DOCX file buffer.
 */
export async function exportToDocx({
  nodes,
}: {
  title: string
  nodes: DocxNode[]
}): Promise<Buffer> {
  const children = nodes.map((node) => nodeToDocxParagraph(node))

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}

function nodeToDocxParagraph(node: DocxNode): Paragraph {
  if (node.type === 'heading') {
    const levels = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ]
    return new Paragraph({
      text: node.text ?? '',
      heading: levels[(node.level ?? 1) - 1] ?? HeadingLevel.HEADING_1,
    })
  }

  return new Paragraph({
    children: [new TextRun(node.text ?? '')],
  })
}

/**
 * Wraps preview HTML as a standalone exportable HTML document.
 */
export function wrapStandaloneHtml({
  bodyHtml,
  title,
  styleOverrides = {},
}: {
  bodyHtml: string
  title: string
  styleOverrides?: Record<string, string>
}): string {
  const overrideCss = Object.entries(styleOverrides)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 48px 24px; line-height: 1.6; }
    ${overrideCss}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
