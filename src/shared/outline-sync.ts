import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { buildOutlineFromDoc, countWords } from './document-index'
import { getDocumentSizeTier } from './types'
import type { FlatOutlineItem, OutlineNode } from './types'
import { getMarkdownFromEditor } from './markdown'
import { computeHeadingLevelDelta, depthToHeadingLevel } from './outline-drag'

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
  charCount: number
  readingTimeMinutes: number
} {
  const outline = buildOutlineFromDoc(editor.state.doc)
  const text = editor.getText()
  const wordCount = countWords(text)
  const charCount = text.length
  const markdown = getMarkdownFromEditor(editor)
  const documentTier = getDocumentSizeTier({
    wordCount,
    byteSize: new Blob([markdown]).size,
  })
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))

  return { outline, wordCount, documentTier, charCount, readingTimeMinutes }
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
 * Shifts heading levels within a document range by `delta`.
 */
function shiftHeadingLevelsInRange({
  doc,
  from,
  to,
  delta,
}: {
  doc: ProseMirrorNode
  from: number
  to: number
  delta: number
}): Array<{ pos: number; level: number }> {
  const updates: Array<{ pos: number; level: number }> = []
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'heading') {
      const current = node.attrs.level as number
      const next = Math.min(6, Math.max(1, current + delta))
      if (next !== current) {
        updates.push({ pos, level: next })
      }
    }
  })
  return updates
}

/**
 * Moves a document section in the live Tiptap editor (outline drag-and-drop).
 * When `projectedDepth` is supplied, heading levels within the moved section
 * are adjusted to match the new nesting depth (FR-4.8).
 */
export function moveSectionInEditor({
  editor,
  activeItem,
  overItem,
  projectedDepth,
}: {
  editor: Editor
  activeItem: Pick<FlatOutlineItem, 'pos' | 'sectionEnd' | 'level' | 'depth'>
  overItem: Pick<FlatOutlineItem, 'pos'>
  projectedDepth?: number
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

  if (projectedDepth != null) {
    const delta = computeHeadingLevelDelta({
      originalLevel: activeItem.level,
      projectedDepth,
    })
    if (delta !== 0) {
      const sectionEnd = insertPos + (activeItem.sectionEnd - activeItem.pos)
      const updates = shiftHeadingLevelsInRange({
        doc: tr.doc,
        from: insertPos,
        to: sectionEnd,
        delta,
      })
      for (const { pos, level } of updates.reverse()) {
        const node = tr.doc.nodeAt(pos)
        if (node?.type.name === 'heading') {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, level })
        }
      }
    }
  }

  editor.view.dispatch(tr)
}

/**
 * Indents or outdents a heading section by shifting all heading levels in its
 * range by `delta` (±1). Indent nests under the sibling above; outdent promotes
 * to a peer of the current parent. Document order is unchanged.
 */
export function shiftSectionNestingInEditor({
  editor,
  item,
  delta,
}: {
  editor: Editor
  item: Pick<FlatOutlineItem, 'pos' | 'sectionEnd' | 'level'>
  delta: 1 | -1
}): boolean {
  if (delta !== 1 && delta !== -1) return false

  const updates = shiftHeadingLevelsInRange({
    doc: editor.state.doc,
    from: item.pos,
    to: item.sectionEnd,
    delta,
  })
  if (updates.length === 0) return false

  const { tr } = editor.state
  for (const { pos, level } of [...updates].reverse()) {
    const node = tr.doc.nodeAt(pos)
    if (node?.type.name === 'heading') {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, level })
    }
  }
  editor.view.dispatch(tr)
  return true
}

/**
 * Returns the heading level implied by a projected tree depth.
 */
export function headingLevelForDepth(depth: number): number {
  return depthToHeadingLevel(depth)
}
