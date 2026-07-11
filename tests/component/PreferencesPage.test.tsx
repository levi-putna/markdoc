import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreferencesPage } from '@renderer/components/PreferencesPage'
import { useDocumentStore } from '@renderer/store/document-store'

describe('TC-PREFS preferences', () => {
  it('TC-PREFS.1 renders preferences page', async () => {
    useDocumentStore.getState().reset()
    render(<PreferencesPage />)
    expect(screen.getByTestId('preferences-page')).toBeInTheDocument()
    expect(screen.getByText('Preferences')).toBeInTheDocument()
  })

  it('TC-PREFS.2 exposes font size and spellcheck controls', () => {
    render(<PreferencesPage />)
    expect(screen.getByTestId('pref-font-size')).toBeInTheDocument()
    expect(screen.getByTestId('pref-spellcheck')).toBeInTheDocument()
  })

  it('TC-PREFS.3 exposes appearance override', () => {
    render(<PreferencesPage />)
    expect(screen.getByTestId('pref-appearance')).toBeInTheDocument()
  })
})
