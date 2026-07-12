import { getDocumentSizeTier } from './types'
import { loadMarkdownIntoEditor } from './markdown'
import { syncDocumentIndexFromEditor } from './outline-sync'

/**
 * Parses large Markdown off the critical UI path by yielding between chunks (TR-12.11).
 */
export async function parseMarkdownAsync({
  markdown,
}: {
  markdown: string
}): Promise<ReturnType<typeof syncDocumentIndexFromEditor> & { html: string }> {
  const tier = getDocumentSizeTier({
    wordCount: markdown.trim() ? markdown.trim().split(/\s+/).length : 0,
    byteSize: new Blob([markdown]).size,
  })

  if (tier === 'very-large') {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }

  const editor = loadMarkdownIntoEditor(markdown)
  const index = syncDocumentIndexFromEditor({ editor })
  const html = editor.getHTML()
  editor.destroy()
  return { ...index, html }
}
