import { Check, ChevronRight, FoldVertical, UnfoldVertical, Layers } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flattenOutline } from '@shared/document-index'
import {
  canIndentOutlineItem,
  canOutdentOutlineItem,
  isValidDrop,
  projectDropDepth,
} from '@shared/outline-drag'
import type { FlatOutlineItem, OutlineNode } from '@shared/types'
import {
  ALPHA_ROMAN_HYBRID_FORMATS,
  stripNumberingPrefix,
  type DisplayMode,
  type HeadingNumberingOverride,
  type NumberingPreset,
} from '@shared/heading-numbering'
import { useDocumentStore } from '../store/document-store'
import { OutlineHeadingBadge } from './OutlineHeadingBadge'

interface OutlineSidebarProps {
  onJumpTo: (item: FlatOutlineItem) => void
  onReorder?: ({
    activeItem,
    overItem,
    projectedDepth,
  }: {
    activeItem: FlatOutlineItem
    overItem: FlatOutlineItem
    projectedDepth: number
  }) => void
  /** Indent heading under the sibling above (demote). */
  onIndent?: (item: FlatOutlineItem) => void
  /** Outdent heading to a peer of its parent (promote). */
  onOutdent?: (item: FlatOutlineItem) => void
  /** Called after a numbering override changes so the parent can persist + re-sync. */
  onNumberingOverrideChange?: () => void
}

const TREE_INDENT_PX = 12

interface ContextMenuState {
  headingId: string
  x: number
  y: number
}

/**
 * Left-hand document outline sidebar with collapsible tree and drag-and-drop reordering.
 */
