import '@testing-library/jest-dom/vitest'

// StickToBottom (assistant conversation) uses ResizeObserver in jsdom tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
}

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
      aiEnabled: false,
      aiDisclosureAccepted: false,
      enabledModelIds: ['anthropic/claude-sonnet-4.5'],
      defaultAssistantModel: 'anthropic/claude-sonnet-4.5',
      defaultAutocompleteModel: 'google/gemini-2.5-flash',
      assistantEditMode: 'suggestion',
      autocompleteContextWindow: 'paragraph',
      autocompleteEnabled: false,
      aiDebugLogEnabled: false,
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
    openPreferences: async () => {},
    openExternal: async () => {},
    sendChat: async () => ({ success: true }),
    cancelChat: async () => ({ success: true }),
    onChatStreamChunk: () => () => {},
    getConversation: async () => ({ conversationId: 'test-conversation', title: 'New conversation', messages: [] }),
    listConversations: async () => ({ conversations: [] }),
    loadConversation: async () => ({ conversationId: 'test-conversation', title: 'New conversation', messages: [] }),
    saveConversation: async () => ({ success: true }),
    startNewConversation: async () => ({ conversationId: 'test-conversation', title: 'New conversation', messages: [] }),
    clearConversation: async () => ({ success: true }),
    clearAllConversations: async () => ({ success: true }),
    onConversationsChanged: () => () => {},
    listAiModels: async () => ({ models: [], cachedAt: null }),
    setAiApiKey: async () => ({ success: true }),
    testAiApiKey: async () => ({ success: true }),
    clearAiApiKey: async () => ({ success: true }),
    hasAiApiKey: async () => false,
    onSuggestionApply: () => () => {},
    acceptSuggestion: async () => ({ success: true }),
    rejectSuggestion: async () => ({ success: true }),
    acceptAllSuggestions: async () => ({ success: true }),
    rejectAllSuggestions: async () => ({ success: true }),
    onSuggestionAccept: () => () => {},
    onSuggestionReject: () => () => {},
    onSuggestionAcceptAll: () => () => {},
    onSuggestionRejectAll: () => () => {},
    requestAutocomplete: async () => ({ success: true }),
    cancelAutocomplete: async () => ({ success: true }),
    onAutocompleteResult: () => () => {},
  },
})
