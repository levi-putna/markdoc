import '@testing-library/jest-dom/vitest'

// Mock window.markdoc for component tests
Object.defineProperty(window, 'markdoc', {
  writable: true,
  value: {
    getPreferences: async () => ({
      editorFontFamily: '-apple-system, system-ui, sans-serif',
      editorFontSize: 16,
      editorLineSpacing: 1.6,
      spellcheckEnabled: true,
      appearance: 'system',
      sidebarDensity: 'medium',
      cliInstalled: false,
      recentFiles: [],
      windowStates: [],
    }),
    setPreferences: async (prefs: Record<string, unknown>) => prefs,
    onPreferencesChanged: () => () => {},
    getTheme: async () => ({ shouldUseDarkColors: false, appearance: 'system' }),
    onThemeChanged: () => () => {},
    onMenuAction: () => () => {},
    onFileOpenRequested: () => () => {},
    onFileChangedExternal: () => () => {},
    readFile: async () => ({ filePath: '', markdown: '', frontMatter: {} }),
    writeFile: async () => ({ success: true }),
    saveAsDialog: async () => null,
    watchFile: async () => {},
    clearRecovery: async () => {},
    checkRecovery: async () => ({ hasRecovery: false, content: null }),
    saveRecovery: async () => {},
  },
})
