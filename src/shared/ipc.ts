import type { JSONContent } from '@tiptap/core'
import type {
  ApplyEditPayload,
  AssistantEditMode,
  AutocompleteContextWindow,
  ChatSendPayload,
  ChatStreamChunk,
  DocumentSnapshot,
  SuggestionDecorationPayload,
} from './ai/types'
import type { GatewayModelInfo } from './ai/model-pricing'
import {
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_AUTOCOMPLETE_MODEL,
  DEFAULT_ENABLED_MODEL_IDS,
} from './ai/default-models'

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
  CLI_STATUS: 'cli:status',
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
  ASSET_IMPORT: 'asset:import',
  RESOLVE_IMAGE_SRC: 'image:resolve-src',
  FILE_SAVE_AS_WITH_ASSETS: 'file:save-as-with-assets',
  STYLE_LOAD: 'style:load',
  STYLE_SAVE: 'style:save',
  STYLE_RESET: 'style:reset',
  WINDOW_SAVE_STATE: 'window:save-state',
  SESSION_SAVE: 'session:save',
  FILE_DUPLICATE: 'file:duplicate',
  FILE_RENAME: 'file:rename',
  FILE_MOVE: 'file:move',
  FILE_REVERT: 'file:revert',
  FILE_CHECK_IMAGES: 'file:check-images',
  DIALOG_IMAGE_PICK: 'dialog:image-pick',
  DIALOG_FOLDER: 'dialog:folder',
  OPEN_LOGS: 'app:open-logs',
  COPY_DIAGNOSTICS: 'app:copy-diagnostics',
  APP_OPEN_PREFERENCES: 'app:open-preferences',
  APP_OPEN_EXTERNAL: 'app:open-external',
  AI_CHAT_SEND: 'ai:chat:send',
  AI_CHAT_CANCEL: 'ai:chat:cancel',
  AI_CHAT_STREAM_CHUNK: 'ai:chat:stream-chunk',
  AI_CONVERSATIONS_GET: 'ai:conversations:get',
  AI_CONVERSATIONS_LIST: 'ai:conversations:list',
  AI_CONVERSATIONS_LOAD: 'ai:conversations:load',
  AI_CONVERSATIONS_SAVE: 'ai:conversations:save',
  AI_CONVERSATIONS_START_NEW: 'ai:conversations:start-new',
  AI_CONVERSATIONS_CLEAR: 'ai:conversations:clear',
  AI_CONVERSATIONS_CLEAR_ALL: 'ai:conversations:clear-all',
  AI_CONVERSATIONS_CHANGED: 'ai:conversations:changed',
  AI_MODELS_LIST: 'ai:models:list',
  AI_KEY_SET: 'ai:key:set',
  AI_KEY_TEST: 'ai:key:test',
  AI_KEY_CLEAR: 'ai:key:clear',
  AI_KEY_HAS: 'ai:key:has',
  AI_DOCUMENT_SNAPSHOT: 'ai:document:snapshot',
  AI_DOCUMENT_SNAPSHOT_REQUEST: 'ai:document:snapshot-request',
  AI_SUGGESTION_APPLY: 'ai:suggestion:apply',
  AI_SUGGESTION_ACCEPT: 'ai:suggestion:accept',
  AI_SUGGESTION_REJECT: 'ai:suggestion:reject',
  AI_SUGGESTION_ACCEPT_ALL: 'ai:suggestion:accept-all',
  AI_SUGGESTION_REJECT_ALL: 'ai:suggestion:reject-all',
  AI_AUTOCOMPLETE_REQUEST: 'ai:autocomplete:request',
  AI_AUTOCOMPLETE_CANCEL: 'ai:autocomplete:cancel',
  AI_AUTOCOMPLETE_RESULT: 'ai:autocomplete:result',
} as const

export type ViewMode = 'edit' | 'markdown' | 'preview' | 'split'

export type AppearanceMode = 'system' | 'light' | 'dark'

