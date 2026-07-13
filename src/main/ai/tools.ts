import { tool } from 'ai'
import { z } from 'zod'
import type { DocumentSnapshot } from '@shared/ai/types'
import { summariseEdit } from '@shared/ai-edit-positions'
import type { WebContents } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'

const editInputSchema = z.object({
  from: z.number().optional().describe('ProseMirror document position start. Use read_selection for selected text.'),
  to: z.number().optional().describe('ProseMirror document position end. Use read_selection for selected text.'),
  originalText: z
    .string()
    .optional()
    .describe('Exact text to replace when positions are unavailable. Must match the document text.'),
  replacement: z
    .string()
    .describe(
      'Replacement Markdown for the target range. Must preserve surrounding block structure: match list markers, heading levels, fence delimiters, and blank-line spacing. Use inline syntax only for inline spans; include full block syntax when replacing blocks.'
    ),
  rationale: z.string().optional().describe('Short reason for the change, shown in the review UI.'),
})

/**
 * Requests a live document snapshot from the renderer.
 */
export async function requestDocumentSnapshot({
  webContents,
}: {
  webContents: WebContents
}): Promise<DocumentSnapshot> {
  return webContents.executeJavaScript(`
    (async () => {
      if (window.__markdocGetDocumentSnapshot) {
        return window.__markdocGetDocumentSnapshot();
      }
      return { filePath: null, markdown: '', plainText: '', selection: null, outline: [] };
    })()
  `) as Promise<DocumentSnapshot>
}

/**
 * Builds AI SDK tools for the document assistant agent.
 */
export function buildAssistantTools({
  getSnapshot,
  onProposeEdit,
  onApplyEdit,
  editMode,
}: {
  getSnapshot: () => Promise<DocumentSnapshot>
  onProposeEdit: (payload: {
    from?: number
    to?: number
    originalText?: string
    replacement: string
    rationale?: string
    summary?: string
  }) => Promise<string>
  onApplyEdit: (payload: {
    from?: number
    to?: number
    originalText?: string
    replacement: string
    rationale?: string
    summary?: string
  }) => Promise<void>
  editMode: 'suggestion' | 'auto'
}) {
  const executeEdit = async ({
    from,
    to,
    originalText,
    replacement,
    rationale,
    mode,
  }: {
    from?: number
    to?: number
    originalText?: string
    replacement: string
    rationale?: string
    mode: 'suggestion' | 'auto'
  }) => {
    const snapshot = await getSnapshot()
    let resolvedFrom = from
    let resolvedTo = to
    let resolvedOriginalText = originalText?.trim()

    if (snapshot.selection) {
      const positionsMatch =
        resolvedFrom === snapshot.selection.from && resolvedTo === snapshot.selection.to
      const positionsMissing = resolvedFrom === undefined && resolvedTo === undefined

      if (positionsMissing || positionsMatch) {
        resolvedFrom = snapshot.selection.from
        resolvedTo = snapshot.selection.to
        resolvedOriginalText = resolvedOriginalText || snapshot.selection.text.trim()
      }
    }

    const summary = summariseEdit({
      originalText: resolvedOriginalText ?? '',
      replacement,
      rationale,
    })

    if (mode === 'auto') {
      await onApplyEdit({
        from: resolvedFrom,
        to: resolvedTo,
        originalText: resolvedOriginalText,
        replacement,
        rationale,
        summary,
      })
      return { applied: true, mode: 'auto', summary }
    }

    const suggestionId = await onProposeEdit({
      from: resolvedFrom,
      to: resolvedTo,
      originalText: resolvedOriginalText,
      replacement,
      rationale,
      summary,
    })
    return { applied: false, mode: 'suggestion', suggestionId, summary }
  }

  return {
    read_document: tool({
      description:
        'Read the full document or a section by heading id or line range. When planning an edit, read lines above and below the target to inspect surrounding Markdown structure.',
      inputSchema: z.object({
        headingId: z.string().optional(),
        lineStart: z.number().optional(),
        lineEnd: z.number().optional(),
      }),
      execute: async ({ headingId, lineStart, lineEnd }) => {
        const snapshot = await getSnapshot()
        let markdown = snapshot.markdown

        if (headingId) {
          const item = snapshot.outline.find((h) => h.id === headingId)
          if (!item) return { error: `Heading not found: ${headingId}` }
          const lines = markdown.split('\n')
          const startLine = markdown.slice(0, item.pos).split('\n').length - 1
          const next = snapshot.outline.find(
            (h) => h.pos > item.pos && h.level <= item.level
          )
          const endLine = next
            ? markdown.slice(0, next.pos).split('\n').length - 1
            : lines.length
          markdown = lines.slice(startLine, endLine).join('\n')
        } else if (lineStart !== undefined || lineEnd !== undefined) {
          const lines = markdown.split('\n')
          const start = Math.max(0, (lineStart ?? 1) - 1)
          const end = lineEnd ?? lines.length
          markdown = lines.slice(start, end).join('\n')
        }

        return {
          markdown,
          plainText: snapshot.plainText,
          filePath: snapshot.filePath,
        }
      },
    }),

    read_selection: tool({
      description:
        'Read the currently selected text and its ProseMirror from/to positions for propose_edit.',
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await getSnapshot()
        return {
          selection: snapshot.selection,
          filePath: snapshot.filePath,
        }
      },
    }),

    read_outline: tool({
      description:
        'Read the document heading outline hierarchy with ProseMirror positions. Use before structural edits to respect heading levels and section boundaries.',
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = await getSnapshot()
        return { outline: snapshot.outline }
      },
    }),

    search_document: tool({
      description: 'Search for text or regex matches within the document.',
      inputSchema: z.object({
        query: z.string(),
        regex: z.boolean().optional(),
      }),
      execute: async ({ query, regex }) => {
        const snapshot = await getSnapshot()
        const matches: Array<{ line: number; text: string }> = []
        const lines = snapshot.markdown.split('\n')
        const pattern = regex ? new RegExp(query, 'gi') : null

        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i]
          const found = pattern ? pattern.test(line) : line.toLowerCase().includes(query.toLowerCase())
          if (found) matches.push({ line: i + 1, text: line })
          if (matches.length >= 20) break
        }

        return { matches, total: matches.length }
      },
    }),

    propose_edit: tool({
      description:
        'Propose an edit as track changes for user review. Read surrounding context first so the replacement preserves Markdown structure and does not break headings, lists, code fences, or blockquotes. Provide selection from/to from read_selection, or originalText for text search. Always include a short rationale.',
      inputSchema: editInputSchema,
      execute: async ({ from, to, originalText, replacement, rationale }) => {
        if (editMode === 'auto') {
          return executeEdit({ from, to, originalText, replacement, rationale, mode: 'auto' })
        }
        return executeEdit({ from, to, originalText, replacement, rationale, mode: 'suggestion' })
      },
    }),

    apply_edit: tool({
      description:
        'Apply an edit directly to the document immediately. Read surrounding context first and ensure the replacement preserves Markdown structure and does not break neighbouring formatting.',
      inputSchema: editInputSchema,
      execute: async ({ from, to, originalText, replacement, rationale }) => {
        return executeEdit({ from, to, originalText, replacement, rationale, mode: 'auto' })
      },
    }),
  }
}

export { IPC_CHANNELS }
