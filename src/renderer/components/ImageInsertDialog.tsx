import { useState } from 'react'
import { ImageIcon, Link, X } from 'lucide-react'
import { isValidImageUrl } from '@shared/image-src'

type InsertMode = 'file' | 'url'

interface ImageInsertDialogProps {
  onInsertLocal: ({ alt }: { alt: string }) => Promise<void>
  onInsertUrl: ({ url, alt }: { url: string; alt: string }) => void
  onClose: () => void
}

/**
 * Dialog for inserting a local file image or a remote URL image.
 */
export function ImageInsertDialog({ onInsertLocal, onInsertUrl, onClose }: ImageInsertDialogProps) {
  const [mode, setMode] = useState<InsertMode>('file')
  const [alt, setAlt] = useState('')
  const [url, setUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInsert = async () => {
    setError(null)

    if (mode === 'file') {
      setIsImporting(true)
      try {
        await onInsertLocal({ alt })
        onClose()
      } catch (insertError) {
        setError((insertError as Error).message ?? 'Failed to insert image')
      } finally {
        setIsImporting(false)
      }
      return
    }

    if (!isValidImageUrl({ url })) {
      setError('Enter a valid http or https image URL.')
      return
    }

    onInsertUrl({ url: url.trim(), alt })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={onClose}
      data-testid="image-insert-dialog"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert image"
        className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-primary shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon size={16} aria-hidden />
            Insert Image
          </div>
          <button
            type="button"
            className="toolbar-icon-btn toolbar-icon-btn--header"
            onClick={onClose}
            aria-label="Close image dialog"
          >
            <X />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 border-b border-border-subtle px-4 py-2">
          <button
            type="button"
            className={`rounded px-2 py-1 text-[11px] ${mode === 'file' ? 'bg-accent/15 text-accent' : 'text-content-secondary'}`}
            onClick={() => setMode('file')}
          >
            From Computer
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-[11px] ${mode === 'url' ? 'bg-accent/15 text-accent' : 'text-content-secondary'}`}
            onClick={() => setMode('url')}
          >
            From URL
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3 px-4 py-4">
          {mode === 'file' ? (
            <p className="text-[11px] text-content-secondary">
              The image will be copied into this document&apos;s asset folder and saved using a
              relative path, so it keeps working when you move or share the file.
            </p>
          ) : (
            <label className="block text-[11px] text-content-secondary">
              Image URL
              <div className="mt-1 flex items-center gap-2">
                <Link size={14} className="text-content-secondary" aria-hidden />
                <input
                  type="url"
                  className="flex-1 rounded border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none"
                  placeholder="https://example.com/image.png"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  data-testid="image-url-input"
                />
              </div>
            </label>
          )}

          <label className="block text-[11px] text-content-secondary">
            Alt text
            <input
              type="text"
              className="mt-1 w-full rounded border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none"
              placeholder="Describe the image"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              data-testid="image-alt-input"
            />
          </label>

          {error && (
            <p className="text-[11px] text-[var(--status-warning)]" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            className="rounded px-3 py-1 text-[11px] text-content-secondary hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-1 text-[11px] text-white disabled:opacity-50"
            onClick={() => void handleInsert()}
            disabled={isImporting}
            data-testid="image-insert-confirm"
          >
            {isImporting ? 'Importing…' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  )
}
