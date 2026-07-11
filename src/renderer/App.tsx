import { useState, useEffect, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useDocumentStore } from './store/document-store'
import { Toolbar } from './components/Toolbar'
import { OutlineSidebar } from './components/OutlineSidebar'
import { MarkdocEditor } from './components/MarkdocEditor'
import { MarkdownSourceEditor } from './components/MarkdownSourceEditor'
import { PreviewPane } from './components/PreviewPane'
import { SearchOverlay, useSearchShortcut } from './components/SearchOverlay'
import { PreferencesPage } from './components/PreferencesPage'
import { flattenOutline } from '@shared/document-index'
import { findHeadingCharOffset } from '@shared/markdown-highlight'
import { loadMarkdownIntoEditor } from '@shared/markdown'
import {
  moveSectionInEditor,
  syncDocumentIndexFromEditor,
} from '@shared/outline-sync'
import type { FlatOutlineItem } from '@shared/types'

/**
 * Applies the light/dark theme class from preferences + system appearance.
 * Shared by every window (document and preferences) so they stay in sync.
 */
function useAppTheme() {
  useEffect(() => {
    const applyTheme = ({
      shouldUseDarkColors,
      appearance,
    }: {
      shouldUseDarkColors: boolean
      appearance: string
    }) => {
      const isDark =
        appearance === 'dark' || (appearance === 'system' && shouldUseDarkColors)
      document.documentElement.classList.toggle('dark', isDark)
    }

    window.markdoc?.getTheme().then(applyTheme)

    const unsubTheme = window.markdoc?.onThemeChanged(({ shouldUseDarkColors }) => {
      const appearance = useDocumentStore.getState().preferences.appearance
      applyTheme({ shouldUseDarkColors, appearance })
    })
    const unsubPrefs = window.markdoc?.onPreferencesChanged((prefs) => {
      useDocumentStore.getState().setPreferences(prefs)
      window.markdoc
        ?.getTheme()
        .then(({ shouldUseDarkColors }) =>
          applyTheme({ shouldUseDarkColors, appearance: prefs.appearance })
        )
    })

    return () => {
      unsubTheme?.()
      unsubPrefs?.()
    }
  }, [])
}

/**
 * Main document window layout composing toolbar, sidebar, editor, and preview.
 */
