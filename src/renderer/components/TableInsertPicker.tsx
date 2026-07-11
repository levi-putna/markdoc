import { useState } from 'react'
import { Table } from 'lucide-react'
import type { Editor } from '@tiptap/react'

const GRID_SIZE = 10

interface TableInsertPickerProps {
  editor: Editor
}

/**
 * Google Docs-style table size picker (up to 10×10).
 */
export function TableInsertPicker({ editor }: TableInsertPickerProps) {
  const [open, setOpen] = useState(false)
  const [hoverRows, setHoverRows] = useState(0)
  const [hoverCols, setHoverCols] = useState(0)

  const insertTable = ({ rows, cols }: { rows: number; cols: number }) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    setOpen(false)
    setHoverRows(0)
    setHoverCols(0)
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className="toolbar-icon-btn"
        onClick={() => setOpen((current) => !current)}
        aria-label="Insert table"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Insert table"
        data-testid="table-insert-picker"
      >
        <Table />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close table picker"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-border-subtle bg-surface-primary p-3 shadow-lg">
            <p className="mb-2 text-center text-[11px] text-content-secondary">
              {hoverRows > 0 && hoverCols > 0 ? `${hoverCols} × ${hoverRows}` : 'Insert table'}
            </p>

            {/* Size grid */}
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 16px)` }}
              onMouseLeave={() => {
                setHoverRows(0)
                setHoverCols(0)
              }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                const row = Math.floor(index / GRID_SIZE) + 1
                const col = (index % GRID_SIZE) + 1
                const highlighted = row <= hoverRows && col <= hoverCols

                return (
                  <button
                    key={index}
                    type="button"
                    className={`h-4 w-4 rounded-sm border ${
                      highlighted
                        ? 'border-accent bg-accent/25'
                        : 'border-border-subtle bg-black/5 dark:bg-white/5'
                    }`}
                    onMouseEnter={() => {
                      setHoverRows(row)
                      setHoverCols(col)
                    }}
                    onClick={() => insertTable({ rows: row, cols: col })}
                    aria-label={`Insert ${col} by ${row} table`}
                  />
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
