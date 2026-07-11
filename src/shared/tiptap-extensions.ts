import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from 'tiptap-markdown'
import type { Extensions, NodeViewRenderer } from '@tiptap/core'
import { lowlight } from './code-languages'

interface CreateTiptapExtensionsOptions {
  /**
   * Attaches the interactive React NodeView (language picker, copy button)
   * to the code-block extension. Only meaningful in the live browser editor —
   * the headless editor used for Markdown round-trip conversion (`shared/markdown.ts`)
   * never mounts a real view, so it opts out to avoid pulling in React rendering.
   */
  codeBlockNodeView?: () => NodeViewRenderer
}

/**
 * Shared Tiptap extension set used by the live editor and headless parsers.
 * Keeping this identical (bar the optional NodeView) prevents outline/preview
 * drift from extension mismatch.
 */
export function createTiptapExtensions({ codeBlockNodeView }: CreateTiptapExtensionsOptions = {}): Extensions {
  let codeBlock = CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: { class: 'code-block' },
  })

  if (codeBlockNodeView) {
    codeBlock = codeBlock.extend({ addNodeView: codeBlockNodeView })
  }

  return [
    StarterKit.configure({ codeBlock: false }),
    codeBlock,
    Underline,
    Link.configure({ openOnClick: false }),
    Image,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      html: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ]
}
