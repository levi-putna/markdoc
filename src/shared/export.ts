import { existsSync, readFileSync } from 'fs'
import { isAbsolute, resolve } from 'path'
import { imageSize } from 'image-size'
import type { JSONContent } from '@tiptap/core'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalMergeType,
  WidthType,
  convertInchesToTwip,
  type ParagraphChild,
} from 'docx'

/** Reference name for the single ordered-list numbering definition every export document shares. */
const ORDERED_LIST_NUMBERING = 'markdoc-ordered-list'

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
]

const CODE_SHADING = { type: ShadingType.CLEAR, fill: 'F4F4F5' }
const INLINE_CODE_SHADING = { type: ShadingType.CLEAR, fill: 'EEEEEE' }
const HEADER_ROW_SHADING = { type: ShadingType.CLEAR, fill: 'F0F0F0' }
const BLOCKQUOTE_BORDER = { style: BorderStyle.SINGLE, size: 12, color: 'AAAAAA', space: 8 }

const DOCX_IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp'])
const MAX_IMAGE_WIDTH_PX = 600

type DocxBlock = Paragraph | Table

/** Threaded through every conversion call so warnings/asset resolution stay centralised. */
interface ConvertContext {
  documentDir: string | null
  warnings: string[]
}

/** Per-block formatting inherited by nested content (e.g. blockquote indent/border). */
interface BlockOptions {
  quote?: boolean
  listLevel?: number
}

/**
 * Converts the live Tiptap/ProseMirror document JSON into a DOCX file buffer,
 * building native docx.js constructs (`Paragraph`, `Table`, `ImageRun`, etc.)
 * directly from the AST — per TR-10.2 — rather than a naive HTML-to-DOCX
 * conversion, so heading levels, list nesting, and table structure survive
 * with high fidelity. Any content that can't be embedded (unresolvable
 * images, unsupported node types) degrades to a clear placeholder plus an
 * entry in the returned `warnings`, rather than failing the whole export.
 */
export async function exportToDocx({
  doc,
  title,
  documentDir = null,
}: {
  doc: JSONContent
  title: string
  documentDir?: string | null
}): Promise<{ buffer: Buffer; warnings: string[] }> {
  const context: ConvertContext = { documentDir, warnings: [] }
  const children = convertBlocks({ nodes: doc.content ?? [], context })

  const document = new Document({
    title,
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_NUMBERING,
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.START },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [{ children: children.length > 0 ? children : [new Paragraph({})] }],
  })

  const buffer = await Packer.toBuffer(document)
  return { buffer, warnings: context.warnings }
}

/**
 * Converts a list of block-level ProseMirror nodes to their docx.js
 * equivalents, preserving document order.
 */
function convertBlocks({
  nodes,
  context,
  options = {},
}: {
  nodes: JSONContent[]
  context: ConvertContext
  options?: BlockOptions
}): DocxBlock[] {
  return nodes.flatMap((node) => convertBlock({ node, context, options }))
}

function convertBlock({
  node,
  context,
  options = {},
}: {
  node: JSONContent
  context: ConvertContext
  options?: BlockOptions
}): DocxBlock[] {
  switch (node.type) {
    case 'paragraph':
      return [buildParagraph({ node, options })]
    case 'heading':
      return [buildHeading({ node })]
    case 'bulletList':
      return convertList({ node, context, ordered: false, level: options.listLevel ?? 0 })
    case 'orderedList':
      return convertList({ node, context, ordered: true, level: options.listLevel ?? 0 })
    case 'taskList':
      return convertTaskList({ node, context, level: options.listLevel ?? 0 })
    case 'blockquote':
      return convertBlocks({
        nodes: node.content ?? [],
        context,
        options: { ...options, quote: true },
      })
    case 'codeBlock':
      return convertCodeBlock({ node, context })
    case 'horizontalRule':
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        }),
      ]
    case 'table':
      return [convertTable({ node, context })]
    case 'image':
      return convertImage({ node, context })
    default:
      // Anything the editor produces that we don't yet have a dedicated
      // converter for degrades to plain text of its inline content instead
      // of silently dropping it (FR-11.6).
      if (node.content) {
        context.warnings.push(`Unsupported block type "${node.type}" was exported as plain text.`)
        return [buildParagraph({ node, options })]
      }
      return []
  }
}

