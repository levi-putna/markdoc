import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import {
  BLOCK_TYPE_OPTIONS,
  getActiveBlockType,
  getBlockTypeIcon,
  getBlockTypeLabel,
  setBlockType,
  type BlockTypeId,
} from '../utils/block-type'

interface BlockTypeSelectProps {
  editor: Editor
}

/**
 * Block-type dropdown that reflects the block at the current cursor position.
 */
export function BlockTypeSelect({ editor }: BlockTypeSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeType, setActiveType] = useState<BlockTypeId>('paragraph')

  useEffect(() => {
    const refresh = () => setActiveType(getActiveBlockType({ editor }))
    refresh()
    editor.on('selectionUpdate', refresh)
    editor.on('transaction', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('transaction', refresh)
    }
  }, [editor])

  const ActiveIcon = getBlockTypeIcon({ blockType: activeType })

  return (
    <div
      className="relative flex items-center"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className="no-drag toolbar-block-type-btn"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="block-type-select"
      >
        {/* Block type icon + label */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <ActiveIcon className="shrink-0" aria-hidden />
          <span className="truncate">{getBlockTypeLabel({ blockType: activeType })}</span>
        </span>
        <ChevronDown className="shrink-0 text-content-secondary" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close block type menu"
            onClick={() => setOpen(false)}
          />
          <ul
            className="absolute left-0 top-full z-50 mt-1 max-h-64 w-44 overflow-y-auto rounded-md border border-border-subtle bg-surface-primary py-1 shadow-lg"
            role="listbox"
          >
            {BLOCK_TYPE_OPTIONS.map((option) => {
              const OptionIcon = option.icon

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeType === option.id}
                    className={`flex w-full items-center gap-2 px-2.5 py-1 text-left text-[11px] hover:bg-black/5 dark:hover:bg-white/10 ${
                      activeType === option.id ? 'bg-accent/10 text-accent' : 'text-content-text'
                    }`}
                    onClick={() => {
                      setBlockType({ editor, blockType: option.id })
                      setActiveType(option.id)
                      setOpen(false)
                    }}
                  >
                    <OptionIcon className="shrink-0" size={14} aria-hidden />
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
