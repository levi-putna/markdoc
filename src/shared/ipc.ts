/**
 * IPC channel names and payload types shared across main, preload, and renderer.
 */

export const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_NEW: 'file:new',
  FILE_CLOSE: 'file:close',
  DIALOG_OPEN: 'dialog:open',
  DIALOG_SAVE_AS: 'dialog:save-as',
  DIALOG_EXPORT: 'dialog:export',
  EXPORT_PDF: 'export:pdf',
  EXPORT_DOCX: 'export:docx',
  EXPORT_HTML: 'export:html',
  PREFS_GET: 'prefs:get',
  PREFS_SET: 'prefs:set',
  PREFS_CHANGED: 'prefs:changed',
  CLI_INSTALL: 'cli:install',
  CLI_UNINSTALL: 'cli:uninstall',
  RECOVERY_CHECK: 'recovery:check',
  RECOVERY_SAVE: 'recovery:save',
  RECOVERY_CLEAR: 'recovery:clear',
  FILE_CHANGED_EXTERNAL: 'file:changed-external',
  FILE_WATCH_START: 'file:watch-start',
  FILE_WATCH_STOP: 'file:watch-stop',
  WINDOW_SET_DIRTY: 'window:set-dirty',
  WINDOW_GET_STATE: 'window:get-state',
  APP_GET_THEME: 'app:get-theme',
  APP_THEME_CHANGED: 'app:theme-changed',
  ASSET_WRITE: 'asset:write',
  ASSET_READ: 'asset:read',
} as const

export type ViewMode = 'edit' | 'markdown' | 'preview' | 'split'

export type AppearanceMode = 'system' | 'light' | 'dark'

export type SidebarDensity = 'small' | 'medium' | 'large'

/** Application-wide preferences stored in electron-store. */
export interface AppPreferences {
  editorFontFamily: string
  editorFontSize: number
  editorLineSpacing: number
  spellcheckEnabled: boolean
  appearance: AppearanceMode
  sidebarDensity: SidebarDensity
  cliInstalled: boolean
  recentFiles: string[]
  windowStates: WindowState[]
}

export interface WindowState {
  filePath: string | null
  bounds: { x: number; y: number; width: number; height: number }
  viewMode: ViewMode
  sidebarVisible: boolean
  sidebarWidth: number
}

export interface DocumentPayload {
  filePath: string | null
  markdown: string
  frontMatter: Record<string, unknown>
  isDirty: boolean
}

export interface FileReadResult {
  filePath: string
  markdown: string
  frontMatter: Record<string, unknown>
}

export interface FileWritePayload {
  filePath: string
  markdown: string
  frontMatter?: Record<string, unknown>
}

export interface ExportOptions {
  format: 'pdf' | 'docx' | 'html'
  destinationPath: string
  pageSize?: 'A4' | 'Letter'
  margins?: { top: number; bottom: number; left: number; right: number }
}

export interface StyleOverride {
  version: number
  bodyFontFamily?: string
  bodyFontSize?: string
  bodyColor?: string
  headingColors?: Record<string, string>
  codeTheme?: string
  tableStriping?: boolean
  blockquoteStyle?: string
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  editorFontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
  editorFontSize: 16,
  editorLineSpacing: 1.6,
  spellcheckEnabled: true,
  appearance: 'system',
  sidebarDensity: 'medium',
  cliInstalled: false,
  recentFiles: [],
  windowStates: [],
}

export const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd']