/** Builds a body paragraph, applying blockquote indent/border when nested inside one. */
function buildParagraph({
  node,
  options = {},
}: {
  node: JSONContent
  options?: BlockOptions
}): Paragraph {
  const runs = convertInline({ nodes: node.content ?? [] })
  return new Paragraph({
    children: runs.length > 0 ? runs : [],
    indent: options.quote ? { left: convertInchesToTwip(0.4) } : undefined,
    border: options.quote ? { left: BLOCKQUOTE_BORDER } : undefined,
  })
}

function buildHeading({ node }: { node: JSONContent }): Paragraph {
  const level: number = node.attrs?.level ?? 1
  const runs = convertInline({ nodes: node.content ?? [] })
  return new Paragraph({
    heading: HEADING_LEVELS[level - 1] ?? HeadingLevel.HEADING_1,
    children: runs,
  })
}

/**
 * Converts inline content (text runs with marks, hard breaks, links) into
 * docx paragraph children.
 */
function convertInline({ nodes }: { nodes: JSONContent[] }): ParagraphChild[] {
  const runs: ParagraphChild[] = []

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      runs.push(buildLineBreak())
      continue
    }
    if (node.type !== 'text' || !node.text) continue

    const marks = node.marks ?? []
    const link = marks.find((mark) => mark.type === 'link')
    const run = buildTextRun({ text: node.text, marks, isLink: Boolean(link) })

    if (link?.attrs?.href) {
      runs.push(new ExternalHyperlink({ children: [run], link: String(link.attrs.href) }))
    } else {
      runs.push(run)
    }
  }

  return runs
}

function buildTextRun({
  text,
  marks,
  isLink,
}: {
  text: string
  marks: { type: string; attrs?: Record<string, unknown> }[]
  isLink: boolean
}): TextRun {
  const has = (type: string) => marks.some((mark) => mark.type === type)
  const isCode = has('code')

  return new TextRun({
    text,
    bold: has('bold') || undefined,
    italics: has('italic') || undefined,
    strike: has('strike') || undefined,
    underline: has('underline') || isLink ? {} : undefined,
    color: isLink ? '2563EB' : undefined,
    font: isCode ? 'Courier New' : undefined,
    shading: isCode ? INLINE_CODE_SHADING : undefined,
  })
}

/** A soft line break within a paragraph, matching Tiptap's `hardBreak` node. */
function buildLineBreak(): TextRun {
  return new TextRun({ text: '', break: 1 })
}

/**
 * Converts a bullet/ordered list, recursing into nested lists and task
 * lists at an incremented indent level. Only the first content child of
 * each list item receives the bullet/number marker, matching how Word
 * itself structures multi-paragraph list items.
 */
function convertList({
  node,
  context,
  ordered,
  level,
}: {
  node: JSONContent
  context: ConvertContext
  ordered: boolean
  level: number
}): DocxBlock[] {
  const out: DocxBlock[] = []

  for (const item of node.content ?? []) {
    const itemChildren = item.content ?? []

    itemChildren.forEach((child, index) => {
      if (child.type === 'bulletList') {
        out.push(...convertList({ node: child, context, ordered: false, level: level + 1 }))
        return
      }
      if (child.type === 'orderedList') {
        out.push(...convertList({ node: child, context, ordered: true, level: level + 1 }))
        return
      }
      if (child.type === 'taskList') {
        out.push(...convertTaskList({ node: child, context, level: level + 1 }))
        return
      }

      if (index === 0 && (child.type === 'paragraph' || child.type === 'heading')) {
        const runs = convertInline({ nodes: child.content ?? [] })
        out.push(
          new Paragraph({
            children: runs,
            bullet: !ordered ? { level } : undefined,
            numbering: ordered ? { reference: ORDERED_LIST_NUMBERING, level } : undefined,
          })
        )
        return
      }

      // A second paragraph (or other block) within the same "loose" list
      // item — rendered without a marker, indented to align under it.
      out.push(
        ...convertBlock({ node: child, context, options: { listLevel: level } }).map((block) =>
          block instanceof Paragraph
            ? new Paragraph({ indent: { left: convertInchesToTwip(0.5 * (level + 1)) } })
            : block
        )
      )
    })
  }

  return out
}

