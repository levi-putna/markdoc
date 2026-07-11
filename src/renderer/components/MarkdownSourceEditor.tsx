import { useEffect, useRef } from 'react'
import SimpleMDE from 'simplemde/dist/simplemde.min.js'
import 'simplemde/dist/simplemde.min.css'
import 'codemirror/lib/codemirror.css'
import { useDocumentStore } from '../store/document-store'

interface MarkdownSourceEditorProps {
  value: string
  scrollToChar?: number | null
  onChange: ({ markdown }: { markdown: string }) => void
}

/**
 * Markdown source editor powered by SimpleMDE.
 */
export function MarkdownSourceEditor({
  value,
  scrollToChar,
  onChange,
}: MarkdownSourceEditorProps) {
  const { preferences } = useDocumentStore()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editorRef = useRef<SimpleMDE | null>(null)
  const isInternalChange = useRef(false)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!textareaRef.current || editorRef.current) return

    const editor = new SimpleMDE({
      element: textareaRef.current,
      initialValue: value,
      autofocus: false,
      spellChecker: preferences.spellcheckEnabled,
      toolbar: false,
      status: false,
    })

    editor.codemirror.on('change', () => {
      isInternalChange.current = true
      onChangeRef.current({ markdown: editor.value() })
    })

    editorRef.current = editor

    return () => {
      editor.toTextArea()
      editorRef.current = null
    }
    // Mount once — value sync handled separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External value updates (file load, sync from Edit tab)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || isInternalChange.current) {
      isInternalChange.current = false
      return
    }

    if (editor.value() !== value) {
      editor.value(value)
    }
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || scrollToChar == null) return

    const doc = editor.codemirror.getDoc()
    const position = editor.codemirror.posFromIndex(scrollToChar)
    doc.setCursor(position)
    editor.codemirror.scrollIntoView(position, 80)
  }, [scrollToChar])

  /**
   * CodeMirror already places the caret sensibly for clicks on its own
   * rendered lines (including short-line and below-last-line dead space).
   * This only catches the rare case where a click misses CodeMirror's DOM
   * entirely — matching the WYSIWYG editor's "click anywhere focuses, and
   * lands at the end of the document if not on specific text" rule.
   */
  const handleHostMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.codemirror.getWrapperElement().contains(event.target as Node)) return

    event.preventDefault()
    editor.codemirror.focus()
    editor.codemirror.getDoc().setCursor(editor.codemirror.posFromIndex(editor.value().length))
  }

  return (
    <div
      className="simplemde-host flex h-full flex-col overflow-hidden bg-surface-primary"
      onMouseDown={handleHostMouseDown}
      data-testid="markdown-source-pane"
    >
      <textarea ref={textareaRef} defaultValue={value} />
    </div>
  )
}
