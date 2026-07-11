import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, ChevronDown, Copy, CopyCheck } from 'lucide-react'
import { CODE_LANGUAGE_OPTIONS, getCodeLanguageLabel } from '@shared/code-languages'

/**
 * NodeView for fenced code blocks — renders the code-block "card" (design-guide.md
 * §10) with a language picker and hover copy-button in the top-right corner,
 * on top of the plain `<pre><code>` content that Tiptap/lowlight manage.
 */
export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const langBtnRef = useRef<HTMLButtonElement>(null)

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

  const filteredOptions = CODE_LANGUAGE_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  )

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
                    placeholder="Search languages…"
                    className="code-block-lang-search"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setPickerOpen(false)
                    }}
                  />
                  <ul className="code-block-lang-list">
                    {filteredOptions.length === 0 && (
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
                          onClick={() => {
                            updateAttributes({ language: option.value || null })
                            setPickerOpen(false)
                          }}
                        >
                          {option.label}
                          {language === option.value && <Check size={12} aria-hidden />}
                        </button>
                      </li>
                    ))}
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
      </div>

      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