/** Task list items render as a checkbox glyph prefix, since one-way export doesn't need interactivity. */
function convertTaskList({
  node,
  context,
  level,
}: {
  node: JSONContent
  context: ConvertContext
  level: number
}): DocxBlock[] {
  const out: DocxBlock[] = []

  for (const item of node.content ?? []) {
    const checked = Boolean(item.attrs?.checked)
    const itemChildren = item.content ?? []

    itemChildren.forEach((child, index) => {
      if (child.type === 'taskList') {
        out.push(...convertTaskList({ node: child, context, level: level + 1 }))
        return
      }

      const runs = convertInline({ nodes: child.content ?? [] })
      const prefix = index === 0 ? `${checked ? '☑' : '☐'}  ` : ''
      out.push(
        new Paragraph({
          children: prefix ? [new TextRun({ text: prefix }), ...runs] : runs,
          indent: { left: convertInchesToTwip(0.3 + level * 0.5) },
        })
      )
    })
  }

  return out
}

/**
 * Converts a fenced code block to one monospaced, lightly-shaded paragraph
 * per source line (docx has no native multi-line-paragraph text).
 */
function convertCodeBlock({ node }: { node: JSONContent; context: ConvertContext }): Paragraph[] {
  const text = (node.content ?? []).map((child) => child.text ?? '').join('')
  const lines = text.length > 0 ? text.split('\n') : ['']
  const out: Paragraph[] = []

  for (const line of lines) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: line.length > 0 ? line : ' ', font: 'Courier New', size: 20 })],
        shading: CODE_SHADING,
      })
    )
  }

  return out
}

/**
 * Converts a table, expanding merged cells (colspan/rowspan) into the
 * explicit per-cell grid OOXML requires — a cell with `rowspan` only
 * appears once in the source AST, but docx needs a `CONTINUE`
 * vertical-merge placeholder cell in every row it spans.
 */
function convertTable({ node, context }: { node: JSONContent; context: ConvertContext }): Table {
  const sourceRows = node.content ?? []
  const pendingSpans = new Map<number, { remaining: number; colSpan: number }>()

  const rows = sourceRows.map((row, rowIndex) => {
    const sourceCells = row.content ?? []
    const isHeaderRow = rowIndex === 0 && sourceCells.every((cell) => cell.type === 'tableHeader')
    const cells: TableCell[] = []
    let col = 0
    let sourceIndex = 0

    while (sourceIndex < sourceCells.length || pendingSpans.has(col)) {
      const pending = pendingSpans.get(col)
      if (pending) {
        cells.push(
          new TableCell({
            children: [new Paragraph({})],
            columnSpan: pending.colSpan > 1 ? pending.colSpan : undefined,
            verticalMerge: VerticalMergeType.CONTINUE,
          })
        )
        pending.remaining -= 1
        if (pending.remaining <= 0) pendingSpans.delete(col)
        col += pending.colSpan
        continue
      }

      const cellNode = sourceCells[sourceIndex]
      sourceIndex += 1
      const colSpan: number = cellNode.attrs?.colspan ?? 1
      const rowSpan: number = cellNode.attrs?.rowspan ?? 1
      const blocks = convertBlocks({ nodes: cellNode.content ?? [], context })

      cells.push(
        new TableCell({
          children: blocks.length > 0 ? blocks : [new Paragraph({})],
          columnSpan: colSpan > 1 ? colSpan : undefined,
          verticalMerge: rowSpan > 1 ? VerticalMergeType.RESTART : undefined,
          shading: isHeaderRow ? HEADER_ROW_SHADING : undefined,
        })
      )

      if (rowSpan > 1) pendingSpans.set(col, { remaining: rowSpan - 1, colSpan })
      col += colSpan
    }

    return new TableRow({ children: cells, tableHeader: isHeaderRow })
  })

  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

/**
 * Converts an image node, embedding the source file (or data URL) as a
 * native `ImageRun` scaled to a sensible page width. Falls back to a
 * placeholder paragraph plus a warning for anything that can't be resolved
 * (remote URLs, missing files, unsupported formats like SVG/WebP) rather
 * than failing the export outright (FR-11.6).
 */
function convertImage({ node, context }: { node: JSONContent; context: ConvertContext }): Paragraph[] {
  const src: string | undefined = node.attrs?.src
  const alt: string = node.attrs?.alt ?? ''
  if (!src) return []

  const resolved = resolveImageForExport({ src, context })
  if (!resolved) {
    context.warnings.push(`Image "${alt || src}" could not be embedded and was skipped.`)
    return [
      new Paragraph({
        children: [new TextRun({ text: `[Image unavailable: ${alt || src}]`, italics: true, color: '888888' })],
      }),
    ]
  }

  const { data, width, height, type } = resolved
  const scale = width > MAX_IMAGE_WIDTH_PX ? MAX_IMAGE_WIDTH_PX / width : 1

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: type as 'png' | 'jpg' | 'gif' | 'bmp',
          data,
          transformation: {
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
          },
        }),
      ],
    }),
  ]
}

