import { PanelLeft, Search } from 'lucide-react'
import type { ViewMode } from '@shared/ipc'
import { useDocumentStore } from '../store/document-store'

interface ToolbarProps {
  onSearchOpen: () => void
}

const VIEW_MODES: { mode: ViewMode; label: string; shortcut: string }[] = [
  { mode: 'edit', label: 'Edit', shortcut: '⌘1' },
  { mode: 'markdown', label: 'Markdown', shortcut: '⌘2' },
  { mode: 'preview', label: 'Preview', shortcut: '⌘3' },
  { mode: 'split', label: 'Split', shortcut: '⌘4' },
]

/**
 * Native-style unified title bar toolbar with view toggle and sidebar control.
 */
export function Toolbar({ onSearchOpen }: ToolbarProps) {
  const {
    viewMode,
    setViewMode,
    sidebarVisible,
    toggleSidebar,
    isDirty,
    wordCount,
    documentTier,
    largeDocModeDismissed,
    dismissLargeDocMode,
    filePath,
  } = useDocumentStore()

  const title = filePath ? filePath.split('/').pop() : 'Untitled'
  const showLargeDocBadge = documentTier !== 'standard' && !largeDocModeDismissed

  /**
   * Moves the active view mode left/right with arrow keys (standard macOS
   * segmented-control keyboard behaviour).
   */
  const handleTabKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const currentIndex = VIEW_MODES.findIndex(({ mode }) => mode === viewMode)
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = VIEW_MODES[(currentIndex + delta + VIEW_MODES.length) % VIEW_MODES.length]
    setViewMode(next.mode)
  }

  return (
    <header
      className="toolbar-header drag-region grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border-subtle px-3"
      data-testid="toolbar"
    >
      {/* Left cluster — traffic lights + sidebar; empty space stays draggable */}
      <div className="flex min-w-0 items-center">
        <div className="w-20 shrink-0" aria-hidden />
        <button
          type="button"
          className="toolbar-icon-btn toolbar-icon-btn--header no-drag"
          onClick={toggleSidebar}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          aria-pressed={sidebarVisible}
          title="Toggle Sidebar (⌘\)"
          data-testid="sidebar-toggle"
        >
          <PanelLeft />
        </button>
      </div>

      {/* Centred view mode tabs — only the control strip is non-draggable */}
      <div className="flex justify-center" data-testid="view-toggle">
        <div
          className="view-mode-tabs no-drag"
          role="tablist"
          aria-label="View mode"
          onKeyDown={handleTabKeyDown}
        >
          {VIEW_MODES.map(({ mode, label, shortcut }) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              tabIndex={viewMode === mode ? 0 : -1}
              className={`view-mode-tab ${viewMode === mode ? 'view-mode-tab--active' : ''}`}
              onClick={() => setViewMode(mode)}
              title={`${label} (${shortcut})`}
              data-testid={`view-${mode}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right cluster — status labels are draggable; controls are not */}
      <div className="flex min-w-0 items-center justify-end gap-2">
        {showLargeDocBadge && (
          <button
            type="button"
            className="no-drag rounded-full bg-[var(--status-warning)]/20 px-2 py-0.5 text-[11px] text-[var(--status-warning)]"
            onClick={dismissLargeDocMode}
            data-testid="large-doc-indicator"
            title="Large Document Mode — some live features run at a reduced frequency for performance. Click to dismiss."
          >
            Large doc
          </button>
        )}
        <span
          className="text-[11px] text-content-secondary [font-variant-numeric:tabular-nums]"
          data-testid="word-count"
        >
          {wordCount.toLocaleString()} words
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-[120px] truncate text-[11px] text-content-secondary">{title}</span>
          {/* Unsaved-changes indicator — mirrors the dot in the close button */}
          {isDirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-content-secondary"
              role="status"
              aria-label="Unsaved changes"
              title="Unsaved changes"
            />
          )}
        </span>
        <button
          type="button"
          className="toolbar-icon-btn toolbar-icon-btn--header no-drag"
          onClick={onSearchOpen}
          aria-label="Search document"
          title="Find (⌘F)"
          data-testid="search-toggle"
        >
          <Search />
        </button>
      </div>
    </header>
  )
}
