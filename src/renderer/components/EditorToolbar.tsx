import type { Editor } from '@tiptap/react'
import {
  AtSign,
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  ImageIcon,
} from 'lucide-react'
import { BlockTypeSelect } from './BlockTypeSelect'
import { TableInsertPicker } from './TableInsertPicker'

interface EditorToolbarProps {
  editor: Editor
  onInsertImage?: () => void
}

/**
 * Top formatting toolbar styled after the Tiptap simple editor template.
 */
export function EditorToolbar({ editor, onInsertImage }: EditorToolbarProps) {
  const iconBtn = (active: boolean) =>
    `toolbar-icon-btn ${active ? 'toolbar-icon-btn--active' : ''}`

  return (
    <div
      className="simple-editor-toolbar no-drag flex items-center border-b border-border-subtle bg-surface-primary"
      data-testid="editor-toolbar"
    >
      {/* Block type — far left */}
      <BlockTypeSelect editor={editor} />

      <span className="toolbar-separator" aria-hidden />

      {/* Inline marks */}
      <button
        type="button"
        className={iconBtn(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
        title="Bold (⌘B)"
      >
        <Bold />
      </button>
      <button
        type="button"
        className={iconBtn(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
        title="Italic (⌘I)"
      >
        <Italic />
      </button>
      <button
        type="button"
        className={iconBtn(editor.isActive('strike'))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
        title="Strikethrough (⌘⇧X)"
      >
        <Strikethrough />
      </button>
      <button
        type="button"
        className={iconBtn(editor.isActive('code'))}
        onClick={() => editor.chain().focus().toggleCode().run()}
        aria-label="Inline code"
        title="Inline code (⌘E)"
      >
        <Code />
      </button>
      <button
        type="button"
        className={iconBtn(editor.isActive('codeBlock'))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        aria-label="Code block"
        title="Code block (⌘⌥C)"
      >
        <SquareCode />
      </button>

      <span className="toolbar-separator" aria-hidden />

      {/* Quick list / quote shortcuts */}
      <button
        type="button"
        className={iconBtn(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
        title="Bullet list (⌘⇧8)"
      >
        <List />
      </button>
      <button
        type="button"
        className={iconBtn(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered list"
        title="Ordered list (⌘⇧7)"
      >
        <ListOrdered />
      </button>
      <button
        type="button"
        className={iconBtn(editor.isActive('blockquote'))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Blockquote"
        title="Blockquote (⌘⇧B)"
      >
        <Quote />
      </button>

      <span className="toolbar-separator" aria-hidden />

      {/* Table insert */}
      <TableInsertPicker editor={editor} />

      <button
        type="button"
        className="toolbar-icon-btn"
        onClick={() => onInsertImage?.()}
        aria-label="Insert image"
        title="Insert image"
        data-testid="insert-image-button"
      >
        <ImageIcon />
      </button>
      <button
        type="button"
        className="toolbar-icon-btn"
        onClick={() => {
          // Inserting `@` at the caret opens the same heading-mention suggestion popup.
          editor.chain().focus().insertContent('@').run()
        }}
        aria-label="Mention heading"
        title="Mention heading"
        data-testid="insert-heading-mention-button"
      >
        <AtSign />
      </button>

      {/* Undo / redo — far right */}
      <div className="ml-auto flex items-center gap-px">
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
          title="Undo (⌘Z)"
        >
          <Undo2 />
        </button>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 />
        </button>
      </div>
    </div>
  )
}
