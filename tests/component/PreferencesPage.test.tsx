import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    fireEvent.click(screen.getByTestId('pref-nav-editor'))
    expect(screen.getByTestId('pref-font-size')).toBeInTheDocument()
    expect(screen.getByTestId('pref-spellcheck')).toBeInTheDocument()
  })

  it('TC-PREFS.3 exposes appearance override', () => {
    render(<PreferencesPage />)
    expect(screen.getByTestId('pref-appearance')).toBeInTheDocument()
  })

  it('TC-PREFS.5 exposes AI settings navigation', () => {
    useDocumentStore.setState({
      preferences: {
        ...useDocumentStore.getState().preferences,
        aiEnabled: false,
      },
    })
    render(<PreferencesPage />)
    expect(screen.getByTestId('pref-nav-ai')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pref-nav-ai'))
    expect(screen.getByTestId('pref-section-ai')).toBeInTheDocument()
    expect(screen.getByTestId('pref-ai-enabled')).toBeInTheDocument()
    expect(screen.queryByTestId('pref-ai-api-key')).not.toBeInTheDocument()
  })

  it('TC-PREFS.6 shows AI options when enabled', () => {
    useDocumentStore.setState({
      preferences: {
        ...useDocumentStore.getState().preferences,
        aiEnabled: true,
        aiDisclosureAccepted: true,
      },
    })
    render(<PreferencesPage />)
    fireEvent.click(screen.getByTestId('pref-nav-ai'))
    expect(screen.getByTestId('pref-ai-api-key')).toBeInTheDocument()
    expect(screen.getByTestId('pref-ai-default-model')).toBeInTheDocument()
  })

  it('TC-PREFS.4 calls installCli when the CLI helper is not installed', async () => {
    let cliInstalled = false
    const installCli = vi.fn(async () => {
      cliInstalled = true
      return { success: true, installPath: '/usr/local/bin/markdoc' }
    })
    const getCliStatus = vi.fn(async () => ({
      installed: cliInstalled,
      installPath: cliInstalled ? '/usr/local/bin/markdoc' : null,
    }))
    const getPreferences = vi.fn(async () => ({
      editorFontFamily: '-apple-system, system-ui, sans-serif',
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      spellcheckEnabled: true,
      appearance: 'system',
      sidebarDensity: 'medium',
      cliInstalled,
      recentFiles: [],
      windowStates: [],
    }))

    Object.assign(window.markdoc, {
      installCli,
      uninstallCli: vi.fn(async () => ({ success: true })),
      getCliStatus,
      getPreferences,
    })

    render(<PreferencesPage />)
    fireEvent.click(screen.getByTestId('pref-nav-cli'))
    fireEvent.click(screen.getByTestId('pref-cli-install'))

    expect(installCli).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Installed')).toBeInTheDocument()
  })
})
