import { useEffect } from 'react'
import { useDocumentStore } from '../store/document-store'

/**
 * Applies the light/dark theme class from preferences + system appearance.
 * Shared by every window (document and preferences) so they stay in sync.
 */
export function useAppTheme() {
  useEffect(() => {
    const applyTheme = ({
      shouldUseDarkColors,
      appearance,
    }: {
      shouldUseDarkColors: boolean
      appearance: string
    }) => {
      const isDark =
        appearance === 'dark' || (appearance === 'system' && shouldUseDarkColors)
      document.documentElement.classList.toggle('dark', isDark)
    }

    window.markdoc?.getTheme().then(applyTheme)

    const unsubTheme = window.markdoc?.onThemeChanged(({ shouldUseDarkColors }) => {
      const appearance = useDocumentStore.getState().preferences.appearance
      applyTheme({ shouldUseDarkColors, appearance })
    })
    const unsubPrefs = window.markdoc?.onPreferencesChanged((prefs) => {
      useDocumentStore.getState().setPreferences(prefs)
      window.markdoc
        ?.getTheme()
        .then(({ shouldUseDarkColors }) =>
          applyTheme({ shouldUseDarkColors, appearance: prefs.appearance })
        )
    })

    return () => {
      unsubTheme?.()
      unsubPrefs?.()
    }
  }, [])
}
