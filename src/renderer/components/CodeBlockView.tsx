import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, ChevronDown, Copy, CopyCheck, Maximize2, Minimize2, Plus } from 'lucide-react'
import { CODE_LANGUAGE_OPTIONS, getCodeLanguageLabel } from '@shared/code-languages'

/**
 * NodeView for fenced code blocks — renders the code-block "card" (design-guide.md
 * §10) with a language picker and hover copy-button in the top-right corner,
 * on top of the plain `<pre><code>` content that Tiptap/lowlight manage.
 */
export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [draftText, setDraftText] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const langBtnRef = useRef<HTMLButtonElement>(null)
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null)

  const language: string = node.attrs.language ?? ''
  const activeLabel = getCodeLanguageLabel({ value: language })

  useEffect(() => {
    if (!pickerOpen) return
    setQuery('')
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [pickerOpen])

  // Code blocks are ProseMirror NodeViews living inside the editor's
  // contenteditable region. An in-place `position: absolute` dropdown there
  // can end up unpainted/unhittable past the block's own box regardless of
  // z-index or ancestor overflow (a quirk of nested contenteditable
  // islands) — so instead we portal the menu to <body> and position it via
  // the trigger button's live coordinates, which always renders correctly.
  useLayoutEffect(() => {
    if (!pickerOpen) return

    const updatePosition = () => {
      const rect = langBtnRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }

    updatePosition()

    // This is a short-lived picker rather than a persistent popover, so
    // dismiss on scroll/resize instead of tracking the trigger's position.
    const dismiss = () => setPickerOpen(false)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [pickerOpen])

  const trimmedQuery = query.trim()
  const filteredOptions = CODE_LANGUAGE_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(trimmedQuery.toLowerCase())
  )
  // Lets people label a snippet with a language MarkDoc doesn't ship a
  // grammar for (e.g. a DSL or config format) — the fence tag is preserved
  // in the exported Markdown either way, and highlighting simply falls back
  // to auto-detection for anything unregistered (see `getDecorations` in
  // `@tiptap/extension-code-block-lowlight`, which never throws for this).
  const showCustomOption =
    trimmedQuery.length > 0 &&
    !CODE_LANGUAGE_OPTIONS.some(
      (option) =>
        option.value.toLowerCase() === trimmedQuery.toLowerCase() ||
        option.label.toLowerCase() === trimmedQuery.toLowerCase()
    )

  const applyLanguage = (value: string) => {
    updateAttributes({ language: value || null })
    setPickerOpen(false)
  }

  /**
   * Copies the raw code text to the clipboard and shows brief confirmation.
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the OS/browser sandbox — the copy
      // button simply stays in its default state, no user-facing error needed.
    }
  }

  const openFullscreen = () => {
    setDraftText(node.textContent)
    setFullscreenOpen(true)
  }

  const closeFullscreen = () => setFullscreenOpen(false)

  useEffect(() => {
    if (!fullscreenOpen) return
    const frame = requestAnimationFrame(() => {
      const textarea = fullscreenTextareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [fullscreenOpen])

  // Listen at the document level (rather than only on the textarea) so Esc
  // closes the panel even if focus has moved to the header buttons.
  useEffect(() => {
    if (!fullscreenOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeFullscreen()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [fullscreenOpen])

  // The fullscreen textarea is a plain, independent input — not the
  // ProseMirror-managed contentDOM — so every edit is written straight back
  // into the document via a transaction. This keeps the rest of the app
  // (Preview pane, Markdown source, word count, etc.) live-updated while the
  // snippet is being edited in fullscreen, without disturbing the textarea's
  // own focus/selection the way calling `editor.chain().focus()` would.
  const commitDraft = (text: string) => {
    const pos = getPos()
    const from = pos + 1
    const to = pos + node.nodeSize - 1
    editor.view.dispatch(editor.state.tr.insertText(text, from, to))
  }

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target
    setDraftText(value)
    commitDraft(value)
  }

  /** Inserts two spaces for Tab instead of moving focus out of the textarea. */
  const handleFullscreenKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const textarea = event.currentTarget
    const { selectionStart, selectionEnd, value } = textarea
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
    setDraftText(next)
    commitDraft(next)
    requestAnimationFrame(() => {
      textarea.setSelectionRange(selectionStart + 2, selectionStart + 2)
    })
  }

  return (
    <NodeViewWrapper className="code-block-node group" data-language={language || undefined}>
      {/* Language picker + copy action — sits above the card, non-editable chrome */}
      <div className="code-block-toolbar" contentEditable={false}>
        <div className="relative">
          <button
            ref={langBtnRef}
            type="button"
            className="code-block-lang-btn"
            onClick={() => setPickerOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            data-testid="code-block-language-select"
          >
            {activeLabel}
            <ChevronDown size={12} aria-hidden />
          </button>

          {pickerOpen && menuPosition &&
            createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close language menu"
                  onClick={() => setPickerOpen(false)}
                />
                <div
                  className="code-block-lang-menu code-block-lang-menu--portal"
                  role="listbox"
                  style={{ top: menuPosition.top, right: menuPosition.right }}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search or enter a language…"
                    className="code-block-lang-search"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setPickerOpen(false)
                        return
                      }
                      if (event.key !== 'Enter') return
                      // Enter picks the top filtered match, or — if nothing
                      // matches — commits whatever was typed as a custom
                      // language so power users never need the mouse.
                      if (filteredOptions.length > 0) applyLanguage(filteredOptions[0].value)
                      else if (showCustomOption) applyLanguage(trimmedQuery)
                    }}
                  />
                  <ul className="code-block-lang-list">
                    {filteredOptions.length === 0 && !showCustomOption && (
                      <li className="code-block-lang-empty">No matching languages</li>
                    )}
                    {filteredOptions.map((option) => (
                      <li key={option.value || 'auto'}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={language === option.value}
                          className={`code-block-lang-option ${
                            language === option.value ? 'code-block-lang-option--active' : ''
                          }`}
                          onClick={() => applyLanguage(option.value)}
                        >
                          {option.label}
                          {language === option.value && <Check size={12} aria-hidden />}
                        </button>
                      </li>
                    ))}
                    {showCustomOption && (
                      <li>
                        <button
                          type="button"
                          className="code-block-lang-option code-block-lang-option--custom"
                          onClick={() => applyLanguage(trimmedQuery)}
                          data-testid="code-block-language-custom"
                        >
                          <span className="truncate">Use “{trimmedQuery}”</span>
                          <Plus size={12} aria-hidden />
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              </>,
              document.body
            )}
        </div>

        <button
          type="button"
          className="code-block-copy-btn"
          onClick={handleCopy}
          aria-label="Copy code"
          title="Copy code"
        >
          {copied ? <CopyCheck size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        </button>

        <button
          type="button"
          className="code-block-copy-btn"
          onClick={openFullscreen}
          aria-label="Open full screen"
          title="Open full screen"
          data-testid="code-block-fullscreen-open"
        >
          <Maximize2 size={13} aria-hidden />
        </button>
      </div>

      <pre>
        <NodeViewContent as="code" />
      </pre>

      {fullscreenOpen &&
        createPortal(
          <div className="code-block-fullscreen-overlay" data-testid="code-block-fullscreen">
            <div className="code-block-fullscreen-panel">
              <div className="code-block-fullscreen-header">
                <div className="flex min-w-0 items-center">
                  {/* Reserves space for the macOS traffic lights (hiddenInset title bar),
                      matching the spacer used in the main Toolbar */}
                  <div className="w-20 shrink-0" aria-hidden />
                  <span className="code-block-fullscreen-lang">{activeLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="code-block-copy-btn code-block-copy-btn--fullscreen"
                    onClick={handleCopy}
                    aria-label="Copy code"
                    title="Copy code"
                  >
                    {copied ? <CopyCheck size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    className="code-block-copy-btn code-block-copy-btn--fullscreen"
                    onClick={closeFullscreen}
                    aria-label="Exit full screen"
                    title="Exit full screen (Esc)"
                    data-testid="code-block-fullscreen-close"
                  >
                    <Minimize2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
              <textarea
                ref={fullscreenTextareaRef}
                className="code-block-fullscreen-textarea"
                value={draftText}
                onChange={handleDraftChange}
                onKeyDown={handleFullscreenKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                data-testid="code-block-fullscreen-textarea"
              />
            </div>
          </div>,
          document.body
        )}
    </NodeViewWrapper>
  )
}
