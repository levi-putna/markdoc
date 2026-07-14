import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { getHeadingMentionDisplayLabel } from '@shared/heading-mention-resolve'
import { openHeadingMentionPicker } from '../utils/heading-mention-picker'
import { useDocumentStore } from '../store/document-store'

/**
 * Live React NodeView for heading mentions — resolves the current heading
 * title on every editor update so renames and deletes are reflected immediately.
 *
 * Renders as a span (not an `<a href="heading://…">`) so Electron does not
 * try to open the custom URL scheme; clicks bubble as a Markdoc navigation
 * event handled by the editor, matching outline-sidebar jump behaviour.
 * Broken (deleted) mentions stay red with the last known title and open the
 * heading picker on click so the user can relink without deleting the chip.
 */
export function HeadingMentionView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const headingId = node.attrs.headingId as string
  const cachedLabel = (node.attrs.label as string | null) ?? null
  const numberingEnabled = useDocumentStore((s) => s.numberingConfig.enabled)
  const showNumbersInMentions = useDocumentStore(
    (s) => s.numberingConfig.showNumbersInMentions ?? true
  )

  const [{ label, display, broken }, setResolved] = useState(() =>
    getHeadingMentionDisplayLabel({
      doc: editor.state.doc,
      headingId,
      cachedLabel,
      showNumbersInMentions: numberingEnabled && showNumbersInMentions,
    })
  )

  useEffect(() => {
    const refresh = () => {
      setResolved(
        getHeadingMentionDisplayLabel({
          doc: editor.state.doc,
          headingId,
          cachedLabel: (node.attrs.label as string | null) ?? cachedLabel,
          showNumbersInMentions: numberingEnabled && showNumbersInMentions,
        })
      )
    }

    refresh()
    editor.on('update', refresh)
    return () => {
      editor.off('update', refresh)
    }
  }, [
    editor,
    headingId,
    node.attrs.label,
    cachedLabel,
    numberingEnabled,
    showNumbersInMentions,
  ])

  const navigate = () => {
    editor.view.dom.dispatchEvent(
      new CustomEvent('markdoc-heading-mention', {
        bubbles: true,
        detail: { headingId },
      })
    )
  }

  const openRelinkPicker = () => {
    const pos = typeof getPos === 'function' ? getPos() : null
    if (typeof pos !== 'number') return

    openHeadingMentionPicker({
      editor,
      clientRect: () => {
        const dom = editor.view.nodeDOM(pos)
        return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null
      },
      onSelect: ({ headingId: nextId, label: nextLabel }) => {
        updateAttributes({ headingId: nextId, label: nextLabel })
      },
    })
  }

  const activate = () => {
    if (broken) {
      openRelinkPicker()
      return
    }
    navigate()
  }

  return (
    <NodeViewWrapper
      as="span"
      className={broken ? 'heading-mention heading-mention--broken' : 'heading-mention'}
      data-heading-mention=""
      data-heading-id={headingId}
      data-label={display}
      data-broken={broken ? 'true' : undefined}
      role="link"
      tabIndex={0}
      title={broken ? 'Choose a heading to relink' : undefined}
      aria-label={
        broken ? `Broken mention of ${label}. Choose a heading to relink.` : undefined
      }
      data-testid="heading-mention"
      onClick={(event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        activate()
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        activate()
      }}
    >
      {/* Visible chip — may include the heading number when numbering is on */}
      {display}
    </NodeViewWrapper>
  )
}
