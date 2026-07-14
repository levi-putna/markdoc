import { useEditor, EditorContent, ReactNodeViewRenderer, type Editor } from '@tiptap/react'
import { useEffect, useRef, useCallback } from 'react'
import { createTiptapExtensions } from '@shared/tiptap-extensions'
import { SyntaxReveal } from '@shared/syntax-reveal'
import { HexColorHighlight } from '@shared/hex-color-highlight'
import { MarkdownPaste } from '@shared/markdown-paste'
import { AiSuggestions } from '@shared/ai-suggestions'
import { AiAutocomplete, autocompleteKey } from '@shared/ai-autocomplete'
import {
  preprocessGfmExtensions,
  extractHeadingIdsFromMarkdown,
  applyHeadingIdsToEditor,
} from '@shared/markdown-gfm'
import { MarkdocImage } from './ImageNodeView'
import { nanoid } from 'nanoid'
import { getDebounceMs } from '@shared/types'
import { getMarkdownFromEditor } from '@shared/markdown'
import {
  findActiveHeadingId,
  syncDocumentIndexFromEditor,
} from '@shared/outline-sync'
import {
  buildAutocompleteEditorContext,
  normaliseAutocompleteSuggestion,
} from '@shared/ai-autocomplete-context'
import { computeHeadingNumbers } from '@shared/heading-numbering'
import {
  syncHeadingNumbersInEditor,
  isHeadingNumberingTransaction,
} from '@shared/heading-numbering-apply'
import { useDocumentStore } from '../store/document-store'
import { CodeBlockView } from './CodeBlockView'
import { EditorToolbar } from './EditorToolbar'
import { TableBubbleMenu } from './TableBubbleMenu'
import { HeadingMentionView } from './HeadingMentionView'
import { createHeadingMentionSuggestionRender } from '../utils/heading-mention-suggestion'
import { setHeadingMentionNumberDisplay } from '@shared/extensions/heading-mention'

interface MarkdocEditorProps {
  content: string
  onContentChange?: ({ markdown, html }: { markdown: string; html: string }) => void
  onEditorReady?: ({ editor }: { editor: Editor }) => void
  onInsertImage?: () => void
  onAskAssistant?: ({ text }: { text: string }) => void
  onSelectionChange?: ({ hasSelection }: { hasSelection: boolean }) => void
  onHeadingClick?: (headingId: string) => void
  scrollToPos?: { pos: number; nonce: number } | null
}

/**
 * Primary Tiptap WYSIWYG editor — the canonical document surface for outline sync.
 */
