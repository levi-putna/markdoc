/**
 * Pre-processes GFM footnotes and definition lists into HTML blocks
 * Tiptap can parse while preserving round-trip fidelity on save.
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

    // Inline footnote references [^label]
    if (line.includes('[^')) {
      output.push(
        line.replace(
          /\[\^([^\]]+)\]/g,
          '<sup data-footnote-ref data-label="$1" class="footnote-ref">[^$1]</sup>'
        )
      )
      index += 1
      continue
    }

    output.push(line)
    index += 1
  }

  return output.join('\n')
}

/**
 * Post-processes editor HTML back to GFM footnotes and definition lists.
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

  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
