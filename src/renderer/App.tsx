import { useState, useEffect, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useDocumentStore } from './store/document-store'
import { Toolbar } from './components/Toolbar'
import { OutlineSidebar } from './components/OutlineSidebar'
import { AssistantPanel } from './components/AssistantPanel'
import { MarkdocEditor } from './components/MarkdocEditor'
import { MarkdownSourceEditor } from './components/MarkdownSourceEditor'
import { PreviewPane } from './components/PreviewPane'
import { SearchOverlay, useSearchShortcut } from './components/SearchOverlay'
import { FindReplaceDialog } from './components/FindReplaceDialog'
import { ImageInsertDialog } from './components/ImageInsertDialog'
import { StyleOverridesPanel } from './components/StyleOverridesPanel'
import { DocumentOptionsPanel } from './components/DocumentOptionsPanel'
import { ExportDialog } from './components/ExportDialog'
import { flattenOutline } from '@shared/document-index'
import { findHeadingCharOffset } from '@shared/markdown-highlight'
import { parseMarkdownAsync } from '@shared/markdown-async'
import {
  moveSectionInEditor,
  shiftSectionNestingInEditor,
} from '@shared/outline-sync'
import {
  syncHeadingNumbersInEditor,
  clearHeadingNumbersInEditor,
} from '@shared/heading-numbering-apply'
import { computeHeadingNumbers } from '@shared/heading-numbering'
import type { FlatOutlineItem } from '@shared/types'
import type { StyleOverride, WindowState } from '@shared/ipc'
import { useAppTheme } from './hooks/use-app-theme'
import {
  buildDocumentSnapshot,
  registerDocumentSnapshotBridge,
} from './lib/document-snapshot'
import { aiSuggestionsKey, registerSuggestionActionHandler } from '@shared/ai-suggestions'
import { resolveEditRange, summariseEdit } from '@shared/ai-edit-positions'
import { buildReplacementSlice, resolveSuggestionRange } from '@shared/ai-suggestion-apply'
import type { SuggestionDecorationPayload } from '@shared/ai/types'

/**
 * Main document window layout composing toolbar, sidebar, editor, and preview.
 */
export function App() {
  useAppTheme()

  return <DocumentWindow />
}

/**
 * The primary document editing window.
 */