export function App() {
  const isPreferences = window.location.hash === '#/preferences'

  useAppTheme()

  if (isPreferences) {
    return <PreferencesPage />
  }

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
    setSearchOpen,
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
    setWordCount,
    setDocumentTier,
  } = useDocumentStore()

  const [previewHtml, setPreviewHtml] = useState('')
  const [scrollToPos, setScrollToPos] = useState<number | null>(null)
  const [scrollToChar, setScrollToChar] = useState<number | null>(null)
  const [previewScrollTop, setPreviewScrollTop] = useState(0)
  const editorRef = useRef<Editor | null>(null)
  const recoveryInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useSearchShortcut()

  const syncPreviewFromMarkdown = useCallback((md: string) => {
    const editor = loadMarkdownIntoEditor(md)
    setPreviewHtml(editor.getHTML())
    editor.destroy()
  }, [])

  const syncIndexFromMarkdown = useCallback(
    (md: string) => {
      const editor = loadMarkdownIntoEditor(md)
      const { outline: nextOutline, wordCount, documentTier } = syncDocumentIndexFromEditor({
        editor,
      })
      setOutline(nextOutline)
      setWordCount(wordCount)
      setDocumentTier(documentTier)
      editor.destroy()
    },
    [setOutline, setWordCount, setDocumentTier]
  )

  // Load preferences on mount (theme handling lives in useAppTheme)
  useEffect(() => {
    window.markdoc?.getPreferences().then(setPreferences)
  }, [setPreferences])

  // Apply editor font and sidebar density preferences
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
  // button, represented file proxy icon, window title)
  useEffect(() => {
    window.markdoc?.setWindowDirtyState({ isDirty, filePath })
    const fileName = filePath?.split('/').pop()
    document.title = fileName ?? 'Untitled'
  }, [isDirty, filePath])

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
    async (path: string) => {
      if (!window.markdoc) return

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
      syncPreviewFromMarkdown(content)
      syncIndexFromMarkdown(content)
      setFilePath(path)
      setFrontMatter(result.frontMatter)
      setDirty(false)
      await window.markdoc.watchFile(path)
    },
    [setMarkdown, syncPreviewFromMarkdown, syncIndexFromMarkdown]
  )

  const handleSave = useCallback(async () => {
    if (!window.markdoc) return
    const path = filePath ?? (await window.markdoc.saveAsDialog('Untitled.md'))
    if (!path) return

    await window.markdoc.writeFile({ filePath: path, markdown, frontMatter })
    setFilePath(path)
    setDirty(false)
    await window.markdoc.clearRecovery(path)
  }, [markdown, filePath, frontMatter])

  const handleSaveAs = useCallback(async () => {
    if (!window.markdoc) return
    const path = await window.markdoc.saveAsDialog(filePath?.split('/').pop() ?? 'Untitled.md')
    if (!path) return
    await window.markdoc.writeFile({ filePath: path, markdown, frontMatter })
    setFilePath(path)
    setDirty(false)
  }, [markdown, filePath, frontMatter])

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
      window.markdoc.onMenuAction('view-mode', (mode) =>
        useDocumentStore.getState().setViewMode(mode as 'edit' | 'markdown' | 'preview' | 'split')
      ),
      window.markdoc.onMenuAction('find', () => setSearchOpen(true)),
      window.markdoc.onFileOpenRequested((path) => loadFile(path)),
      window.markdoc.onFileChangedExternal((path) => {
        if (path === filePath) {
          const shouldReload = window.confirm(
            'This file was changed outside MarkDoc.\n\nReload it from disk? Your unsaved changes will be lost.'
          )
          if (shouldReload) loadFile(path)
        }
      }),
    ]

    return () => unsubs.forEach((u) => u?.())
  }, [filePath, handleSave, handleSaveAs, loadFile, setSearchOpen])

  const handleEditorReady = useCallback(({ editor }: { editor: Editor }) => {
    editorRef.current = editor
  }, [])

  const handleEditorContentChange = useCallback(
    ({ html }: { markdown: string; html: string }) => {
      setPreviewHtml(html)
    },
    []
  )

  const handleMarkdownSourceChange = useCallback(
    ({ markdown: md }: { markdown: string }) => {
      setMarkdown(md)
      syncIndexFromMarkdown(md)
      syncPreviewFromMarkdown(md)
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

      setScrollToPos(item.pos)
      setTimeout(() => setScrollToPos(null), 100)
    },
    [markdown, viewMode]
  )

  const handleSearchJump = useCallback(
    (charOffset: number) => {
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
    [viewMode]
  )

  const handleOutlineReorder = useCallback(
    ({
      activeItem,
      overItem,
    }: {
      activeItem: FlatOutlineItem
      overItem: FlatOutlineItem
    }) => {
      const editor = editorRef.current
      if (!editor) return

      moveSectionInEditor({ editor, activeItem, overItem })
      setDirty(true)
    },
    []
  )

  const flatOutline = flattenOutline(outline)
  const outlineTexts = flatOutline.map((i) => ({ text: i.text, pos: i.pos }))

  const showTiptapEditor = viewMode === 'edit'
  const showMarkdownSource = viewMode === 'markdown' || viewMode === 'split'
  const showPreview = viewMode === 'preview' || viewMode === 'split'

  return (
    <div className="flex h-full flex-col" data-testid="document-window">
      {/* App toolbar */}
      <Toolbar onSearchOpen={() => setSearchOpen(true)} />

      {/* Main content area */}
      <div className="relative flex flex-1 overflow-hidden">
        {sidebarVisible && (
          <OutlineSidebar onJumpTo={handleJumpToOutline} onReorder={handleOutlineReorder} />
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
              />
            </div>
          )}

          {showPreview && (
            <div className={`h-full overflow-hidden ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <PreviewPane
                html={previewHtml || '<p></p>'}
                scrollTop={viewMode === 'split' ? previewScrollTop : undefined}
                onScroll={viewMode === 'split' ? setPreviewScrollTop : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <SearchOverlay
          markdown={markdown}
          outlineTexts={outlineTexts}
          onSelect={handleSearchJump}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
