import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import { useEffect, useState } from 'react'
import { useDocumentStore } from '../store/document-store'
import { resolveImageDisplaySrc } from '../utils/resolve-image-src'

/**
 * Renders an inline image, resolving co-located relative asset paths to a
 * displayable file URL while keeping the portable relative path in the doc.
 */
function ImageNodeView({ node, selected }: ReactNodeViewProps) {
  const filePath = useDocumentStore((state) => state.filePath)
  const [displaySrc, setDisplaySrc] = useState(String(node.attrs.src ?? ''))

  useEffect(() => {
    let cancelled = false
    void resolveImageDisplaySrc({ documentPath: filePath, src: String(node.attrs.src ?? '') }).then((resolved) => {
      if (!cancelled) setDisplaySrc(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [filePath, node.attrs.src])

  return (
    <NodeViewWrapper className="markdoc-image-node" data-drag-handle>
      <img
        src={displaySrc}
        alt={String(node.attrs.alt ?? '')}
        title={node.attrs.title ? String(node.attrs.title) : undefined}
        className={`max-w-full rounded ${selected ? 'ring-2 ring-accent' : ''}`}
        draggable={false}
      />
    </NodeViewWrapper>
  )
}

/**
 * Tiptap image node that stores portable relative paths for local files
 * and https URLs for remote images (Typora/Obsidian convention).
 */
export const MarkdocImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
