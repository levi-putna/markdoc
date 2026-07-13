import { flattenOutline } from '@shared/document-index'
import type { DocumentSnapshot } from '@shared/ai/types'
import type { Editor } from '@tiptap/react'
import type { OutlineNode } from '@shared/types'

/**
 * Builds a document snapshot for AI tools from the live editor and store state.
 */
export function buildDocumentSnapshot({
  editor,
  filePath,
  markdown,
  outline,
}: {
  editor: Editor | null
  filePath: string | null
  markdown: string
  outline: OutlineNode[]
}): DocumentSnapshot {
  const flat = flattenOutline(outline)
  const selection =
    editor && !editor.state.selection.empty
      ? {
          from: editor.state.selection.from,
          to: editor.state.selection.to,
          text: editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            '\n'
          ),
        }
      : null

  return {
    filePath,
    markdown,
    plainText: editor ? editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n') : markdown,
    selection,
    outline: flat.map((item) => ({
      id: item.id,
      text: item.text,
      level: item.level,
      pos: item.pos,
    })),
  }
}

/**
 * Registers the snapshot getter on window for main-process tool calls.
 */
export function registerDocumentSnapshotBridge({
  getSnapshot,
}: {
  getSnapshot: () => DocumentSnapshot
}): () => void {
  ;(window as Window & { __markdocGetDocumentSnapshot?: () => DocumentSnapshot }).__markdocGetDocumentSnapshot =
    getSnapshot
  return () => {
    delete (window as Window & { __markdocGetDocumentSnapshot?: () => DocumentSnapshot })
      .__markdocGetDocumentSnapshot
  }
}
