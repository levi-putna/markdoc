import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from './tiptap-extensions'
import { preprocessGfmExtensions, postprocessGfmExtensions } from './markdown-gfm'

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
 * Converts Markdown text to a Tiptap document and back, returning serialised Markdown.
 */
export function markdownRoundTrip(markdown: string): string {
  const editor = createMarkdownEditor()
  editor.commands.setContent(preprocessGfmExtensions(markdown))
  const result = postprocessGfmExtensions(editor.storage.markdown.getMarkdown())
  editor.destroy()
  return result
}

/**
 * Loads Markdown into an editor and returns the editor instance.
 */
export function loadMarkdownIntoEditor(markdown: string): Editor {
  const editor = createMarkdownEditor()
  editor.commands.setContent(preprocessGfmExtensions(markdown))
  return editor
}

/**
 * Serialises the current editor content to Markdown.
 */
export function getMarkdownFromEditor(editor: Editor): string {
  return postprocessGfmExtensions(editor.storage.markdown.getMarkdown())
}
