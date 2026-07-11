import type { Editor } from '@tiptap/core'
import { buildOutlineFromDoc, countWords } from './document-index'
import { getDocumentSizeTier } from './types'
import type { FlatOutlineItem, OutlineNode } from './types'
import { getMarkdownFromEditor } from './markdown'

/**
 * Rebuilds outline, word count, and tier from the live Tiptap document.
 */
export function syncDocumentIndexFromEditor({
  editor,
}: {
  editor: Editor
}): {
  outline: OutlineNode[]
  wordCount: number
  documentTier: ReturnType<typeof getDocumentSizeTier>
} {
  const outline = buildOutlineFromDoc(editor.state.doc)
  const wordCount = countWords(editor.getText())
  const markdown = getMarkdownFromEditor(editor)
  const documentTier = getDocumentSizeTier({
    wordCount,
    byteSize: new Blob([markdown]).size,
  })

  return { outline, wordCount, documentTier }
}

/**
 * Finds the outline heading id for the current cursor/selection position.
 */
export function findActiveHeadingId({
  editor,
}: {
  editor: Editor
}): string | null {
  const { from } = editor.state.selection
  const outline = buildOutlineFromDoc(editor.state.doc)
  let activeId: string | null = null

  const walk = (nodes: OutlineNode[]) => {
    for (const node of nodes) {
      if (node.pos <= from) activeId = node.id
      walk(node.children)
    }
  }

  walk(outline)
  return activeId
}

/**
 * Moves a document section in the live Tiptap editor (outline drag-and-drop).
 */
export function moveSectionInEditor({
  editor,
  activeItem,
  overItem,
}: {
  editor: Editor
  activeItem: Pick<FlatOutlineItem, 'pos' | 'sectionEnd'>
  overItem: Pick<FlatOutlineItem, 'pos'>
}): void {
  const { state } = editor
  const { tr } = state
  const slice = state.doc.slice(activeItem.pos, activeItem.sectionEnd)

  tr.delete(activeItem.pos, activeItem.sectionEnd)

  let insertPos = overItem.pos
  if (insertPos > activeItem.pos) {
    insertPos -= activeItem.sectionEnd - activeItem.pos
  }

  tr.insert(insertPos, slice.content)
  editor.view.dispatch(tr)
}
