import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  type AppPreferences,
  type FileReadResult,
  type FileWritePayload,
  type ExportFormat,
  type ExportPdfPayload,
  type ExportHtmlPayload,
  type ExportDocxPayload,
  type ExportResult,
  type CliInstallResult,
  type CliStatus,
  type AssetWritePayload,
  type AssetWriteResult,
  type BrokenImageRef,
  type FileOperationResult,
  type StyleOverride,
  type WindowState,
  type ChatSendPayload,
  type ChatStreamChunk,
  type AiKeyTestResult,
  type AiModelsListResult,
  type AutocompleteRequestPayload,
  type AutocompleteResultPayload,
} from '../shared/ipc'
import type { UIMessage } from 'ai'
import type { ConversationSummary, SuggestionDecorationPayload } from '../shared/ai/types'

/**
 * Buffers `file:open-path` requests that arrive before the renderer has
 * mounted and called `onFileOpenRequested`. The main process sends this as
 * soon as a window's `ready-to-show` fires (CLI/Finder/argv launches), which
 * can race ahead of React's effects — this preload module loads and attaches
 * its listener well before that, so nothing gets dropped.
 */
const pendingOpenPaths: string[] = []
let openPathListener: ((filePath: string) => void) | null = null

ipcRenderer.on('file:open-path', (_event, filePath: string) => {
  if (openPathListener) {
    openPathListener(filePath)
  } else {
    pendingOpenPaths.push(filePath)
  }
})

const pendingRestoreStates: unknown[] = []
let restoreStateListener: ((state: unknown) => void) | null = null

ipcRenderer.on('window:restore-state', (_event, state: unknown) => {
  if (restoreStateListener) {
    restoreStateListener(state)
  } else {
    pendingRestoreStates.push(state)
  }
})

/**
 * Typed preload bridge exposing a narrow API to the renderer.
 */