export function OutlineSidebar({
  onJumpTo,
  onReorder,
  onIndent,
  onOutdent,
  onNumberingOverrideChange,
}: OutlineSidebarProps) {
  const {
    outline,
    activeHeadingId,
    collapsedOutlineIds,
    toggleOutlineCollapse,
    expandAllOutline,
    collapseAllOutline,
    sidebarWidth,
    setSidebarWidth,
    numberingConfig,
    numberingOverrides,
    headingNumbers,
    setHeadingNumberingOverride,
  } = useDocumentStore()

  const flatItems = flattenOutline(outline, { collapsedIds: collapsedOutlineIds })
  const didDragRef = useRef(false)
  const dragDeltaXRef = useRef(0)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = () => {
    didDragRef.current = true
    dragDeltaXRef.current = 0
  }

  const handleDragMove = (event: DragMoveEvent) => {
    dragDeltaXRef.current = event.delta.x
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) {
      requestAnimationFrame(() => {
        didDragRef.current = false
      })
      return
    }

    const activeItem = flatItems.find((i) => i.id === active.id)
    const overItem = flatItems.find((i) => i.id === over.id)
    if (!activeItem || !overItem) {
      requestAnimationFrame(() => {
        didDragRef.current = false
      })
      return
    }

    const projectedDepth = projectDropDepth({
      activeDepth: activeItem.depth,
      deltaX: dragDeltaXRef.current,
    })

    if (!isValidDrop({ activeItem, overItem, projectedDepth, flatItems })) {
      requestAnimationFrame(() => {
        didDragRef.current = false
      })
      return
    }

    onReorder({ activeItem, overItem, projectedDepth })
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `Moved "${activeItem.text}" to level ${projectedDepth + 1}`
    }
    requestAnimationFrame(() => {
      didDragRef.current = false
    })
  }

  /**
   * Applies or clears a subtree numbering override for a heading.
   */
  const applyOverride = useCallback(
    ({
      headingId,
      override,
    }: {
      headingId: string
      override: HeadingNumberingOverride | null
    }) => {
      setHeadingNumberingOverride({ headingId, override })
      setContextMenu(null)
      onNumberingOverrideChange?.()
    },
    [setHeadingNumberingOverride, onNumberingOverrideChange]
  )

  useEffect(() => {
    if (!contextMenu) return
    // Drop a leftover menu if numbering was turned off while it was open.
    if (!numberingConfig.enabled) {
      setContextMenu(null)
      return
    }
    const close = () => setContextMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [contextMenu, numberingConfig.enabled])

  return (
    <aside
      className="outline-sidebar-surface relative flex h-full shrink-0 flex-col border-r border-border-subtle"
      style={{ width: sidebarWidth }}
      data-testid="outline-sidebar"
    >
      {/* Sidebar toolbar — height-matched to the editor toolbar so the two
          strips align across the sidebar/editor split */}
      <div className="sidebar-toolbar" data-testid="outline-toolbar">
        <span className="text-[11px] font-medium uppercase tracking-wide text-content-secondary">
          Outline
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={expandAllOutline}
            aria-label="Expand all sections"
            title="Expand All"
          >
            <UnfoldVertical />
          </button>
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={collapseAllOutline}
            aria-label="Collapse all sections"
            title="Collapse All"
          >
            <FoldVertical />
          </button>
        </div>
      </div>

      {/* Outline tree */}
      <div className="outline-tree flex-1 overflow-y-auto px-1 pb-1" role="tree" aria-label="Document outline">
        {flatItems.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-content-secondary">
            Headings will appear here
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={flatItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {flatItems.map((item) => {
                const numberLabel = headingNumbers[item.id]
                const bareText = numberLabel
                  ? stripNumberingPrefix({ text: item.text, displayLabel: numberLabel })
                  : item.text
                return (
                  <SortableOutlineRow
                    key={item.id}
                    item={item}
                    displayText={bareText}
                    numberLabel={numberLabel}
                    hasOverride={Boolean(numberingOverrides[item.id])}
                    numberingEnabled={numberingConfig.enabled}
                    isActive={activeHeadingId === item.id}
                    hasChildren={(findInTree(outline, item.id)?.children.length ?? 0) > 0}
                    onToggleCollapse={() => toggleOutlineCollapse(item.id)}
                    onJump={() => {
                      if (didDragRef.current) return
                      onJumpTo(item)
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      // Heading menu (nesting + numbering) only when document numbering is on.
                      if (!numberingConfig.enabled) return
                      setContextMenu({
                        headingId: item.id,
                        x: event.clientX,
                        y: event.clientY,
                      })
                    }}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div ref={liveRegionRef} className="sr-only" aria-live="polite" />

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/30"
        aria-hidden
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startWidth = sidebarWidth
          document.body.style.userSelect = 'none'
          document.body.style.cursor = 'col-resize'
          const onMove = (ev: MouseEvent) => {
            setSidebarWidth(Math.max(180, Math.min(400, startWidth + ev.clientX - startX)))
          }
          const onUp = () => {
            document.body.style.userSelect = ''
            document.body.style.cursor = ''
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
          }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
      />

      {/* Heading context menu — only when document numbering is enabled */}
      {contextMenu && numberingConfig.enabled && (
        <OutlineContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={flatItems.find((entry) => entry.id === contextMenu.headingId) ?? null}
          flatItems={flatItems}
          currentOverride={numberingOverrides[contextMenu.headingId]}
          onIndent={() => {
            const item = flatItems.find((entry) => entry.id === contextMenu.headingId)
            setContextMenu(null)
            if (item) onIndent?.(item)
          }}
          onOutdent={() => {
            const item = flatItems.find((entry) => entry.id === contextMenu.headingId)
            setContextMenu(null)
            if (item) onOutdent?.(item)
          }}
          onApplyOverride={applyOverride}
        />
      )}
    </aside>
  )
}

interface SortableOutlineRowProps {
  item: FlatOutlineItem
  displayText: string
  numberLabel?: string
  hasOverride: boolean
  numberingEnabled: boolean
  isActive: boolean
  hasChildren: boolean
  onToggleCollapse: () => void
  onJump: () => void
  onContextMenu: (event: React.MouseEvent) => void
}

/**
 * A single sortable row in the outline tree.
 */
function SortableOutlineRow({
  item,
  displayText,
  numberLabel,
  hasOverride,
  numberingEnabled,
  isActive,
  hasChildren,
  onToggleCollapse,
  onJump,
  onContextMenu,
}: SortableOutlineRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const depth = item.depth

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`outline-tree-row group ${isActive ? 'outline-tree-row--active' : ''} ${
        isDragging ? 'outline-tree-row--dragging' : ''
      }`}
      data-testid={`outline-item-${item.id}`}
      {...attributes}
      {...listeners}
      onClick={() => onJump()}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onJump()
        }
      }}
      role="treeitem"
      tabIndex={0}
      aria-level={item.level}
      aria-expanded={hasChildren ? !item.collapsed : undefined}
      aria-label={`${numberLabel ? `${numberLabel} ` : ''}${displayText || 'Untitled'}, heading ${item.level}`}
    >
      {/* Indent guides */}
      <div className="outline-tree-row__indent" aria-hidden>
        {Array.from({ length: depth }).map((_, index) => (
          <span key={index} className="outline-tree-indent" style={{ width: TREE_INDENT_PX }} />
        ))}
      </div>

      {/* Expand / collapse */}
      {hasChildren ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleCollapse()
          }}
          className="outline-tree-row__chevron"
          aria-label={item.collapsed ? 'Expand section' : 'Collapse section'}
        >
          <ChevronRight
            size={12}
            className={`transition-transform duration-100 ease-out ${item.collapsed ? '' : 'rotate-90'}`}
          />
        </button>
      ) : (
        <span className="outline-tree-row__chevron outline-tree-row__chevron--leaf" aria-hidden />
      )}

      {/* Heading badge + label */}
      <div className="outline-tree-row__label">
        {numberingEnabled && numberLabel ? (
          <span
            className={`outline-heading-badge outline-heading-badge--number outline-heading-badge--h${Math.min(item.level, 6)}`}
            aria-hidden
            title={numberLabel}
          >
            {numberLabel}
          </span>
        ) : (
          <OutlineHeadingBadge level={item.level} />
        )}
        <span className="outline-tree-row__text truncate">{displayText || 'Untitled'}</span>
        {hasOverride && (
          <span
            className="outline-tree-row__override-indicator"
            title="Custom numbering for child headings"
            aria-label="Custom numbering for child headings"
          >
            <Layers size={11} aria-hidden />
          </span>
        )}
      </div>
    </div>
  )
}

