import { ChevronRight, FoldVertical, UnfoldVertical } from 'lucide-react'
import { useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flattenOutline } from '@shared/document-index'
import type { FlatOutlineItem, OutlineNode } from '@shared/types'
import { useDocumentStore } from '../store/document-store'
import { OutlineHeadingBadge } from './OutlineHeadingBadge'

interface OutlineSidebarProps {
  onJumpTo: (item: FlatOutlineItem) => void
  onReorder?: ({
    activeItem,
    overItem,
  }: {
    activeItem: FlatOutlineItem
    overItem: FlatOutlineItem
  }) => void
}

const TREE_INDENT_PX = 12

/**
 * Left-hand document outline sidebar with collapsible tree and drag-and-drop reordering.
 */
export function OutlineSidebar({ onJumpTo, onReorder }: OutlineSidebarProps) {
  const {
    outline,
    activeHeadingId,
    collapsedOutlineIds,
    toggleOutlineCollapse,
    expandAllOutline,
    collapseAllOutline,
    sidebarWidth,
    setSidebarWidth,
  } = useDocumentStore()

  const flatItems = flattenOutline(outline, { collapsedIds: collapsedOutlineIds })
  const didDragRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = () => {
    didDragRef.current = true
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

    onReorder({ activeItem, overItem })
    requestAnimationFrame(() => {
      didDragRef.current = false
    })
  }

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
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={flatItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {flatItems.map((item) => (
                <SortableOutlineRow
                  key={item.id}
                  item={item}
                  isActive={activeHeadingId === item.id}
                  hasChildren={(findInTree(outline, item.id)?.children.length ?? 0) > 0}
                  onToggleCollapse={() => toggleOutlineCollapse(item.id)}
                  onJump={() => {
                    if (didDragRef.current) return
                    onJumpTo(item)
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/30"
        aria-hidden
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startWidth = sidebarWidth
          // Suppress text selection and keep the resize cursor while dragging
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
    </aside>
  )
}

interface SortableOutlineRowProps {
  item: FlatOutlineItem
  isActive: boolean
  hasChildren: boolean
  onToggleCollapse: () => void
  onJump: () => void
}

/**
 * A single sortable row in the outline tree.
 */
function SortableOutlineRow({
  item,
  isActive,
  hasChildren,
  onToggleCollapse,
  onJump,
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
      aria-label={`${item.text || 'Untitled'}, heading ${item.level}`}
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
        <OutlineHeadingBadge level={item.level} />
        <span className="outline-tree-row__text truncate">{item.text || 'Untitled'}</span>
      </div>
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
