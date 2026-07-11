import type { LucideIcon } from 'lucide-react'
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Quote,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'

export type BlockTypeId =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'blockquote'
  | 'code-block'

export interface BlockTypeOption {
  id: BlockTypeId
  label: string
  icon: LucideIcon
}

export const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  { id: 'paragraph', label: 'Paragraph', icon: Pilcrow },
  { id: 'heading-1', label: 'Heading 1', icon: Heading1 },
  { id: 'heading-2', label: 'Heading 2', icon: Heading2 },
  { id: 'heading-3', label: 'Heading 3', icon: Heading3 },
  { id: 'heading-4', label: 'Heading 4', icon: Heading4 },
  { id: 'heading-5', label: 'Heading 5', icon: Heading5 },
  { id: 'bullet-list', label: 'Bullet list', icon: List },
  { id: 'ordered-list', label: 'Numbered list', icon: ListOrdered },
  { id: 'task-list', label: 'Task list', icon: ListTodo },
  { id: 'blockquote', label: 'Quote', icon: Quote },
  { id: 'code-block', label: 'Code block', icon: Code },
]

/**
 * Returns the active block type for the current selection.
 */
export function getActiveBlockType({ editor }: { editor: Editor }): BlockTypeId {
  if (editor.isActive('heading', { level: 1 })) return 'heading-1'
  if (editor.isActive('heading', { level: 2 })) return 'heading-2'
  if (editor.isActive('heading', { level: 3 })) return 'heading-3'
  if (editor.isActive('heading', { level: 4 })) return 'heading-4'
  if (editor.isActive('heading', { level: 5 })) return 'heading-5'
  if (editor.isActive('taskList')) return 'task-list'
  if (editor.isActive('bulletList')) return 'bullet-list'
  if (editor.isActive('orderedList')) return 'ordered-list'
  if (editor.isActive('blockquote')) return 'blockquote'
  if (editor.isActive('codeBlock')) return 'code-block'
  return 'paragraph'
}

/**
 * Applies the selected block type at the current selection.
 */
export function setBlockType({ editor, blockType }: { editor: Editor; blockType: BlockTypeId }): void {
  const chain = editor.chain().focus()

  switch (blockType) {
    case 'paragraph':
      chain.setParagraph().run()
      break
    case 'heading-1':
      chain.setHeading({ level: 1 }).run()
      break
    case 'heading-2':
      chain.setHeading({ level: 2 }).run()
      break
    case 'heading-3':
      chain.setHeading({ level: 3 }).run()
      break
    case 'heading-4':
      chain.setHeading({ level: 4 }).run()
      break
    case 'heading-5':
      chain.setHeading({ level: 5 }).run()
      break
    case 'bullet-list':
      chain.toggleBulletList().run()
      break
    case 'ordered-list':
      chain.toggleOrderedList().run()
      break
    case 'task-list':
      chain.toggleTaskList().run()
      break
    case 'blockquote':
      chain.toggleBlockquote().run()
      break
    case 'code-block':
      chain.toggleCodeBlock().run()
      break
    default:
      break
  }
}

/**
 * Returns the display label for a block type id.
 */
export function getBlockTypeLabel({ blockType }: { blockType: BlockTypeId }): string {
  return BLOCK_TYPE_OPTIONS.find((option) => option.id === blockType)?.label ?? 'Paragraph'
}

/**
 * Returns the icon component for a block type id.
 */
export function getBlockTypeIcon({ blockType }: { blockType: BlockTypeId }): LucideIcon {
  return BLOCK_TYPE_OPTIONS.find((option) => option.id === blockType)?.icon ?? Pilcrow
}
