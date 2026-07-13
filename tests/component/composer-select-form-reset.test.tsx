import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  PromptInput,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
} from '../../src/renderer/components/ai-elements/prompt-input'

const DETACHED_SELECT_FORM_ID = 'markdoc-composer-detached-form'

/**
 * Minimal harness that mirrors the assistant composer: a Radix select inside PromptInput's form.
 */
function ComposerSelectHarness({
  detachedFromForm = false,
}: {
  detachedFromForm?: boolean
}) {
  const [editMode, setEditMode] = useState<'suggestion' | 'auto'>('suggestion')

  return (
    <>
      <button type="button" onClick={() => setEditMode('auto')}>
        Set auto
      </button>
      <PromptInput onSubmit={() => {}}>
        <PromptInputSelect
          form={detachedFromForm ? DETACHED_SELECT_FORM_ID : undefined}
          value={editMode}
          onValueChange={(value) => setEditMode(value as 'suggestion' | 'auto')}
        >
          <PromptInputSelectTrigger
            aria-label={editMode === 'auto' ? 'Auto apply mode' : 'Suggestion mode'}
          />
          <PromptInputSelectContent>
            <PromptInputSelectItem value="suggestion">Suggestion</PromptInputSelectItem>
            <PromptInputSelectItem value="auto">Auto</PromptInputSelectItem>
          </PromptInputSelectContent>
        </PromptInputSelect>
      </PromptInput>
    </>
  )
}

describe('composer select form reset', () => {
  it('reverts to the mount-time value when the select stays associated with the composer form', () => {
    render(<ComposerSelectHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Set auto' }))
    expect(screen.getByRole('combobox', { name: 'Auto apply mode' })).toBeInTheDocument()

    fireEvent.submit(document.querySelector('form')!)

    expect(screen.getByRole('combobox', { name: 'Suggestion mode' })).toBeInTheDocument()
  })

  it('keeps the current value when the select is detached from the composer form', () => {
    render(<ComposerSelectHarness detachedFromForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Set auto' }))
    expect(screen.getByRole('combobox', { name: 'Auto apply mode' })).toBeInTheDocument()

    fireEvent.submit(document.querySelector('form')!)

    expect(screen.getByRole('combobox', { name: 'Auto apply mode' })).toBeInTheDocument()
  })
})
