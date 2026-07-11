import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { FlatOutlineItem, OutlineNode } from './types'

/**
 * Builds a stable heading id from level, text, and occurrence index.
 */
function buildHeadingId({
  level,
  text,
  occurrence,
}: {
  level: number
  text: string
  occurrence: number
}): string {
  const slug =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'untitled'

  return `h${level}-${slug}-${occurrence}`
}

/**
 * Walks a ProseMirror document and builds a hierarchical outline from headings.
 */
export function buildOutlineFromDoc(doc: ProseMirrorNode): OutlineNode[] {
  const headings: Array<{ id: string; text: string; level: number; pos: number }> = []
  const occurrenceCounts = new Map<string, number>()

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textContent
      const level = node.attrs.level as number
      const key = `${level}::${text}`
      const occurrence = occurrenceCounts.get(key) ?? 0
      occurrenceCounts.set(key, occurrence + 1)

      headings.push({
        id: buildHeadingId({ level, text, occurrence }),
        text,
        level,
        pos,
      })
    }
  })

  const withSections = headings.map((h, i) => {
    let sectionEnd = doc.content.size
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) {
        sectionEnd = headings[j].pos
        break
      }
    }
    return { ...h, sectionEnd, children: [] as OutlineNode[] }
  })

  const root: OutlineNode[] = []
  const stack: OutlineNode[] = []

  for (const item of withSections) {
    const node: OutlineNode = {
      id: item.id,
      text: item.text,
      level: item.level,
      pos: item.pos,
      sectionEnd: item.sectionEnd,
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }
    stack.push(node)
  }

  return root
}

/**
 * Flattens a hierarchical outline tree for drag-and-drop rendering.
 */
export function flattenOutline(
  nodes: OutlineNode[],
  {
    collapsedIds = new Set<string>(),
    parentId = null,
    depth = 0,
  }: {
    collapsedIds?: Set<string>
    parentId?: string | null
    depth?: number
  } = {}
): FlatOutlineItem[] {
  const result: FlatOutlineItem[] = []

  for (const node of nodes) {
    const collapsed = collapsedIds.has(node.id)
    result.push({
      id: node.id,
      text: node.text,
      level: node.level,
      depth,
      pos: node.pos,
      sectionEnd: node.sectionEnd,
      parentId,
      collapsed,
    })
    if (!collapsed && node.children.length > 0) {
      result.push(
        ...flattenOutline(node.children, {
          collapsedIds,
          parentId: node.id,
          depth: depth + 1,
        })
      )
    }
  }

  return result
}

/**
 * Counts words in a plain text string.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Estimates reading time in minutes at 200 wpm.
 */
export function estimateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}
