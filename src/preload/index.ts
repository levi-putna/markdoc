import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppPreferences, type FileReadResult, type FileWritePayload, type ExportOptions } from '../shared/ipc'

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

/**
 * Typed preload bridge exposing a narrow API to the renderer.
 */
const markdocApi = {
  readFile: (filePath: string): Promise<FileReadResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, filePath),

  writeFile: (payload: FileWritePayload): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, payload),

  openDialog: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN),

  saveAsDialog: (defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_AS, defaultName),

  exportDialog: (format: 'pdf' | 'docx' | 'html'): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_EXPORT, format),

  getPreferences: (): Promise<AppPreferences> => ipcRenderer.invoke(IPC_CHANNELS.PREFS_GET),

  setPreferences: (prefs: Partial<AppPreferences>): Promise<AppPreferences> =>
    ipcRenderer.invoke(IPC_CHANNELS.PREFS_SET, prefs),

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

  exportPdf: (options: ExportOptions & { html: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF, options),

  exportHtml: (options: { html: string; destinationPath: string }): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_HTML, options),
}

contextBridge.exposeInMainWorld('markdoc', markdocApi)

export type MarkdocApi = typeof markdocApi
