import { columnIsHeader, rowIsHeader, selectedRect } from '@tiptap/pm/tables'
import { BubbleMenu } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Grid2x2X,
  PanelLeft,
  PanelTop,
  Square,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from 'lucide-react'

interface TableBubbleMenuProps {
  editor: Editor
}

interface TableMenuAction {
  can: (editor: Editor) => boolean
  icon: LucideIcon
  label: string
  onClick: (editor: Editor) => void
  /** Whether the action represents a currently-applied toggle, for active/pressed styling */
  isActive?: (editor: Editor) => boolean
  danger?: boolean
  /** Actions sharing a group are rendered together, separated by hairlines */
  group: 'columns' | 'rows' | 'headers' | 'cells' | 'table'
}

/** Whether every cell in the row containing the selection is already a header cell */
function isHeaderRowActive(editor: Editor): boolean {
  try {
    const rect = selectedRect(editor.state)
    return rowIsHeader(rect.map, rect.table, rect.top)
  } catch {
    return false
  }
}

/** Whether every cell in the column containing the selection is already a header cell */
function isHeaderColumnActive(editor: Editor): boolean {
  try {
    const rect = selectedRect(editor.state)
    return columnIsHeader(rect.map, rect.table, rect.left)
  } catch {
    return false
  }
}

const TABLE_MENU_ACTIONS: TableMenuAction[] = [
  {
    can: (editor) => editor.can().addColumnBefore(),
    icon: BetweenVerticalStart,
    label: 'Add column left',
    onClick: (editor) => editor.chain().focus().addColumnBefore().run(),
    group: 'columns',
  },
  {
    can: (editor) => editor.can().addColumnAfter(),
    icon: BetweenVerticalEnd,
    label: 'Add column right',
    onClick: (editor) => editor.chain().focus().addColumnAfter().run(),
    group: 'columns',
  },
  {
    can: (editor) => editor.can().deleteColumn(),
    icon: Trash2,
    label: 'Delete column',
    onClick: (editor) => editor.chain().focus().deleteColumn().run(),
    group: 'columns',
  },
  {
    can: (editor) => editor.can().addRowBefore(),
    icon: BetweenHorizontalStart,
    label: 'Add row above',
    onClick: (editor) => editor.chain().focus().addRowBefore().run(),
    group: 'rows',
  },
  {
    can: (editor) => editor.can().addRowAfter(),
    icon: BetweenHorizontalEnd,
    label: 'Add row below',
    onClick: (editor) => editor.chain().focus().addRowAfter().run(),
    group: 'rows',
  },
  {
    can: (editor) => editor.can().deleteRow(),
    icon: Trash2,
    label: 'Delete row',
    onClick: (editor) => editor.chain().focus().deleteRow().run(),
    group: 'rows',
  },
  {
    can: (editor) => editor.can().toggleHeaderRow(),
    icon: PanelTop,
    label: 'Toggle header row',
    onClick: (editor) => editor.chain().focus().toggleHeaderRow().run(),
    isActive: isHeaderRowActive,
    group: 'headers',
  },
  {
    can: (editor) => editor.can().toggleHeaderColumn(),
    icon: PanelLeft,
    label: 'Toggle header column',
    onClick: (editor) => editor.chain().focus().toggleHeaderColumn().run(),
    isActive: isHeaderColumnActive,
    group: 'headers',
  },
  {
    can: (editor) => editor.can().toggleHeaderCell(),
    icon: Square,
    label: 'Toggle header cell',
    onClick: (editor) => editor.chain().focus().toggleHeaderCell().run(),
    isActive: (editor) => editor.isActive('tableHeader'),
    group: 'headers',
  },
  {
    can: (editor) => editor.can().mergeCells(),
    icon: TableCellsMerge,
    label: 'Merge cells',
    onClick: (editor) => editor.chain().focus().mergeCells().run(),
    group: 'cells',
  },
  {
    can: (editor) => editor.can().splitCell(),
    icon: TableCellsSplit,
    label: 'Split cell',
    onClick: (editor) => editor.chain().focus().splitCell().run(),
    group: 'cells',
  },
  {
    can: (editor) => editor.can().deleteTable(),
    icon: Grid2x2X,
    label: 'Delete table',
    onClick: (editor) => editor.chain().focus().deleteTable().run(),
    danger: true,
    group: 'table',
  },
]

/**
 * Context-aware table controls shown when the selection is inside a table.
 */
export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  const visibleActions = TABLE_MENU_ACTIONS.filter((action) => action.can(editor))

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: 'top', maxWidth: 'none' }}
      shouldShow={({ editor: ed }) => ed.isActive('table')}
    >
      <div
        className="no-drag flex w-max items-center gap-px rounded-md border border-border-subtle bg-surface-primary p-0.5 shadow-md"
        data-testid="table-bubble-menu"
      >
        {visibleActions.map((action, index) => {
          const Icon = action.icon
          const startsNewGroup = index > 0 && visibleActions[index - 1].group !== action.group
          const active = action.isActive?.(editor) ?? false

          return (
            <span key={action.label} className="flex items-center gap-px">
              {startsNewGroup && <span className="toolbar-separator" aria-hidden />}
              <button
                type="button"
                className={`toolbar-icon-btn ${active ? 'toolbar-icon-btn--active' : ''} ${action.danger ? 'toolbar-icon-btn--danger' : ''}`}
                onClick={() => action.onClick(editor)}
                aria-label={action.label}
                aria-pressed={action.isActive ? active : undefined}
                title={action.label}
              >
                <Icon />
              </button>
            </span>
          )
        })}
      </div>
    </BubbleMenu>
  )
}
