import '@testing-library/jest-dom/vitest'

// Mermaid measures rendered SVG text via getBBox, which jsdom does not implement.
const svgPrototype = SVGElement.prototype as SVGElement & {
  getBBox?: () => DOMRect
}
if (typeof SVGElement !== 'undefined' && !svgPrototype.getBBox) {
  svgPrototype.getBBox = () =>
    ({
      x: 0,
      y: 0,
      width: 120,
      height: 20,
      top: 0,
      right: 120,
      bottom: 20,
      left: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

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
    getCliStatus: async () => ({ installed: false, installPath: null }),
    installCli: async () => ({ success: true, installPath: '/usr/local/bin/markdoc' }),
    uninstallCli: async () => ({ success: true }),
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