export type SidebarDensity = 'small' | 'medium' | 'large'

/** Application-wide preferences stored in electron-store. */
export interface CliInstallResult {
  success: boolean
  error?: string
  installPath?: string
}

export interface CliStatus {
  installed: boolean
  installPath: string | null
}

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
  aiEnabled: boolean
  aiDisclosureAccepted: boolean
  enabledModelIds: string[]
  defaultAssistantModel: string
  defaultAutocompleteModel: string
  assistantEditMode: AssistantEditMode
  autocompleteContextWindow: AutocompleteContextWindow
  autocompleteEnabled: boolean
  aiDebugLogEnabled: boolean
}

export interface WindowState {
  filePath: string | null
  bounds: { x: number; y: number; width: number; height: number }
  viewMode: ViewMode
  sidebarVisible: boolean
  sidebarWidth: number
  assistantVisible: boolean
  assistantWidth: number
}

export type { ChatSendPayload, ChatStreamChunk, DocumentSnapshot, SuggestionDecorationPayload, ApplyEditPayload }

export interface AiKeyTestResult {
  success: boolean
  error?: string
}

export interface AiModelsListResult {
  models: GatewayModelInfo[]
  cachedAt: number | null
}

export interface AutocompleteRequestPayload {
  modelId: string
  prefix: string
  suffix: string
  contextWindow: AutocompleteContextWindow
}

export interface AutocompleteResultPayload {
  requestId: string
  text: string
  error?: string
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

export type ExportFormat = 'pdf' | 'docx' | 'html'

export interface ExportMargins {
  top: number
  bottom: number
  left: number
  right: number
}

/** Form state driving the in-app export dialog (before a destination is picked). */
export interface ExportOptions {
  format: ExportFormat
  destinationPath: string
  pageSize?: 'A4' | 'Letter'
  margins?: ExportMargins
}

/**
 * Raw pieces the renderer gathers from the live document — the main process
 * wraps these into a self-contained HTML document (`wrapStandaloneHtml`)
 * itself, since that helper's DOCX sibling in the same module pulls in
 * Node-only APIs that must never end up in the sandboxed renderer bundle.
 */
export interface ExportPdfPayload {
  bodyHtml: string
  css: string
  isDark: boolean
  title: string
  destinationPath: string
  pageSize?: 'A4' | 'Letter'
  margins?: ExportMargins
}

export interface ExportHtmlPayload {
  bodyHtml: string
  css: string
  isDark: boolean
  title: string
  destinationPath: string
}

export interface ExportDocxPayload {
  /** The live Tiptap/ProseMirror document JSON — the same model used for editing/preview (TR-10.2). */
  doc: JSONContent
  title: string
  /** Directory the current document lives in, used to resolve relative image paths. Null for unsaved documents. */
  documentDir: string | null
  destinationPath: string
}

/** Outcome of an export IPC call — failures never throw across the bridge, they resolve with `success: false`. */
export interface ExportResult {
  success: boolean
  error?: string
  warnings?: string[]
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

export interface AssetWritePayload {
  documentPath: string
  filename: string
  /** Base64-encoded image bytes from the renderer. */
  dataBase64: string
}

export interface AssetWriteResult {
  relativePath: string
  absolutePath: string
}

export interface BrokenImageRef {
  src: string
  line: number
}

export interface FileOperationResult {
  success: boolean
  newPath?: string
  error?: string
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
  aiEnabled: false,
  aiDisclosureAccepted: false,
  enabledModelIds: [...DEFAULT_ENABLED_MODEL_IDS],
  defaultAssistantModel: DEFAULT_ASSISTANT_MODEL,
  defaultAutocompleteModel: DEFAULT_AUTOCOMPLETE_MODEL,
  assistantEditMode: 'suggestion',
  autocompleteContextWindow: 'paragraph',
  autocompleteEnabled: false,
  aiDebugLogEnabled: false,
}

export const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd']
