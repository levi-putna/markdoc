import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from './tiptap-extensions'
import {
  preprocessGfmExtensions,
  postprocessGfmExtensions,
  extractHeadingIdsFromMarkdown,
  applyHeadingIdsToEditor,
} from './markdown-gfm'

/**
 * Creates a headless Tiptap editor instance for Markdown round-trip conversion.
 */
export function createMarkdownEditor(): Editor {
  return new Editor({
    extensions: createTiptapExtensions(),
    content: '',
  })
}

/**
 * Loads markdown into an editor, restoring any Pandoc-style heading ids.
 */
function setMarkdownContent({ editor, markdown }: { editor: Editor; markdown: string }): void {
  const headingIds = extractHeadingIdsFromMarkdown({ markdown })
  editor.commands.setContent(preprocessGfmExtensions(markdown))
  applyHeadingIdsToEditor({ editor, headingIds })
}

/**
 * Converts Markdown text to a Tiptap document and back, returning serialised Markdown.
 */
export function markdownRoundTrip(markdown: string): string {
  const editor = createMarkdownEditor()
  setMarkdownContent({ editor, markdown })
  const result = postprocessGfmExtensions(editor.storage.markdown.getMarkdown())
  editor.destroy()
  return result
}

/**
 * Loads Markdown into an editor and returns the editor instance.
 */
export function loadMarkdownIntoEditor(markdown: string): Editor {
  const editor = createMarkdownEditor()
  setMarkdownContent({ editor, markdown })
  return editor
}

/**
 * Serialises the current editor content to Markdown.
 */
export function getMarkdownFromEditor(editor: Editor): string {
  return postprocessGfmExtensions(editor.storage.markdown.getMarkdown())
}