const markdocApi = {
  readFile: (filePath: string): Promise<FileReadResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, filePath),

  writeFile: (payload: FileWritePayload): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, payload),

  openDialog: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN),

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_FOLDER),

  saveAsDialog: (defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_AS, defaultName),

  exportDialog: (format: ExportFormat, defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_EXPORT, format, defaultName),

  getPreferences: (): Promise<AppPreferences> => ipcRenderer.invoke(IPC_CHANNELS.PREFS_GET),

  setPreferences: (prefs: Partial<AppPreferences>): Promise<AppPreferences> =>
    ipcRenderer.invoke(IPC_CHANNELS.PREFS_SET, prefs),

  getCliStatus: (): Promise<CliStatus> => ipcRenderer.invoke(IPC_CHANNELS.CLI_STATUS),

  installCli: (): Promise<CliInstallResult> => ipcRenderer.invoke(IPC_CHANNELS.CLI_INSTALL),

  uninstallCli: (): Promise<CliInstallResult> => ipcRenderer.invoke(IPC_CHANNELS.CLI_UNINSTALL),

  onPreferencesChanged: (callback: (prefs: AppPreferences) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, prefs: AppPreferences) => callback(prefs)
    ipcRenderer.on(IPC_CHANNELS.PREFS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PREFS_CHANGED, handler)
  },

  getTheme: (): Promise<{ shouldUseDarkColors: boolean; appearance: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_GET_THEME),

  onThemeChanged: (callback: (theme: { shouldUseDarkColors: boolean }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, theme: { shouldUseDarkColors: boolean }) =>
      callback(theme)
    ipcRenderer.on(IPC_CHANNELS.APP_THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_THEME_CHANGED, handler)
  },

  onFileOpenRequested: (callback: (filePath: string) => void): (() => void) => {
    openPathListener = callback
    while (pendingOpenPaths.length > 0) {
      callback(pendingOpenPaths.shift() as string)
    }
    return () => {
      if (openPathListener === callback) openPathListener = null
    }
  },

  onWindowRestoreState: (callback: (state: WindowState) => void): (() => void) => {
    restoreStateListener = callback as (state: unknown) => void
    while (pendingRestoreStates.length > 0) {
      callback(pendingRestoreStates.shift() as WindowState)
    }
    return () => {
      if (restoreStateListener === callback) restoreStateListener = null
    }
  },

  onMenuAction: (
    action: string,
    callback: (...args: unknown[]) => void
  ): (() => void) => {
    const channel = `menu:${action}`
    const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  setWindowDirtyState: ({
    isDirty,
    filePath,
  }: {
    isDirty: boolean
    filePath: string | null
  }): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_DIRTY, { isDirty, filePath }),

  saveRecovery: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_SAVE, { filePath, content }),

  checkRecovery: (filePath: string): Promise<{ hasRecovery: boolean; content: string | null }> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_CHECK, filePath),

  clearRecovery: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_CLEAR, filePath),

  watchFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WATCH_START, filePath),

  unwatchFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WATCH_STOP, filePath),

  onFileChangedExternal: (callback: (filePath: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on(IPC_CHANNELS.FILE_CHANGED_EXTERNAL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.FILE_CHANGED_EXTERNAL, handler)
  },

  exportPdf: (payload: ExportPdfPayload): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF, payload),

  exportHtml: (payload: ExportHtmlPayload): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_HTML, payload),

  exportDocx: (payload: ExportDocxPayload): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DOCX, payload),

  writeAsset: (payload: AssetWritePayload): Promise<AssetWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASSET_WRITE, payload),

  readAsset: ({
    documentPath,
    relativePath,
  }: {
    documentPath: string
    relativePath: string
  }): Promise<{ dataBase64: string; mimeType: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASSET_READ, { documentPath, relativePath }),

  loadStyleOverrides: (documentPath: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.STYLE_LOAD, documentPath),

  saveStyleOverrides: ({
    documentPath,
    overrides,
  }: {
    documentPath: string
    overrides: StyleOverride
  }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STYLE_SAVE, { documentPath, overrides }),

  resetStyleOverrides: (documentPath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.STYLE_RESET, documentPath),

  saveWindowState: (state: WindowState): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SAVE_STATE, state),

  saveSession: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE),

  duplicateFile: ({
    filePath,
    markdown,
    frontMatter,
  }: {
    filePath: string
    markdown: string
    frontMatter: Record<string, unknown>
  }): Promise<FileOperationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_DUPLICATE, { filePath, markdown, frontMatter }),

  renameFile: ({
    filePath,
    newName,
  }: {
    filePath: string
    newName: string
  }): Promise<FileOperationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_RENAME, { filePath, newName }),

  moveFile: ({
    filePath,
    destinationDir,
  }: {
    filePath: string
    destinationDir: string
  }): Promise<FileOperationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_MOVE, { filePath, destinationDir }),

  revertFile: (filePath: string): Promise<FileReadResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_REVERT, filePath),

  checkBrokenImages: ({
    documentPath,
    markdown,
  }: {
    documentPath: string
    markdown: string
  }): Promise<BrokenImageRef[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_CHECK_IMAGES, { documentPath, markdown }),

  importAsset: ({
    documentPath,
    sourcePath,
  }: {
    documentPath: string
    sourcePath: string
  }): Promise<AssetWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASSET_IMPORT, { documentPath, sourcePath }),

  resolveImageSrc: ({
    documentPath,
    src,
  }: {
    documentPath: string
    src: string
  }): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.RESOLVE_IMAGE_SRC, { documentPath, src }),

  saveAsWithAssets: ({
    oldFilePath,
    newFilePath,
    markdown,
    frontMatter,
  }: {
    oldFilePath: string | null
    newFilePath: string
    markdown: string
    frontMatter?: Record<string, unknown>
  }): Promise<{ success: boolean; markdown: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_AS_WITH_ASSETS, {
      oldFilePath,
      newFilePath,
      markdown,
      frontMatter,
    }),

  pickImage: (): Promise<{ sourcePath: string; mimeType: string; filename: string } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_IMAGE_PICK),

  openLogsInFinder: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_LOGS),

  copyDiagnostics: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.COPY_DIAGNOSTICS),

  openPreferences: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_PREFERENCES),

  openExternal: ({ url }: { url: string }): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_EXTERNAL, { url }),

  sendChat: (payload: ChatSendPayload): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_SEND, payload),

  cancelChat: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT_CANCEL),

  onChatStreamChunk: (callback: (chunk: ChatStreamChunk) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, chunk: ChatStreamChunk) => callback(chunk)
    ipcRenderer.on(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_CHAT_STREAM_CHUNK, handler)
  },

  getConversation: ({
    filePath,
    sessionId,
  }: {
    filePath: string | null
    sessionId: string
  }): Promise<{ conversationId: string; title: string; messages: UIMessage[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_GET, { filePath, sessionId }),

  listConversations: ({
    filePath,
    sessionId,
  }: {
    filePath: string | null
    sessionId: string
  }): Promise<{ conversations: ConversationSummary[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_LIST, { filePath, sessionId }),

  loadConversation: ({
    filePath,
    sessionId,
    conversationId,
  }: {
    filePath: string | null
    sessionId: string
    conversationId: string
  }): Promise<{ conversationId: string; title: string; messages: UIMessage[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_LOAD, { filePath, sessionId, conversationId }),

  saveConversation: ({
    filePath,
    sessionId,
    conversationId,
    messages,
  }: {
    filePath: string | null
    sessionId: string
    conversationId: string
    messages: UIMessage[]
  }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_SAVE, {
      filePath,
      sessionId,
      conversationId,
      messages,
    }),

  startNewConversation: ({
    filePath,
    sessionId,
  }: {
    filePath: string | null
    sessionId: string
  }): Promise<{ conversationId: string; title: string; messages: UIMessage[] }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_START_NEW, { filePath, sessionId }),

  clearConversation: ({
    filePath,
    sessionId,
  }: {
    filePath: string | null
    sessionId: string
  }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_CLEAR, { filePath, sessionId }),

  onConversationsChanged: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.AI_CONVERSATIONS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_CONVERSATIONS_CHANGED, handler)
  },

  clearAllConversations: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_CONVERSATIONS_CLEAR_ALL),

  listAiModels: (): Promise<AiModelsListResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_MODELS_LIST),

  setAiApiKey: ({ apiKey }: { apiKey: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_KEY_SET, { apiKey }),

  testAiApiKey: ({ apiKey }: { apiKey?: string }): Promise<AiKeyTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_KEY_TEST, { apiKey }),

  clearAiApiKey: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_KEY_CLEAR),

  hasAiApiKey: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.AI_KEY_HAS),

  onSuggestionApply: (
    callback: (payload: SuggestionDecorationPayload & { autoApply?: boolean }) => void
  ): (() => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      payload: SuggestionDecorationPayload & { autoApply?: boolean }
    ) => callback(payload)
    ipcRenderer.on(IPC_CHANNELS.AI_SUGGESTION_APPLY, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_SUGGESTION_APPLY, handler)
  },

  acceptSuggestion: (payload: { suggestionId: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SUGGESTION_ACCEPT, payload),

  rejectSuggestion: (payload: { suggestionId: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SUGGESTION_REJECT, payload),

  acceptAllSuggestions: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SUGGESTION_ACCEPT_ALL),

  rejectAllSuggestions: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SUGGESTION_REJECT_ALL),

  onSuggestionAccept: (
    callback: (payload: { suggestionId: string }) => void
  ): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: { suggestionId: string }) =>
      callback(payload)
    ipcRenderer.on(IPC_CHANNELS.AI_SUGGESTION_ACCEPT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_SUGGESTION_ACCEPT, handler)
  },

  onSuggestionReject: (
    callback: (payload: { suggestionId: string }) => void
  ): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: { suggestionId: string }) =>
      callback(payload)
    ipcRenderer.on(IPC_CHANNELS.AI_SUGGESTION_REJECT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_SUGGESTION_REJECT, handler)
  },

  onSuggestionAcceptAll: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.AI_SUGGESTION_ACCEPT_ALL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_SUGGESTION_ACCEPT_ALL, handler)
  },

  onSuggestionRejectAll: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.AI_SUGGESTION_REJECT_ALL, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_SUGGESTION_REJECT_ALL, handler)
  },

  requestAutocomplete: ({
    requestId,
    ...payload
  }: AutocompleteRequestPayload & { requestId: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_AUTOCOMPLETE_REQUEST, { requestId, ...payload }),

  cancelAutocomplete: ({ requestId }: { requestId: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_AUTOCOMPLETE_CANCEL, { requestId }),

  onAutocompleteResult: (
    callback: (payload: AutocompleteResultPayload) => void
  ): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: AutocompleteResultPayload) =>
      callback(payload)
    ipcRenderer.on(IPC_CHANNELS.AI_AUTOCOMPLETE_RESULT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_AUTOCOMPLETE_RESULT, handler)
  },
}

contextBridge.exposeInMainWorld('markdoc', markdocApi)

export type MarkdocApi = typeof markdocApi