function DocumentWindow() {
  const {
    viewMode,
    sidebarVisible,
    searchOpen,
    findReplaceOpen,
    stylePanelOpen,
    setSearchOpen,
    setFindReplaceOpen,
    setStylePanelOpen,
    markdown,
    filePath,
    frontMatter,
    isDirty,
    setDirty,
    setFilePath,
    setMarkdown,
    setFrontMatter,
    outline,
    preferences,
    setPreferences,
    setOutline,
    wordCount,
    setWordCount,
    setCharCount,
    setReadingTimeMinutes,
    setDocumentTier,
    sidebarWidth,
    styleOverrides,
    setStyleOverrides,
    setBrokenImages,
    brokenImages,
    setHighlightRange,
    setViewMode,
    setSidebarWidth,
    rightPanel,
    rightPanelWidth,
    setAssistantVisible,
    openRightPanel,
    setRightPanelWidth,
    pendingSuggestionCount,
    pendingSuggestionIds,
    suggestionResolutions,
    setPendingSuggestionCount,
    setPendingSuggestionIds,
    setSuggestionResolution,
    recordSuggestionResolutions,
    documentSessionId,
    setAiModels,
    setNumberingConfig,
    setNumberingOverrides,
    setHeadingNumbers,
  } = useDocumentStore()

  const [previewHtml, setPreviewHtml] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [imageInsertOpen, setImageInsertOpen] = useState(false)
  // `nonce` makes every jump a distinct value, even to the same heading twice
  // in a row, without needing to reset back to `null` shortly after (which
  // used to race with — and cut short — MarkdocEditor's multi-frame scroll
  // convergence for headings far down long documents).
  const [scrollToPos, setScrollToPos] = useState<{ pos: number; nonce: number } | null>(null)
  const scrollNonce = useRef(0)
  const [scrollToChar, setScrollToChar] = useState<number | null>(null)
  const [splitScrollRatio, setSplitScrollRatio] = useState<number | null>(null)
  const [assistantPrefill, setAssistantPrefill] = useState<string | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [styleDraft, setStyleDraft] = useState<StyleOverride>({ version: 1 })
  const editorRef = useRef<Editor | null>(null)
  const pendingSuggestionPayloadsRef = useRef<
    Array<SuggestionDecorationPayload & { autoApply?: boolean }>
  >([])
  const flushPendingSuggestionsRef = useRef<((editor: Editor) => void) | null>(null)
  const recoveryInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useSearchShortcut()

  const syncPreviewFromMarkdown = useCallback(async (md: string) => {
    const { html } = await parseMarkdownAsync({ markdown: md })
    setPreviewHtml(html)
  }, [])

  const syncIndexFromMarkdown = useCallback(
    async (md: string) => {
      const { outline: nextOutline, wordCount, documentTier, charCount, readingTimeMinutes } =
        await parseMarkdownAsync({ markdown: md })
      setOutline(nextOutline)
      setWordCount(wordCount)
      setCharCount(charCount)
      setReadingTimeMinutes(readingTimeMinutes)
      setDocumentTier(documentTier)
    },
    [setOutline, setWordCount, setCharCount, setReadingTimeMinutes, setDocumentTier]
  )

  // Apply per-document style overrides to the document root
  useEffect(() => {
    for (const [key, value] of Object.entries(styleOverrides)) {
      document.documentElement.style.setProperty(key, value)
    }
  }, [styleOverrides])

  // Persist window state for session restoration
  useEffect(() => {
    const saveState = () => {
      if (!window.markdoc) return
      const state: WindowState = {
        filePath,
        bounds: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
        viewMode,
        sidebarVisible,
        sidebarWidth,
        rightPanel,
        rightPanelWidth,
      }
      void window.markdoc.saveWindowState(state)
    }
    const interval = setInterval(saveState, 5000)
    window.addEventListener('beforeunload', saveState)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', saveState)
      saveState()
    }
  }, [filePath, viewMode, sidebarVisible, sidebarWidth, rightPanel, rightPanelWidth])

  // Restore window state from previous session
  useEffect(() => {
    if (!window.markdoc) return
    return window.markdoc.onWindowRestoreState((state) => {
      setViewMode(state.viewMode)
      if (!state.sidebarVisible) useDocumentStore.getState().toggleSidebar()
      setSidebarWidth(state.sidebarWidth)
      const panel =
        state.rightPanel ?? (state.assistantVisible ? 'assistant' : null)
      if (panel) openRightPanel(panel)
      setRightPanelWidth(state.rightPanelWidth ?? state.assistantWidth ?? 320)
    })
  }, [setViewMode, setSidebarWidth, openRightPanel, setRightPanelWidth])

  // Load preferences on mount (theme handling lives in useAppTheme)
  useEffect(() => {
    window.markdoc?.getPreferences().then(setPreferences)
  }, [setPreferences])

  // Load AI model catalogue when AI is enabled
  useEffect(() => {
    if (!window.markdoc || !preferences.aiEnabled) return
    void window.markdoc.listAiModels().then(({ models }) => setAiModels(models))
  }, [preferences.aiEnabled, setAiModels])

  // Bridge live document snapshot for main-process AI tools
  useEffect(() => {
    return registerDocumentSnapshotBridge({
      getSnapshot: () =>
        buildDocumentSnapshot({
          editor: editorRef.current,
          filePath,
          markdown,
          outline,
        }),
    })
  }, [filePath, markdown, outline])

  // Apply AI suggestion decorations from the main process
  useEffect(() => {
    if (!window.markdoc) return

    const syncSuggestions = () => {
      const editor = editorRef.current
      if (!editor) return
      const suggestions = aiSuggestionsKey.getState(editor.state)?.suggestions ?? []
      setPendingSuggestionCount(suggestions.length)
      setPendingSuggestionIds(suggestions.map((suggestion) => suggestion.suggestionId))
    }

    const applySuggestionToEditor = ({
      editor,
      payload,
      autoApply = false,
    }: {
      editor: Editor
      payload: SuggestionDecorationPayload & { autoApply?: boolean }
      autoApply?: boolean
    }) => {
      const resolved = resolveEditRange({
        doc: editor.state.doc,
        from: payload.from,
        to: payload.to,
        originalText: payload.originalText,
      })

      if (!resolved) {
        console.warn('[assistant] Could not resolve edit range for suggestion', payload)
        return
      }

      const summary =
        payload.summary ??
        summariseEdit({
          originalText: resolved.originalText,
          replacement: payload.replacement,
          rationale: payload.rationale,
        })

      if (autoApply || payload.autoApply) {
        const resolvedForApply = resolveSuggestionRange({
          editor,
          from: resolved.from,
          to: resolved.to,
          originalText: resolved.originalText,
        })
        if (!resolvedForApply) return

        const slice = buildReplacementSlice({ editor, replacement: payload.replacement })
        const tr = editor.state.tr.replaceRange(resolvedForApply.from, resolvedForApply.to, slice)
        editor.view.dispatch(tr)
        setDirty(true)
        return
      }

      setViewMode('edit')
      editor
        .chain()
        .addAiSuggestion({
          suggestionId: payload.suggestionId,
          from: resolved.from,
          to: resolved.to,
          replacement: payload.replacement,
          originalText: resolved.originalText,
          rationale: payload.rationale,
          summary,
        })
        .focusAiSuggestion(payload.suggestionId)
        .run()
      syncSuggestions()
    }

    flushPendingSuggestionsRef.current = (editor) => {
      const queue = pendingSuggestionPayloadsRef.current
      pendingSuggestionPayloadsRef.current = []
      for (const payload of queue) {
        applySuggestionToEditor({ editor, payload })
      }
    }

    const unsubApply = window.markdoc.onSuggestionApply((payload) => {
      const editor = editorRef.current
      if (!editor) {
        pendingSuggestionPayloadsRef.current.push(payload)
        return
      }
      applySuggestionToEditor({ editor, payload })
    })

    const unsubAccept = window.markdoc.onSuggestionAccept(({ suggestionId }) => {
      editorRef.current?.commands.acceptAiSuggestion(suggestionId)
      setDirty(true)
      setSuggestionResolution({ suggestionId, status: 'accepted' })
      syncSuggestions()
    })
    const unsubReject = window.markdoc.onSuggestionReject(({ suggestionId }) => {
      editorRef.current?.commands.rejectAiSuggestion(suggestionId)
      setSuggestionResolution({ suggestionId, status: 'rejected' })
      syncSuggestions()
    })
    const unsubAcceptAll = window.markdoc.onSuggestionAcceptAll(() => {
      const ids = useDocumentStore.getState().pendingSuggestionIds
      editorRef.current?.commands.acceptAllAiSuggestions()
      useDocumentStore.getState().recordSuggestionResolutions({ suggestionIds: ids, status: 'accepted' })
      setDirty(true)
      setPendingSuggestionCount(0)
      setPendingSuggestionIds([])
    })
    const unsubRejectAll = window.markdoc.onSuggestionRejectAll(() => {
      const ids = useDocumentStore.getState().pendingSuggestionIds
      editorRef.current?.commands.rejectAllAiSuggestions()
      useDocumentStore.getState().recordSuggestionResolutions({ suggestionIds: ids, status: 'rejected' })
      setPendingSuggestionCount(0)
      setPendingSuggestionIds([])
    })

    const unsubInlineActions = registerSuggestionActionHandler(({ action, suggestionId }) => {
      const editor = editorRef.current
      if (!editor) return

      if (action === 'accept') {
        editor.commands.acceptAiSuggestion(suggestionId)
        setDirty(true)
        setSuggestionResolution({ suggestionId, status: 'accepted' })
      } else {
        editor.commands.rejectAiSuggestion(suggestionId)
        setSuggestionResolution({ suggestionId, status: 'rejected' })
      }

      syncSuggestions()
    })

    return () => {
      unsubApply()
      unsubAccept()
      unsubReject()
      unsubAcceptAll()
      unsubRejectAll()
      unsubInlineActions()
    }
  }, [setDirty, setPendingSuggestionCount, setPendingSuggestionIds, setSuggestionResolution, setViewMode])

  const loadStyleForDocument = useCallback(async (path: string) => {
    if (!window.markdoc) return
    const overrides = await window.markdoc.loadStyleOverrides(path)
    setStyleOverrides(overrides)
    setStyleDraft({ version: 1, ...overrides })
  }, [setStyleOverrides])

  const loadNumberingForDocument = useCallback(
    async (path: string) => {
      if (!window.markdoc) return
      const { config, overrides } = await window.markdoc.loadNumbering(path)
      setNumberingConfig(config)
      setNumberingOverrides(overrides)
    },
    [setNumberingConfig, setNumberingOverrides]
  )

  /**
   * Writes numbering config to the sidecar (when the document is saved) and
   * re-applies or clears numbering in the live editor.
   */
  const persistAndApplyNumbering = useCallback(async () => {
    const editor = editorRef.current
    const { numberingConfig: config, numberingOverrides: overrides, outline: currentOutline } =
      useDocumentStore.getState()

    if (filePath && window.markdoc) {
      await window.markdoc.saveNumbering({
        documentPath: filePath,
        config,
        overrides,
      })
    }

    if (editor) {
      if (config.enabled) {
        syncHeadingNumbersInEditor({ editor, config, overrides })
        const numberMap = computeHeadingNumbers({
          outline: currentOutline,
          config,
          overridesByHeadingId: overrides,
        })
        const labels: Record<string, string> = {}
        for (const [id, result] of numberMap) {
          labels[id] = result.displayLabel
        }
        setHeadingNumbers(labels)
      } else {
        clearHeadingNumbersInEditor({ editor })
        setHeadingNumbers({})
      }
      setDirty(true)
    }
  }, [filePath, setHeadingNumbers, setDirty])

  const checkImages = useCallback(async (path: string, md: string) => {
    if (!window.markdoc) return
    const broken = await window.markdoc.checkBrokenImages({ documentPath: path, markdown: md })
    setBrokenImages(broken)
    if (broken.length > 0) {
      window.alert(
        `${broken.length} broken image reference(s) found:\n${broken.map((b) => `Line ${b.line}: ${b.src}`).join('\n')}`
      )
    }
  }, [setBrokenImages])
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${preferences.editorFontSize}px`)
    document.documentElement.style.setProperty('--editor-line-spacing', String(preferences.editorLineSpacing))
    document.documentElement.style.setProperty('--editor-font-family', preferences.editorFontFamily)

    const rowHeights: Record<string, string> = { small: '20px', medium: '24px', large: '28px' }
    document.documentElement.style.setProperty(
      '--outline-row-height',
      rowHeights[preferences.sidebarDensity] ?? rowHeights.medium
    )
  }, [preferences])

  // Mirror document state onto native window chrome (dirty dot in the close
  // button, represented file proxy icon, window title) and main-process routing.
  useEffect(() => {
    window.markdoc?.setWindowDirtyState({
      isDirty,
      filePath,
      isEmpty: markdown.trim() === '',
    })
    const fileName = filePath?.split('/').pop()
    document.title = fileName ?? 'Untitled'
  }, [isDirty, filePath, markdown])

  // Crash recovery snapshots
  useEffect(() => {
    if (!filePath || !window.markdoc) return
    recoveryInterval.current = setInterval(() => {
      if (isDirty) {
        window.markdoc.saveRecovery(filePath, markdown)
      }
    }, 30_000)
    return () => {
      if (recoveryInterval.current) clearInterval(recoveryInterval.current)
    }
  }, [filePath, isDirty, markdown])

  const loadFile = useCallback(
    async (path: string, { approved = false }: { approved?: boolean } = {}) => {
      if (!window.markdoc) return

      if (isDirty && !approved) {
        console.warn('Blocked unapproved file open while document has unsaved changes:', path)
        return
      }

      try {
        const recovery = await window.markdoc.checkRecovery(path)
        const result = await window.markdoc.readFile(path)

        let content = result.markdown
        if (recovery.hasRecovery && recovery.content) {
          const useRecovery = window.confirm('Recover unsaved changes from a previous session?')
          if (useRecovery) {
            content = recovery.content
          } else {
            await window.markdoc.clearRecovery(path)
          }
        }

        setMarkdown(content)
        await syncPreviewFromMarkdown(content)
        await syncIndexFromMarkdown(content)
        setFilePath(path)
        setFrontMatter(result.frontMatter)
        setDirty(false)
        await window.markdoc.watchFile(path)
        await loadStyleForDocument(path)
        await loadNumberingForDocument(path)
        await checkImages(path, content)
      } catch (error) {
        // Surface load failures (missing/unreadable file, parse errors) instead
        // of failing silently and leaving the editor on stale content.
        console.error('Failed to open file:', path, error)
        window.alert(`Couldn't open “${path.split('/').pop()}”.\n\n${(error as Error).message ?? error}`)
      }
    },
    [isDirty, setMarkdown, syncPreviewFromMarkdown, syncIndexFromMarkdown, loadStyleForDocument, loadNumberingForDocument, checkImages]
  )

  const handleSave = useCallback(async () => {
    if (!window.markdoc) return
    const path = filePath ?? (await window.markdoc.saveAsDialog('Untitled.md'))
    if (!path) return

    await window.markdoc.writeFile({ filePath: path, markdown, frontMatter })
    const { numberingConfig: config, numberingOverrides: overrides } = useDocumentStore.getState()
    await window.markdoc.saveNumbering({
      documentPath: path,
      config,
      overrides,
    })
    setFilePath(path)
    setDirty(false)
    await window.markdoc.clearRecovery(path)
  }, [markdown, filePath, frontMatter])

  const handleSaveAs = useCallback(async () => {
    if (!window.markdoc) return
    const path = await window.markdoc.saveAsDialog(filePath?.split('/').pop() ?? 'Untitled.md')
    if (!path) return

    const result = await window.markdoc.saveAsWithAssets({
      oldFilePath: filePath,
      newFilePath: path,
      markdown,
      frontMatter,
    })

    if (result.markdown !== markdown) {
      setMarkdown(result.markdown)
      await syncPreviewFromMarkdown(result.markdown)
      await syncIndexFromMarkdown(result.markdown)
    }

    const { numberingConfig: config, numberingOverrides: overrides } = useDocumentStore.getState()
    await window.markdoc.saveNumbering({
      documentPath: path,
      config,
      overrides,
    })

    setFilePath(path)
    setDirty(false)
    await window.markdoc.watchFile(path)
    await window.markdoc.clearRecovery(path)
  }, [markdown, filePath, frontMatter, setMarkdown, syncPreviewFromMarkdown, syncIndexFromMarkdown])

  // Menu action handlers. Depends on handleSave/handleSaveAs/loadFile (not just
  // filePath) so it always re-subscribes with the latest markdown — otherwise
  // Save would keep writing back whatever content existed when the listener
  // was last (re)registered, silently dropping every edit made since then.
  useEffect(() => {
    if (!window.markdoc) return

    const unsubs = [
      window.markdoc.onMenuAction('save', () => handleSave()),
      window.markdoc.onMenuAction('save-as', () => handleSaveAs()),
      window.markdoc.onMenuAction('toggle-sidebar', () => useDocumentStore.getState().toggleSidebar()),
      window.markdoc.onMenuAction('toggle-assistant', () =>
        useDocumentStore.getState().toggleRightPanel('assistant')
      ),
      window.markdoc.onMenuAction('toggle-document-options', () =>
        useDocumentStore.getState().toggleRightPanel('documentOptions')
      ),
      window.markdoc.onMenuAction('view-mode', (mode) =>
        useDocumentStore.getState().setViewMode(mode as 'edit' | 'markdown' | 'preview' | 'split')
      ),
      window.markdoc.onMenuAction('find', () => setSearchOpen(true)),
      window.markdoc.onMenuAction('find-replace', () => setFindReplaceOpen(true)),
      window.markdoc.onMenuAction('duplicate', async () => {
        if (!filePath || !window.markdoc) return
        const result = await window.markdoc.duplicateFile({ filePath, markdown, frontMatter })
        if (result.success && result.newPath) loadFile(result.newPath)
      }),
      window.markdoc.onMenuAction('rename', async () => {
        if (!filePath || !window.markdoc) return
        const newName = window.prompt('Rename to:', filePath.split('/').pop() ?? '')
        if (!newName) return
        const result = await window.markdoc.renameFile({ filePath, newName })
        if (result.success && result.newPath) {
          setFilePath(result.newPath)
          await window.markdoc.watchFile(result.newPath)
        }
      }),
      window.markdoc.onMenuAction('move-to', async () => {
        if (!filePath || !window.markdoc) return
        const paths = await window.markdoc.pickFolder()
        if (!paths) return
        const result = await window.markdoc.moveFile({ filePath, destinationDir: paths })
        if (result.success && result.newPath) {
          setFilePath(result.newPath)
          await window.markdoc.watchFile(result.newPath)
        }
      }),
      window.markdoc.onMenuAction('revert', async () => {
        if (!filePath || !window.markdoc) return
        const result = await window.markdoc.revertFile(filePath)
        if (!result) return
        setMarkdown(result.markdown)
        setFrontMatter(result.frontMatter)
        await syncPreviewFromMarkdown(result.markdown)
        await syncIndexFromMarkdown(result.markdown)
        setDirty(false)
      }),
      window.markdoc.onMenuAction('export', () => setExportOpen(true)),
      window.markdoc.onMenuAction('document-styles', () => setStylePanelOpen(true)),
      window.markdoc.onFileOpenRequested(({ filePath: path, approved }) => loadFile(path, { approved })),
      window.markdoc.onFileChangedExternal((path) => {
        if (path === filePath) {
          const shouldReload = window.confirm(
            'This file was changed outside MarkDoc.\n\nReload it from disk? Your unsaved changes will be lost.'
          )
          if (shouldReload) loadFile(path, { approved: true })
        }
      }),
    ]

    return () => unsubs.forEach((u) => u?.())
  }, [filePath, frontMatter, markdown, isDirty, handleSave, handleSaveAs, loadFile, setFindReplaceOpen, setSearchOpen, setStylePanelOpen, syncIndexFromMarkdown, syncPreviewFromMarkdown, setMarkdown, setFrontMatter, setDirty, setFilePath])

  const handleEditorReady = useCallback(({ editor }: { editor: Editor }) => {
    editorRef.current = editor
    setHasSelection(!editor.state.selection.empty)
    flushPendingSuggestionsRef.current?.(editor)

    const { numberingConfig: config, numberingOverrides: overrides, outline: currentOutline } =
      useDocumentStore.getState()
    if (config.enabled) {
      syncHeadingNumbersInEditor({ editor, config, overrides })
      const numberMap = computeHeadingNumbers({
        outline: currentOutline,
        config,
        overridesByHeadingId: overrides,
      })
      const labels: Record<string, string> = {}
      for (const [id, result] of numberMap) {
        labels[id] = result.displayLabel
      }
      setHeadingNumbers(labels)
    }
  }, [setHeadingNumbers])

  const handleEditorContentChange = useCallback(
    ({ html }: { markdown: string; html: string }) => {
      setPreviewHtml(html)
    },
    []
  )

  const handleMarkdownSourceChange = useCallback(
    async ({ markdown: md }: { markdown: string }) => {
      setMarkdown(md)
      await syncIndexFromMarkdown(md)
      await syncPreviewFromMarkdown(md)
    },
    [setMarkdown, syncIndexFromMarkdown, syncPreviewFromMarkdown]
  )

  const handleJumpToOutline = useCallback(
    (item: FlatOutlineItem) => {
      if (viewMode === 'markdown' || viewMode === 'split') {
        const offset = findHeadingCharOffset({
          markdown,
          headingText: item.text,
          level: item.level,
        })
        setScrollToChar(offset)
        setTimeout(() => setScrollToChar(null), 100)
        return
      }

      scrollNonce.current += 1
      setScrollToPos({ pos: item.pos, nonce: scrollNonce.current })
    },
    [markdown, viewMode]
  )

  const handleSearchJump = useCallback(
    (charOffset: number, queryLength = 0) => {
      setHighlightRange({ from: charOffset, to: charOffset + queryLength })
      setTimeout(() => setHighlightRange(null), 2000)

      if (viewMode === 'markdown' || viewMode === 'split') {
        setScrollToChar(charOffset)
        setTimeout(() => setScrollToChar(null), 100)
        return
      }

      const editor = editorRef.current
      if (!editor) return
      editor.commands.focus()
      editor.commands.setTextSelection(charOffset)
    },
    [viewMode, setHighlightRange]
  )

  const handleOutlineReorder = useCallback(
    ({
      activeItem,
      overItem,
      projectedDepth,
    }: {
      activeItem: FlatOutlineItem
      overItem: FlatOutlineItem
      projectedDepth: number
    }) => {
      const editor = editorRef.current
      if (!editor) return

      moveSectionInEditor({ editor, activeItem, overItem, projectedDepth })
      setDirty(true)

      const { numberingConfig: config, numberingOverrides: overrides } = useDocumentStore.getState()
      if (config.enabled) {
        syncHeadingNumbersInEditor({ editor, config, overrides })
      }
    },
    [setDirty]
  )

  /**
   * Indents or outdents an outline heading section, then re-syncs numbering.
   */
  const handleOutlineNestingShift = useCallback(
    ({ item, delta }: { item: FlatOutlineItem; delta: 1 | -1 }) => {
      const editor = editorRef.current
      if (!editor) return

      const changed = shiftSectionNestingInEditor({ editor, item, delta })
      if (!changed) return

      setDirty(true)
      const { numberingConfig: config, numberingOverrides: overrides } = useDocumentStore.getState()
      if (config.enabled) {
        syncHeadingNumbersInEditor({ editor, config, overrides })
      }
    },
    [setDirty]
  )

  const handleFileDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const dropped = event.dataTransfer.files[0]
      if (!dropped?.path || !window.markdoc) return
      void window.markdoc.requestOpenFile({ filePath: dropped.path, source: 'drop' })
    },
    []
  )

  const insertImageIntoEditor = useCallback(
    ({ src, alt }: { src: string; alt: string }) => {
      if (!editorRef.current) return
      editorRef.current.chain().focus().setImage({ src, alt: alt || undefined }).run()
      setDirty(true)
    },
    [setDirty]
  )

  const handleInsertLocalImage = useCallback(
    async ({ alt }: { alt: string }) => {
      if (!window.markdoc || !filePath) {
        throw new Error('Save the document before inserting local images.')
      }
      const picked = await window.markdoc.pickImage()
      if (!picked) return
      const { relativePath } = await window.markdoc.importAsset({
        documentPath: filePath,
        sourcePath: picked.sourcePath,
      })
      insertImageIntoEditor({ src: relativePath, alt })
    },
    [filePath, insertImageIntoEditor]
  )

  const handleInsertUrlImage = useCallback(
    ({ url, alt }: { url: string; alt: string }) => {
      insertImageIntoEditor({ src: url, alt })
    },
    [insertImageIntoEditor]
  )

  const handleOpenImageDialog = useCallback(() => {
    setImageInsertOpen(true)
  }, [])

  const handleJumpToHeadingId = useCallback(
    (headingId: string) => {
      const item = flattenOutline(outline).find((entry) => entry.id === headingId)
      if (item) handleJumpToOutline(item)
    },
    [outline, handleJumpToOutline]
  )

  const handleAskAssistant = useCallback(
    ({ text }: { text: string }) => {
      setAssistantVisible(true)
      setAssistantPrefill(`Regarding this selection:\n\n> ${text}\n\n`)
    },
    [setAssistantVisible]
  )

  const handleOpenPreferences = useCallback(() => {
    void window.markdoc?.openPreferences()
  }, [])

  const handleAcceptSuggestion = useCallback(
    ({ suggestionId }: { suggestionId: string }) => {
      editorRef.current?.commands.acceptAiSuggestion(suggestionId)
      setDirty(true)
      setSuggestionResolution({ suggestionId, status: 'accepted' })
      const suggestions = editorRef.current
        ? aiSuggestionsKey.getState(editorRef.current.state)?.suggestions ?? []
        : []
      setPendingSuggestionCount(suggestions.length)
      setPendingSuggestionIds(suggestions.map((suggestion) => suggestion.suggestionId))
    },
    [setDirty, setPendingSuggestionCount, setPendingSuggestionIds, setSuggestionResolution]
  )

  const handleRejectSuggestion = useCallback(
    ({ suggestionId }: { suggestionId: string }) => {
      editorRef.current?.commands.rejectAiSuggestion(suggestionId)
      setSuggestionResolution({ suggestionId, status: 'rejected' })
      const suggestions = editorRef.current
        ? aiSuggestionsKey.getState(editorRef.current.state)?.suggestions ?? []
        : []
      setPendingSuggestionCount(suggestions.length)
      setPendingSuggestionIds(suggestions.map((suggestion) => suggestion.suggestionId))
    },
    [setPendingSuggestionCount, setPendingSuggestionIds, setSuggestionResolution]
  )

  const handleAcceptAllSuggestions = useCallback(() => {
    const ids = useDocumentStore.getState().pendingSuggestionIds
    editorRef.current?.commands.acceptAllAiSuggestions()
    recordSuggestionResolutions({ suggestionIds: ids, status: 'accepted' })
    setDirty(true)
    setPendingSuggestionCount(0)
    setPendingSuggestionIds([])
  }, [recordSuggestionResolutions, setDirty, setPendingSuggestionCount, setPendingSuggestionIds])

  const handleRejectAllSuggestions = useCallback(() => {
    const ids = useDocumentStore.getState().pendingSuggestionIds
    editorRef.current?.commands.rejectAllAiSuggestions()
    recordSuggestionResolutions({ suggestionIds: ids, status: 'rejected' })
    setPendingSuggestionCount(0)
    setPendingSuggestionIds([])
  }, [recordSuggestionResolutions, setPendingSuggestionCount, setPendingSuggestionIds])

  const handleFocusSuggestion = useCallback(({ suggestionId }: { suggestionId: string }) => {
    setViewMode('edit')
    const editor = editorRef.current
    if (!editor) return

    const suggestion = aiSuggestionsKey
      .getState(editor.state)
      ?.suggestions.find((entry) => entry.suggestionId === suggestionId)

    editor.commands.focusAiSuggestion(suggestionId)

    if (suggestion) {
      scrollNonce.current += 1
      setScrollToPos({ pos: suggestion.from, nonce: scrollNonce.current })
    }
  }, [setViewMode])

  const flatOutline = flattenOutline(outline)
  const outlineTexts = flatOutline.map((i) => ({ text: i.text, pos: i.pos }))

  const showTiptapEditor = viewMode === 'edit'
  const showMarkdownSource = viewMode === 'markdown' || viewMode === 'split'
  const showPreview = viewMode === 'preview' || viewMode === 'split'

  return (
    <div
      className="flex h-full flex-col"
      data-testid="document-window"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleFileDrop}
    >
      {/* App toolbar */}
      <Toolbar onSearchOpen={() => setSearchOpen(true)} />

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {sidebarVisible && (
          <OutlineSidebar
            onJumpTo={handleJumpToOutline}
            onReorder={handleOutlineReorder}
            onIndent={(item) => handleOutlineNestingShift({ item, delta: 1 })}
            onOutdent={(item) => handleOutlineNestingShift({ item, delta: -1 })}
            onNumberingOverrideChange={() => void persistAndApplyNumbering()}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Tiptap editor — always mounted so outline stays tied to one ProseMirror doc */}
          <div className={`h-full overflow-hidden ${showTiptapEditor ? 'w-full' : 'hidden'}`}>
            <MarkdocEditor
              key={filePath ?? 'untitled'}
              content={markdown}
              onEditorReady={handleEditorReady}
              onContentChange={handleEditorContentChange}
              scrollToPos={scrollToPos}
              onInsertImage={handleOpenImageDialog}
              onAskAssistant={handleAskAssistant}
              onHeadingClick={handleJumpToHeadingId}
              onSelectionChange={({ hasSelection: selected }) => setHasSelection(selected)}
            />
          </div>

          {showMarkdownSource && (
            <div
              className={`h-full overflow-hidden ${
                viewMode === 'split' ? 'w-1/2 border-r border-border-subtle' : 'w-full'
              }`}
            >
              <MarkdownSourceEditor
                value={markdown}
                onChange={handleMarkdownSourceChange}
                scrollToChar={scrollToChar}
                scrollRatio={viewMode === 'split' ? splitScrollRatio : null}
                onScrollRatio={viewMode === 'split' ? setSplitScrollRatio : undefined}
              />
            </div>
          )}

          {showPreview && (
            <div className={`h-full overflow-hidden ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <PreviewPane
                html={previewHtml || '<p></p>'}
                scrollRatio={viewMode === 'split' ? splitScrollRatio : null}
                onScrollRatio={viewMode === 'split' ? setSplitScrollRatio : undefined}
                onHeadingClick={handleJumpToHeadingId}
              />
            </div>
          )}
        </div>

        {rightPanel === 'assistant' && (
          <AssistantPanel
            sessionId={documentSessionId}
            hasSelection={hasSelection}
            isDocumentEmpty={wordCount === 0}
            prefillText={assistantPrefill}
            onPrefillConsumed={() => setAssistantPrefill(null)}
            onHeadingClick={handleJumpToHeadingId}
            onOpenPreferences={handleOpenPreferences}
            pendingSuggestionCount={pendingSuggestionCount}
            pendingSuggestionIds={pendingSuggestionIds}
            suggestionResolutions={suggestionResolutions}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onAcceptAllSuggestions={handleAcceptAllSuggestions}
            onRejectAllSuggestions={handleRejectAllSuggestions}
            onFocusSuggestion={handleFocusSuggestion}
          />
        )}

        {rightPanel === 'documentOptions' && (
          <DocumentOptionsPanel onNumberingChange={() => void persistAndApplyNumbering()} />
        )}
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <SearchOverlay
          markdown={markdown}
          outlineTexts={outlineTexts}
          onSelect={(pos, query) => handleSearchJump(pos, query?.length ?? 0)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {imageInsertOpen && (
        <ImageInsertDialog
          onInsertLocal={handleInsertLocalImage}
          onInsertUrl={handleInsertUrlImage}
          onClose={() => setImageInsertOpen(false)}
        />
      )}

      {findReplaceOpen && (
        <FindReplaceDialog
          markdown={markdown}
          onReplace={async ({ markdown: md }) => {
            setMarkdown(md)
            await syncIndexFromMarkdown(md)
            await syncPreviewFromMarkdown(md)
          }}
          onClose={() => setFindReplaceOpen(false)}
        />
      )}

      {stylePanelOpen && filePath && (
        <StyleOverridesPanel
          overrides={styleDraft}
          onSave={async ({ overrides }) => {
            if (!window.markdoc) return
            await window.markdoc.saveStyleOverrides({ documentPath: filePath, overrides })
            const loaded = await window.markdoc.loadStyleOverrides(filePath)
            setStyleOverrides(loaded)
            setStyleDraft(overrides)
            setStylePanelOpen(false)
          }}
          onReset={async () => {
            if (!window.markdoc || !filePath) return
            await window.markdoc.resetStyleOverrides(filePath)
            setStyleOverrides({})
            setStyleDraft({ version: 1 })
            setStylePanelOpen(false)
          }}
          onClose={() => setStylePanelOpen(false)}
        />
      )}

      {brokenImages.length > 0 && (
        <div className="border-t border-[var(--status-warning)] bg-[var(--status-warning)]/10 px-3 py-1 text-[11px] text-[var(--status-warning)]">
          {brokenImages.length} broken image reference(s) in this document
        </div>
      )}

      {/* Export dialog */}
      {exportOpen && (
        <ExportDialog
          editor={editorRef.current}
          filePath={filePath}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
