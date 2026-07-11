import { useEditor, EditorContent, ReactNodeViewRenderer, type Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { createTiptapExtensions } from '@shared/tiptap-extensions'
import { getDebounceMs } from '@shared/types'
import { getMarkdownFromEditor } from '@shared/markdown'
import {
  findActiveHeadingId,
  syncDocumentIndexFromEditor,
} from '@shared/outline-sync'
import { useDocumentStore } from '../store/document-store'
import { CodeBlockView } from './CodeBlockView'
import { EditorToolbar } from './EditorToolbar'
import { TableBubbleMenu } from './TableBubbleMenu'

interface MarkdocEditorProps {
  content: string
  onContentChange?: ({ markdown, html }: { markdown: string; html: string }) => void
  onEditorReady?: ({ editor }: { editor: Editor }) => void
  scrollToPos?: number | null
}

/**
 * Primary Tiptap WYSIWYG editor — the canonical document surface for outline sync.
 */
export function MarkdocEditor({
  content,
  onContentChange,
  onEditorReady,
  scrollToPos,
}: MarkdocEditorProps) {
  const {
    setOutline,
    setWordCount,
    setDocumentTier,
    setMarkdown,
    setActiveHeadingId,
    documentTier,
    preferences,
  } = useDocumentStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLocalUpdate = useRef(false)

  const editor = useEditor({
    extensions: createTiptapExtensions({
      codeBlockNodeView: () => ReactNodeViewRenderer(CodeBlockView),
    }),
    content,
    editorProps: {
      attributes: {
        class: 'tiptap simple-editor-content focus:outline-none',
        spellcheck: preferences.spellcheckEnabled ? 'true' : 'false',
      },
    },
    onUpdate: ({ editor: ed }) => {
      isLocalUpdate.current = true
      const markdown = getMarkdownFromEditor(ed)
      const { outline, wordCount, documentTier: tier } = syncDocumentIndexFromEditor({ editor: ed })

      setMarkdown(markdown)
      setOutline(outline)
      setWordCount(wordCount)
      setDocumentTier(tier)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      const debounceMs = getDebounceMs(documentTier)

      debounceRef.current = setTimeout(() => {
        onContentChange?.({ markdown, html: ed.getHTML() })
      }, debounceMs)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setActiveHeadingId(findActiveHeadingId({ editor: ed }))
    },
  })

  useEffect(() => {
    if (!editor) return
    onEditorReady?.({ editor })

    const { outline, wordCount, documentTier: tier } = syncDocumentIndexFromEditor({ editor })
    setOutline(outline)
    setWordCount(wordCount)
    setDocumentTier(tier)
    setActiveHeadingId(findActiveHeadingId({ editor }))
    onContentChange?.({ markdown: getMarkdownFromEditor(editor), html: editor.getHTML() })
  }, [editor])

  // Apply external markdown changes (file load, markdown tab, outline reorder)
  useEffect(() => {
    if (!editor || isLocalUpdate.current) {
      isLocalUpdate.current = false
      return
    }

    const current = getMarkdownFromEditor(editor)
    if (current !== content) {
      editor.commands.setContent(content, false)
      const { outline, wordCount, documentTier: tier } = syncDocumentIndexFromEditor({ editor })
      setOutline(outline)
      setWordCount(wordCount)
      setDocumentTier(tier)
      onContentChange?.({ markdown: content, html: editor.getHTML() })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor || scrollToPos == null) return
    editor.commands.focus()
    editor.commands.setTextSelection(scrollToPos)
    const dom = editor.view.domAtPos(scrollToPos)
    const element = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [editor, scrollToPos])

  if (!editor) return null

  /**
   * The Tiptap content column is capped at 720px and centred (design-guide
   * §4/§6), so clicks in the side gutters or below the last line land on
   * this wrapper rather than the editable node itself. Treat any such click
   * as "focus the document" and place the caret at the end, matching how
   * Bear/iA Writer handle clicks outside the actual text.
   */
  const handleContentAreaMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (editor.view.dom.contains(event.target as Node)) return
    event.preventDefault()
    editor.chain().focus('end').run()
  }

  return (
    <div className="simple-editor flex h-full flex-col bg-surface-primary" data-testid="editor-pane">
      {/* Formatting toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor content area */}
      <div className="simple-editor-body relative flex-1 overflow-y-auto">
        <TableBubbleMenu editor={editor} />
        <EditorContent
          editor={editor}
          className="min-h-full"
          onMouseDown={handleContentAreaMouseDown}
        />
      </div>
    </div>
  )
}

/**
 * Returns the serialised Markdown from an editor instance.
 */
export function getEditorMarkdown({ editor }: { editor: Editor }): string {
  return getMarkdownFromEditor(editor)
}