interface OutlineContextMenuProps {
  x: number
  y: number
  item: FlatOutlineItem | null
  flatItems: FlatOutlineItem[]
  currentOverride?: HeadingNumberingOverride
  onIndent: () => void
  onOutdent: () => void
  onApplyOverride: ({
    headingId,
    override,
  }: {
    headingId: string
    override: HeadingNumberingOverride | null
  }) => void
}

const PRESET_ITEMS: Array<{ preset: NumberingPreset; label: string }> = [
  { preset: 'decimal', label: 'Decimal / Legal' },
  { preset: 'classic', label: 'Classic outline' },
  { preset: 'legalMilitary', label: 'Legal / Military' },
  { preset: 'chapter', label: 'Chapter-based' },
]

const DISPLAY_ITEMS: Array<{ mode: DisplayMode; label: string }> = [
  { mode: 'full', label: 'Full path' },
  { mode: 'lastTwoSegments', label: 'Last two segments' },
  { mode: 'lastSegment', label: 'Last segment only' },
]

/**
 * Renders a menu row with an optional trailing tick when active.
 */
function OutlineMenuItem({
  label,
  hint,
  active,
  disabled,
  onClick,
  testId,
}: {
  label: string
  hint?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`outline-numbering-menu__item${
        active ? ' outline-numbering-menu__item--active' : ''
      }`}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      aria-checked={active ?? false}
    >
      <span className="outline-numbering-menu__item-body">
        <span className="outline-numbering-menu__item-label">{label}</span>
        {hint ? <span className="outline-numbering-menu__hint">{hint}</span> : null}
      </span>
      {active ? (
        <Check className="outline-numbering-menu__tick" size={14} strokeWidth={2.5} aria-hidden />
      ) : null}
    </button>
  )
}

/**
 * Context menu for outline headings — indent/outdent plus numbering overrides.
 * Only mounted when document numbering is enabled.
 */
function OutlineContextMenu({
  x,
  y,
  item,
  flatItems,
  currentOverride,
  onIndent,
  onOutdent,
  onApplyOverride,
}: OutlineContextMenuProps) {
  if (!item) return null

  const canIndent = canIndentOutlineItem({ item, flatItems })
  const canOutdent = canOutdentOutlineItem({ item })
  const usesDocumentDefault = !currentOverride
  const activePreset =
    currentOverride?.levelFormats != null ? null : (currentOverride?.preset ?? null)
  const usesAlphaRoman = Boolean(currentOverride?.levelFormats)

  return (
    <div
      className="outline-numbering-menu"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="outline-heading-menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* Nesting actions */}
      <p className="outline-numbering-menu__header">Nesting</p>
      <OutlineMenuItem
        label="Indent"
        hint="Under heading above"
        disabled={!canIndent}
        onClick={onIndent}
        testId="outline-indent"
      />
      <OutlineMenuItem
        label="Outdent"
        hint="Peer of parent"
        disabled={!canOutdent}
        onClick={onOutdent}
        testId="outline-outdent"
      />

      <div className="outline-numbering-menu__sep" />

      {/* Numbering style for this heading's children */}
      <p className="outline-numbering-menu__header">Numbering for children</p>
      <OutlineMenuItem
        label="Use document default"
        active={usesDocumentDefault}
        onClick={() => onApplyOverride({ headingId: item.id, override: null })}
      />
      {PRESET_ITEMS.map(({ preset, label }) => (
        <OutlineMenuItem
          key={preset}
          label={label}
          active={activePreset === preset}
          onClick={() => onApplyOverride({ headingId: item.id, override: { preset } })}
        />
      ))}
      <OutlineMenuItem
        label="Alpha / Roman hybrid"
        active={usesAlphaRoman}
        onClick={() =>
          onApplyOverride({
            headingId: item.id,
            override: { levelFormats: ALPHA_ROMAN_HYBRID_FORMATS },
          })
        }
      />

      <div className="outline-numbering-menu__sep" />

      {/* Display depth override */}
      <p className="outline-numbering-menu__header">Display depth</p>
      {DISPLAY_ITEMS.map(({ mode, label }) => (
        <OutlineMenuItem
          key={mode}
          label={label}
          active={currentOverride?.displayMode === mode}
          onClick={() =>
            onApplyOverride({
              headingId: item.id,
              override: { ...(currentOverride ?? {}), displayMode: mode },
            })
          }
        />
      ))}
    </div>
  )
}

function findInTree(nodes: OutlineNode[], id: string): OutlineNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findInTree(node.children, id)
    if (found) return found
  }
  return null
}
