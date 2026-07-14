/**
 * Rewrites editor HTML for standalone HTML/PDF export so heading mentions
 * become regular fragment links and headings expose matching `id` anchors.
 */
export function prepareHtmlForExport({ html }: { html: string }): string {
  let result = html

  // Promote data-heading-id on headings to real HTML id attributes for anchors.
  result = result.replace(
    /<(h[1-6])([^>]*?)data-heading-id="([^"]+)"([^>]*)>/gi,
    (_match, tag: string, before: string, headingId: string, after: string) => {
      const rest = `${before}${after}`
      if (/\sid="/i.test(rest)) {
        return `<${tag}${before}data-heading-id="${headingId}"${after}>`
      }
      return `<${tag}${before}id="${headingId}" data-heading-id="${headingId}"${after}>`
    }
  )

  // Rewrite mention links from heading://id → #id for exported documents.
  result = result.replace(
    /<a\b([^>]*?)href="heading:\/\/([^"]+)"([^>]*)>/gi,
    (_match, before: string, headingId: string, after: string) => {
      return `<a${before}href="#${headingId}"${after}>`
    }
  )

  return result
}

/**
 * Builds a Word-safe bookmark id from a headingId.
 */
export function bookmarkIdForHeading({ headingId }: { headingId: string }): string {
  const safe = headingId.replace(/[^A-Za-z0-9_-]/g, '_')
  return `md_${safe}`
}
