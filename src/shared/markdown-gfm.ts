import type { Editor } from '@tiptap/core'

/**
 * Pre-processes GFM footnotes, definition lists, and Markdoc heading mentions
 * into HTML blocks Tiptap can parse while preserving round-trip fidelity on save.
 *
 * Heading ids use Pandoc-style `{#id}` suffixes on ATX headings. Those ids are
 * extracted separately (see `extractHeadingIdsFromMarkdown`) and applied after
 * parse so inline markdown inside headings stays intact.
 */
export function preprocessGfmExtensions(markdown: string): string {
  const lines = markdown.split('\n')
  const output: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    // Footnote definition: [^label]: text
    const footnoteDef = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/)
    if (footnoteDef) {
      const [, label, text] = footnoteDef
      output.push(
        `<div data-footnote-def data-label="${label}"><p>${escapeHtml(text)}</p></div>`
      )
      index += 1
      continue
    }

    // Definition list: term line followed by `: definition`
    if (
      index + 1 < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith('#') &&
      /^:\s+/.test(lines[index + 1])
    ) {
      const term = lines[index].trim()
      const definition = lines[index + 1].replace(/^:\s+/, '')
      output.push(
        `<dl class="definition-list"><div data-definition-item><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(definition)}</dd></div></dl>`
      )
      index += 2
      continue
    }

    let processed = line

    // Strip Pandoc-style heading ids — they are applied after parse.
    if (/^#{1,6}\s+/.test(processed) && /\{#[A-Za-z0-9_-]+\}\s*$/.test(processed)) {
      processed = processed.replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, '')
    }

    // Heading mentions: [@Label](heading://id) → HTML anchor for the mention node
    if (processed.includes('](heading://')) {
      processed = processed.replace(
        /\[@([^\]]*)\]\(heading:\/\/([^)\s]+)\)/g,
        (_match, label: string, headingId: string) => {
          const safeLabel = escapeHtml(label)
          const safeId = escapeHtml(headingId)
          return `<a data-heading-mention data-heading-id="${safeId}" href="heading://${safeId}" class="heading-mention">@${safeLabel}</a>`
        }
      )
    }

    // Inline footnote references [^label]
    if (processed.includes('[^')) {
      processed = processed.replace(
        /\[\^([^\]]+)\]/g,
        '<sup data-footnote-ref data-label="$1" class="footnote-ref">[^$1]</sup>'
      )
    }

    output.push(processed)
    index += 1
  }

  return output.join('\n')
}

/**
 * Extracts ordered heading ids from ATX lines using Pandoc-style `{#id}` suffixes.
 * Entries are `null` when a heading has no explicit id.
 */
export function extractHeadingIdsFromMarkdown({ markdown }: { markdown: string }): Array<string | null> {
  const ids: Array<string | null> = []

  for (const line of markdown.split('\n')) {
    if (!/^#{1,6}\s+/.test(line)) continue
    const match = line.match(/\{#([A-Za-z0-9_-]+)\}\s*$/)
    ids.push(match ? match[1] : null)
  }

  return ids
}

/**
 * Applies extracted heading ids onto heading nodes in document order.
 * Existing attrs that already match are left alone; missing ones are set.
 */
export function applyHeadingIdsToEditor({
  editor,
  headingIds,
}: {
  editor: Editor
  headingIds: Array<string | null>
}): void {
  if (headingIds.length === 0) return

  let index = 0
  let transaction = editor.state.tr
  let changed = false

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const nextId = headingIds[index] ?? null
    index += 1
    if (!nextId || node.attrs.headingId === nextId) return
    transaction = transaction.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      headingId: nextId,
    })
    changed = true
  })

  if (changed) {
    editor.view.dispatch(transaction)
  }
}

/**
 * Post-processes editor HTML back to GFM footnotes, definition lists,
 * and Markdoc heading-mention link syntax.
 */
export function postprocessGfmExtensions(markdown: string): string {
  let result = markdown

  result = result.replace(
    /<div data-footnote-def data-label="([^"]+)"><p>([\s\S]*?)<\/p><\/div>/g,
    '[^$1]: $2'
  )

  result = result.replace(
    /<sup[^>]*data-footnote-ref[^>]*data-label="([^"]+)"[^>]*>\[\^[^\]]+\]<\/sup>/g,
    '[^$1]'
  )

  result = result.replace(
    /<dl class="definition-list"><div data-definition-item><dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd><\/div><\/dl>/g,
    '$1\n: $2'
  )

  // Heading mentions that serialised as HTML rather than markdown links
  result = result.replace(
    /<a\b[^>]*data-heading-mention\b[^>]*data-heading-id="([^"]+)"[^>]*>@?([^<]*)<\/a>/gi,
    (_match, headingId: string, label: string) => {
      const cleanLabel = label.replace(/^@/, '').trim() || 'Heading'
      return `[@${cleanLabel}](heading://${headingId})`
    }
  )

  // Fallback: plain heading:// anchors that lack data-heading-mention
  result = result.replace(
    /<a\b(?![^>]*data-heading-mention)[^>]*href="heading:\/\/([^"]+)"[^>]*>@?([^<]*)<\/a>/gi,
    (_match, headingId: string, label: string) => {
      const cleanLabel = label.replace(/^@/, '').trim() || 'Heading'
      return `[@${cleanLabel}](heading://${headingId})`
    }
  )

  // Heading HTML with data-heading-id → ATX + {#id} (fallback path)
  result = result.replace(
    /<h([1-6])\b[^>]*data-heading-id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_match, level: string, headingId: string, inner: string) => {
      const text = inner
        .replace(/<\/?strong>/gi, '**')
        .replace(/<\/?b>/gi, '**')
        .replace(/<\/?em>/gi, '*')
        .replace(/<\/?i>/gi, '*')
        .replace(/<\/?code>/gi, '`')
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\n+/g, ' ')
        .trim()
      return `${'#'.repeat(Number(level))} ${text} {#${headingId}}`
    }
  )

  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
