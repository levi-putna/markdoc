import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PreferencesPage } from './components/PreferencesPage'
import { useAppTheme } from './hooks/use-app-theme'
import './styles/globals.css'

/**
 * Root layout for the dedicated Preferences window.
 */
function PreferencesApp() {
  useAppTheme()

  return <PreferencesPage />
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <PreferencesApp />
    </StrictMode>
  )
}