export function MarkdocEditor({
  content,
  onContentChange,
  onEditorReady,
  onInsertImage,
  onAskAssistant,
  onSelectionChange,
  onHeadingClick,
  scrollToPos,
}: MarkdocEditorProps) {
  const {
    setOutline,
    setWordCount,
    setCharCount,
    setReadingTimeMinutes,
    setDocumentTier,
    setMarkdown,
    setActiveHeadingId,
    documentTier,
    preferences,
    outline,
    numberingConfig,
    numberingOverrides,
    setHeadingNumbers,
  } = useDocumentStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const numberingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRequestId = useRef<string | null>(null)
  const scheduleAutocompleteRef = useRef<(ed: Editor) => void>(() => {})
  const isLocalUpdate = useRef(false)
  const isNumberingSync = useRef(false)
  const rafRef = useRef<number | null>(null)
  const onHeadingClickRef = useRef(onHeadingClick)
  onHeadingClickRef.current = onHeadingClick
  const numberingConfigRef = useRef(numberingConfig)
  numberingConfigRef.current = numberingConfig
  const numberingOverridesRef = useRef(numberingOverrides)
  numberingOverridesRef.current = numberingOverrides

  const editor = useEditor({
    extensions: [...createTiptapExtensions({
      codeBlockNodeView: () => ReactNodeViewRenderer(CodeBlockView),
      imageExtension: MarkdocImage,
      headingMentionNodeView: () => ReactNodeViewRenderer(HeadingMentionView),
      headingMentionSuggestion: {
        render: createHeadingMentionSuggestionRender,
      },
    }), MarkdownPaste, SyntaxReveal, HexColorHighlight, AiSuggestions, AiAutocomplete],
    content: (() => {
      // Heading ids are applied in onCreate after the initial parse.
      return preprocessGfmExtensions(content)
    })(),
    onCreate: ({ editor: ed }) => {
      applyHeadingIdsToEditor({
        editor: ed,
        headingIds: extractHeadingIdsFromMarkdown({ markdown: content }),
      })
    },
    editorProps: {
      attributes: {
        class: 'tiptap simple-editor-content focus:outline-none',
        spellcheck: preferences.spellcheckEnabled ? 'true' : 'false',
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null
        const mention = target?.closest?.('[data-heading-mention], a[href^="heading://"]') as
          | HTMLElement
          | null
        if (!mention) return false

        event.preventDefault()
        const headingId =
          mention.getAttribute('data-heading-id') ??
          mention.getAttribute('href')?.replace(/^heading:\/\//, '') ??
          null
        if (headingId && !mention.getAttribute('data-broken')) {
          onHeadingClickRef.current?.(headingId)
        }
        return true
      },
    },
    onUpdate: ({ editor: ed, transaction }) => {
      isLocalUpdate.current = true

      // Avoid re-entrant work when we just applied numbering ourselves
      if (isHeadingNumberingTransaction(transaction) || isNumberingSync.current) {
        const markdown = getMarkdownFromEditor(ed)
        const { outline: nextOutline, wordCount, documentTier: tier, charCount, readingTimeMinutes } =
          syncDocumentIndexFromEditor({ editor: ed })

        if (numberingConfigRef.current.enabled) {
          const numberMap = computeHeadingNumbers({
            outline: nextOutline,
            config: numberingConfigRef.current,
            overridesByHeadingId: numberingOverridesRef.current,
          })
          const labels: Record<string, string> = {}
          for (const [id, result] of numberMap) {
            labels[id] = result.displayLabel
          }
          setHeadingNumbers(labels)
        } else {
          setHeadingNumbers({})
        }

        setMarkdown(markdown)
        setOutline(nextOutline)
        setWordCount(wordCount)
        setCharCount(charCount)
        setReadingTimeMinutes(readingTimeMinutes)
        setDocumentTier(tier)
        return
      }

      const markdown = getMarkdownFromEditor(ed)
      const { outline: nextOutline, wordCount, documentTier: tier, charCount, readingTimeMinutes } =
        syncDocumentIndexFromEditor({ editor: ed })

      if (numberingConfigRef.current.enabled) {
        const numberMap = computeHeadingNumbers({
          outline: nextOutline,
          config: numberingConfigRef.current,
          overridesByHeadingId: numberingOverridesRef.current,
        })
        const labels: Record<string, string> = {}
        for (const [id, result] of numberMap) {
          labels[id] = result.displayLabel
        }
        setHeadingNumbers(labels)

        // Debounced re-apply so new/moved/edited headings stay numbered
        if (numberingDebounceRef.current) clearTimeout(numberingDebounceRef.current)
        numberingDebounceRef.current = setTimeout(() => {
          if (!ed.isDestroyed && numberingConfigRef.current.enabled) {
            isNumberingSync.current = true
            try {
              syncHeadingNumbersInEditor({
                editor: ed,
                config: numberingConfigRef.current,
                overrides: numberingOverridesRef.current,
              })
            } finally {
              queueMicrotask(() => {
                isNumberingSync.current = false
              })
            }
          }
        }, 200)
      } else {
        setHeadingNumbers({})
      }

      setMarkdown(markdown)
      setOutline(nextOutline)
      setWordCount(wordCount)
      setCharCount(charCount)
      setReadingTimeMinutes(readingTimeMinutes)
      setDocumentTier(tier)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      const debounceMs = getDebounceMs(documentTier)

      debounceRef.current = setTimeout(() => {
        onContentChange?.({ markdown, html: ed.getHTML() })
      }, debounceMs)

      scheduleAutocompleteRef.current(ed)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setActiveHeadingId(findActiveHeadingId({ editor: ed }))
      onSelectionChange?.({ hasSelection: !ed.state.selection.empty })
    },
  })

  useEffect(() => {
    if (!editor) return
    onEditorReady?.({ editor })

    const { outline, wordCount, documentTier: tier, charCount, readingTimeMinutes } =
      syncDocumentIndexFromEditor({ editor })
    setOutline(outline)
    setWordCount(wordCount)
    setCharCount(charCount)
    setReadingTimeMinutes(readingTimeMinutes)
    setDocumentTier(tier)
    setActiveHeadingId(findActiveHeadingId({ editor }))
    onContentChange?.({ markdown: getMarkdownFromEditor(editor), html: editor.getHTML() })

    // Heading-mention NodeViews dispatch this event instead of using
    // href="heading://…", which Electron would try to open externally.
    const onMentionNavigate = (event: Event) => {
      const custom = event as CustomEvent<{ headingId?: string }>
      const headingId = custom.detail?.headingId
      if (headingId) onHeadingClickRef.current?.(headingId)
    }
    editor.view.dom.addEventListener('markdoc-heading-mention', onMentionNavigate)
    return () => {
      editor.view.dom.removeEventListener('markdoc-heading-mention', onMentionNavigate)
    }
  }, [editor])

  // Keep mention HTML/export in sync with the document numbering display setting.
  useEffect(() => {
    if (!editor) return
    const showNumbers =
      numberingConfig.enabled && (numberingConfig.showNumbersInMentions ?? true)
    setHeadingMentionNumberDisplay({ editor, showNumbersInMentions: showNumbers })
  }, [editor, numberingConfig.enabled, numberingConfig.showNumbersInMentions])

  // Apply external markdown changes (file load, markdown tab, outline reorder)
  useEffect(() => {
    if (!editor || isLocalUpdate.current) {
      isLocalUpdate.current = false
      return
    }

    const current = getMarkdownFromEditor(editor)
    if (current !== content) {
      const headingIds = extractHeadingIdsFromMarkdown({ markdown: content })
      editor.commands.setContent(preprocessGfmExtensions(content), false)
      applyHeadingIdsToEditor({ editor, headingIds })
      const { outline, wordCount, documentTier: tier, charCount, readingTimeMinutes } =
        syncDocumentIndexFromEditor({ editor })
      setOutline(outline)
      setWordCount(wordCount)
      setCharCount(charCount)
      setReadingTimeMinutes(readingTimeMinutes)
      setDocumentTier(tier)
      onContentChange?.({ markdown: content, html: editor.getHTML() })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor || scrollToPos == null) return
    const targetPos = scrollToPos.pos

    // Move the cursor to the heading, but focus the DOM directly with
    // `preventScroll` rather than via `editor.commands.focus()`. That command
    // defers the native `.focus()` call to the next animation frame, and
    // outside Safari (i.e. on Chromium/Electron) lets the browser's default
    // caret-follows-focus auto-scroll run a frame after ours — which can
    // hijack our in-progress smooth scroll below and land on an inconsistent
    // position. Focusing synchronously with `preventScroll: true` means this
    // jump behaves the same whether or not the editor had focus beforehand.
    editor.commands.setTextSelection(targetPos)
    editor.view.dom.focus({ preventScroll: true })

    // `domAtPos` is meant for resolving cursor/text positions, not "the
    // element for this node". At a block boundary — exactly where a
    // heading's position sits — it commonly resolves to an ancestor
    // container instead of the heading itself, so scrolling that container
    // into view converges on the same spot regardless of which heading was
    // clicked once the document is long enough. `nodeDOM` looks up the exact
    // DOM node for a node position instead, which is what we actually want.
    const getTarget = (): HTMLElement | null => {
      const target = editor.view.nodeDOM(targetPos)
      return target instanceof HTMLElement ? target : null
    }

    // Editor blocks use `content-visibility: auto` (see globals.css) so far
    // offscreen sections skip layout for performance. Sections the jump
    // scrolls *past* — not just the target itself — can take several frames
    // to finish promoting from an estimated placeholder size to their real,
    // fully-rendered size, which shifts everything below them (including our
    // target) afterwards. That promotion isn't reliably done just because
    // one check found the same position twice in a row — it can appear
    // briefly stable and then drift once a further section finishes
    // promoting a few frames later. Require several consecutive stable
    // readings (not just one) before trusting convergence, with a bounded
    // number of attempts as a safety net. Uses an instant (non-`smooth`)
    // scroll throughout so each correction takes effect immediately instead
    // of fighting an in-progress animation.
    const REQUIRED_STABLE_FRAMES = 6
    const MAX_ATTEMPTS = 40
    let attempts = 0
    let stableStreak = 0
    let lastTop = getTarget()?.getBoundingClientRect().top ?? null
    const settle = () => {
      attempts += 1
      getTarget()?.scrollIntoView({ block: 'center' })
      const nextTop = getTarget()?.getBoundingClientRect().top ?? null
      const stable = lastTop != null && nextTop != null && Math.abs(nextTop - lastTop) < 1
      stableStreak = stable ? stableStreak + 1 : 0
      lastTop = nextTop
      if (stableStreak < REQUIRED_STABLE_FRAMES && attempts < MAX_ATTEMPTS) {
        rafRef.current = requestAnimationFrame(settle)
      }
    }
    rafRef.current = requestAnimationFrame(settle)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [editor, scrollToPos])

  /** Debounced inline autocomplete via IPC (FR-14.41). */
  scheduleAutocompleteRef.current = (ed: Editor) => {
    if (!preferences.aiEnabled || !preferences.autocompleteEnabled || !window.markdoc) return
    if (!ed.state.selection.empty) return
    if (ed.isActive('codeBlock')) {
      ed.commands.clearAutocompleteGhost()
      return
    }

    if (autocompleteRef.current) clearTimeout(autocompleteRef.current)
    autocompleteRef.current = setTimeout(() => {
      const context = buildAutocompleteEditorContext({
        editor: ed,
        contextWindow: preferences.autocompleteContextWindow,
        outline,
      })
      if (!context || context.cursorInWord) return

      const requestId = nanoid()
      autocompleteRequestId.current = requestId
      void window.markdoc?.requestAutocomplete({
        requestId,
        modelId: preferences.defaultAutocompleteModel,
        context,
      })
    }, 600)
  }

  useEffect(() => {
    if (!editor || !window.markdoc) return

    const unsub = window.markdoc.onAutocompleteResult(({ requestId, text }) => {
      if (requestId !== autocompleteRequestId.current) return
      if (!text) {
        editor.commands.clearAutocompleteGhost()
        return
      }

      const context = buildAutocompleteEditorContext({
        editor,
        contextWindow: preferences.autocompleteContextWindow,
        outline,
      })
      if (!context) {
        editor.commands.clearAutocompleteGhost()
        return
      }

      const normalised = normaliseAutocompleteSuggestion({
        suggestion: text,
        prefix: context.prefix,
        suffix: context.suffix,
        charBeforeCursor: context.charBeforeCursor,
        charAfterCursor: context.charAfterCursor,
        cursorInWord: context.cursorInWord,
      })

      if (!normalised) {
        editor.commands.clearAutocompleteGhost()
        return
      }

      editor.commands.setAutocompleteGhost(normalised)
    })

    return unsub
  }, [editor, outline, preferences.autocompleteContextWindow])

  useEffect(() => {
    if (!editor) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const pluginState = autocompleteKey.getState(editor.state)
        if (pluginState?.ghostText) {
          event.preventDefault()
          editor.commands.acceptAutocompleteGhost()
          if (autocompleteRequestId.current) {
            void window.markdoc?.cancelAutocomplete({ requestId: autocompleteRequestId.current })
          }
        }
      }
      if (event.key === 'Escape') {
        editor.commands.clearAutocompleteGhost()
        if (autocompleteRequestId.current) {
          void window.markdoc?.cancelAutocomplete({ requestId: autocompleteRequestId.current })
        }
      }
    }

    editor.view.dom.addEventListener('keydown', onKeyDown)
    return () => editor.view.dom.removeEventListener('keydown', onKeyDown)
  }, [editor])

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!editor || !onAskAssistant) return
      const { from, to, empty } = editor.state.selection
      if (empty) return
      event.preventDefault()

      const text = editor.state.doc.textBetween(from, to, '\n')
      const menu = document.createElement('div')
      menu.className =
        'fixed z-50 rounded border border-border-subtle bg-surface-primary py-1 text-sm shadow-lg'
      menu.style.left = `${event.clientX}px`
      menu.style.top = `${event.clientY}px`

      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'block w-full px-3 py-1.5 text-left hover:bg-surface-secondary'
      item.textContent = 'Ask Assistant'
      item.addEventListener('click', () => {
        onAskAssistant({ text })
        menu.remove()
      })

      const dismiss = () => {
        menu.remove()
        document.removeEventListener('click', dismiss)
      }

      menu.appendChild(item)
      document.body.appendChild(menu)
      setTimeout(() => document.addEventListener('click', dismiss), 0)
    },
    [editor, onAskAssistant]
  )

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
      <EditorToolbar editor={editor} onInsertImage={onInsertImage} />

      {/* Editor content area */}
      <div className="simple-editor-body relative flex-1 overflow-y-auto">
        <TableBubbleMenu editor={editor} />
        <EditorContent
          editor={editor}
          className="min-h-full"
          onMouseDown={handleContentAreaMouseDown}
          onContextMenu={handleContextMenu}
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
