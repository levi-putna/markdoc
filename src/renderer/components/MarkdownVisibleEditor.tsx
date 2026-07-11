import { useEffect, useRef } from 'react'
import Editor from 'react-simple-code-editor'
import { highlightMarkdownSource } from '@shared/markdown-highlight'
import { buildOutlineFromDoc, countWords } from '@shared/document-index'
import { getDocumentSizeTier, getDebounceMs } from '@shared/types'
import { loadMarkdownIntoEditor, getMarkdownFromEditor } from '@shared/markdown'
import { useDocumentStore } from '../store/document-store'

interface MarkdownVisibleEditorProps {
  value: string
  onChange: ({ markdown, html }: { markdown: string; html: string }) => void
  scrollToChar?: number | null
}

/**
 * Edit-mode Markdown surface that keeps syntax visible (`#`, `**`, etc.)
 * while applying inline formatting cues (bold, italic, headings).
 */
export function MarkdownVisibleEditor({
  value,
  onChange,
  scrollToChar,
}: MarkdownVisibleEditorProps) {
  const {
    setOutline,
    setWordCount,
    setDocumentTier,
    setMarkdown,
    setDirty,
    documentTier,
    preferences,
  } = useDocumentStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const handleValueChange = (markdown: string) => {
    setMarkdown(markdown)
    setDirty(true)

    // Keep outline in sync immediately so the tree reflects structure while typing
    const syncEditor = loadMarkdownIntoEditor(markdown)
    const words = countWords(syncEditor.getText())
    setOutline(buildOutlineFromDoc(syncEditor.state.doc))
    setWordCount(words)
    setDocumentTier(
      getDocumentSizeTier({
        wordCount: words,
        byteSize: new Blob([markdown]).size,
      })
    )
    syncEditor.destroy()

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const debounceMs = getDebounceMs(documentTier)

    debounceRef.current = setTimeout(() => {
      const editor = loadMarkdownIntoEditor(markdown)
      const html = editor.getHTML()
      editor.destroy()
      onChange({ markdown, html })
    }, debounceMs)
  }

  useEffect(() => {
    if (scrollToChar == null || !textareaRef.current) return
    const textarea = textareaRef.current
    textarea.focus()
    textarea.setSelectionRange(scrollToChar, scrollToChar)

    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24
    const textBefore = value.slice(0, scrollToChar)
    const lineNumber = textBefore.split('\n').length - 1
    textarea.scrollTop = Math.max(0, lineNumber * lineHeight - textarea.clientHeight / 3)
  }, [scrollToChar, value])

  return (
    <div
      className="markdown-visible-editor h-full overflow-y-auto bg-surface-primary"
      data-testid="editor-pane"
    >
      <Editor
        value={value}
        onValueChange={handleValueChange}
        highlight={highlightMarkdownSource}
        padding={48}
        // textareaRef is a runtime-supported prop missing from the library's types
        {...({ textareaRef } as Record<string, unknown>)}
        spellCheck={preferences.spellcheckEnabled}
        className="markdown-visible-editor__input min-h-full outline-none"
        style={{
          fontFamily: preferences.editorFontFamily,
          fontSize: `${preferences.editorFontSize}px`,
          lineHeight: preferences.editorLineSpacing,
          tabSize: 2,
        }}
      />
    </div>
  )
}

/**
 * Returns markdown from the visible editor value (passthrough for API compatibility).
 */
export function getVisibleEditorMarkdown({ markdown }: { markdown: string }): string {
  return markdown
}

/**
 * Syncs a headless Tiptap instance after outline drag-and-drop and returns updated markdown.
 */
export function applyOutlineMoveToMarkdown({
  markdown,
  activeItem,
  overItem,
}: {
  markdown: string
  activeItem: { pos: number; sectionEnd: number }
  overItem: { pos: number }
}): string {
  const editor = loadMarkdownIntoEditor(markdown)
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
  const result = getMarkdownFromEditor(editor)
  editor.destroy()
  return result
}
