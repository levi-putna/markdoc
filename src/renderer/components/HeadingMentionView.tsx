import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { getHeadingMentionLabel } from '@shared/heading-mention-resolve'

/**
 * Live React NodeView for heading mentions — resolves the current heading
 * title on every editor update so renames and deletes are reflected immediately.
 *
 * Renders as a span (not an `<a href="heading://…">`) so Electron does not
 * try to open the custom URL scheme; clicks bubble as a Markdoc navigation
 * event handled by the editor, matching outline-sidebar jump behaviour.
 */
export function HeadingMentionView({ node, editor }: NodeViewProps) {
  const headingId = node.attrs.headingId as string
  const [{ label, broken }, setResolved] = useState(() =>
    getHeadingMentionLabel({ doc: editor.state.doc, headingId })
  )

  useEffect(() => {
    const sync = () => {
      setResolved(getHeadingMentionLabel({ doc: editor.state.doc, headingId }))
    }
    sync()
    editor.on('update', sync)
    return () => {
      editor.off('update', sync)
    }
  }, [editor, headingId])

  const navigate = () => {
    if (broken) return
    editor.view.dom.dispatchEvent(
      new CustomEvent('markdoc-heading-mention', {
        bubbles: true,
        detail: { headingId },
      })
    )
  }

  return (
    <NodeViewWrapper
      as="span"
      className={broken ? 'heading-mention heading-mention--broken' : 'heading-mention'}
      data-heading-mention=""
      data-heading-id={headingId}
      data-broken={broken ? 'true' : undefined}
      role="link"
      tabIndex={0}
      data-testid="heading-mention"
      onClick={(event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        navigate()
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        navigate()
      }}
    >
      @{label}
    </NodeViewWrapper>
  )
}