/**
 * Resolves an image `src` (data URL, absolute path, or path relative to the
 * document's own folder — the asset-folder convention) to embeddable bytes
 * plus dimensions. Remote URLs are deliberately not fetched, keeping export
 * fully offline (privacy requirement in the functional spec).
 */
function resolveImageForExport({
  src,
  context,
}: {
  src: string
  context: ConvertContext
}): { data: Buffer; width: number; height: number; type: string } | null {
  try {
    let data: Buffer

    if (src.startsWith('data:')) {
      const base64 = src.split(',')[1]
      if (!base64) return null
      data = Buffer.from(base64, 'base64')
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      return null
    } else {
      const path = src.startsWith('file://') ? src.slice('file://'.length) : src
      const absolutePath = isAbsolute(path)
        ? path
        : context.documentDir
          ? resolve(context.documentDir, path)
          : null
      if (!absolutePath || !existsSync(absolutePath)) return null
      data = readFileSync(absolutePath)
    }

    const dimensions = imageSize(data)
    const type = dimensions.type === 'jpg' || dimensions.type === 'jpeg' ? 'jpg' : dimensions.type
    if (!type || !DOCX_IMAGE_TYPES.has(type)) return null

    return { data, width: dimensions.width, height: dimensions.height, type }
  } catch {
    return null
  }
}

/**
 * CSS overrides that undo app-shell layout rules (`height: 100%`,
 * `overflow: hidden` on `html`/`body`) accidentally embedded when
 * `collectPreviewCss()` copies the live renderer stylesheets. Without
 * these, PDF export only captures the first viewport of content.
 */
export function getExportLayoutResetCss(): string {
  return `
html, body {
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
  position: static !important;
  background: var(--surface-primary, #ffffff) !important;
}
.preview-content {
  max-width: 720px;
  margin: 0 auto;
  overflow: visible !important;
}
`
}

/**
 * Wraps rendered Preview HTML (plus the live app CSS driving it) as a
 * standalone, self-contained HTML document — reused for both standalone
 * HTML export (FR-11.7) and as the source loaded into the offscreen window
 * for PDF export (TR-10.1), so both share one rendering pipeline with the
 * in-app Preview pane.
 */
export function wrapStandaloneHtml({
  bodyHtml,
  title,
  css = '',
  isDark = false,
}: {
  bodyHtml: string
  title: string
  css?: string
  isDark?: boolean
}): string {
  return `<!DOCTYPE html>
<html lang="en" class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 48px 24px; }
    ${css}
    ${getExportLayoutResetCss()}
  </style>
</head>
<body>
  <div class="preview-content prose">
${bodyHtml}
  </div>
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