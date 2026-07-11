import { app, BrowserWindow, ipcMain, dialog, nativeTheme, Menu } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir, access, unlink } from 'fs/promises'
import { constants } from 'fs'
import log from 'electron-log'
import chokidar from 'chokidar'
import { PreferencesStore } from './preferences-store'
import {
  IPC_CHANNELS,
  SUPPORTED_EXTENSIONS,
  type AppPreferences,
  type FileReadResult,
  type FileWritePayload,
  type ExportOptions,
} from '../shared/ipc'
import { parseMarkdownFile, serializeMarkdownFile } from '../shared/file-utils'

const preferencesStore = new PreferencesStore()

const windows = new Map<number, BrowserWindow>()
const fileWatchers = new Map<string, ReturnType<typeof chokidar.watch>>()
// Windows waiting on a save round-trip before they can close
const pendingCloseWindows = new Set<number>()
let pendingOpenFiles: string[] = []

/**
 * Resolves the window a menu action should target. Prefers the OS-reported
 * focused window, but falls back to the most recently created document
 * window — `getFocusedWindow()` can legitimately return null (e.g. right
 * after programmatic focus, or in automated/scripted contexts) even though
 * there's an obvious single window the action should apply to.
 */
function getTargetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? [...windows.values()].at(-1) ?? null
}

/**
 * Creates the application menu with standard File operations.
 */
function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences…',
                accelerator: 'CmdOrCtrl+,',
                click: () => createPreferencesWindow(),
              },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => createDocumentWindow(),
        },
        {
          id: 'menu-file-open',
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const target = getTargetWindow()
            if (!target) return
            // handleOpenDialog only resolves the picked paths — it doesn't load
            // them anywhere on its own, so forward each to the renderer via the
            // same channel used by CLI/Finder/second-instance file opens.
            const paths = await handleOpenDialog(target)
            for (const path of paths) {
              target.webContents.send('file:open-path', path)
            }
          },
        },
        ...(isMac
          ? [
              {
                label: 'Open Recent',
                role: 'recentDocuments' as const,
                submenu: [{ label: 'Clear Menu', role: 'clearRecentDocuments' as const }],
              },
            ]
          : []),
        { type: 'separator' },
        {
          id: 'menu-file-save',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            getTargetWindow()?.webContents.send('menu:save')
          },
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            getTargetWindow()?.webContents.send('menu:save-as')
          },
        },
        { type: 'separator' },
        {
          label: 'Export To…',
          click: () => {
            getTargetWindow()?.webContents.send('menu:export')
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' as const }] : []),
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            getTargetWindow()?.webContents.send('menu:find')
          },
        },
        {
          label: 'Find and Replace',
          accelerator: 'CmdOrCtrl+Alt+F',
          click: () => {
            getTargetWindow()?.webContents.send('menu:find-replace')
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+\\',
          click: () => {
            getTargetWindow()?.webContents.send('menu:toggle-sidebar')
          },
        },
        { type: 'separator' },
        {
          label: 'Edit Only',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            getTargetWindow()?.webContents.send('menu:view-mode', 'edit')
          },
        },
        {
          label: 'Markdown Source',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            getTargetWindow()?.webContents.send('menu:view-mode', 'markdown')
          },
        },
        {
          label: 'Preview Only',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            getTargetWindow()?.webContents.send('menu:view-mode', 'preview')
          },
        },
        {
          label: 'Split View',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            getTargetWindow()?.webContents.send('menu:view-mode', 'split')
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Creates a new document window.
 */
function createDocumentWindow(filePath?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  windows.set(win.id, win)

  win.on('ready-to-show', () => {
    win.show()
    if (filePath) {
      win.webContents.send('file:open-path', filePath)
    }
  })

  // Guard against silently discarding unsaved changes on close
  win.on('close', (event) => {
    if (!win.isDocumentEdited() || pendingCloseWindows.has(win.id)) return

    event.preventDefault()
    const fileName = win.getRepresentedFilename().split('/').pop() || 'Untitled'
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Do you want to save the changes made to “${fileName}”?`,
      detail: "Your changes will be lost if you don't save them.",
    })

    if (choice === 0) {
      // Close completes once the renderer reports a clean document
      pendingCloseWindows.add(win.id)
      win.webContents.send('menu:save')
    } else if (choice === 1) {
      win.destroy()
    }
  })

  win.on('closed', () => {
    pendingCloseWindows.delete(win.id)
    windows.delete(win.id)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

let preferencesWindow: BrowserWindow | null = null

/**
 * Opens the Preferences window.
 */
function createPreferencesWindow(): void {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.focus()
    return
  }

  preferencesWindow = new BrowserWindow({
    width: 520,
    height: 480,
    resizable: false,
    title: 'Preferences',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  preferencesWindow.on('closed', () => {
    preferencesWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    preferencesWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/preferences`)
  } else {
    preferencesWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'preferences',
    })
  }
}

/**
 * Reads a Markdown file from disk.
 */
async function readMarkdownFile(filePath: string): Promise<FileReadResult> {
  const content = await readFile(filePath, 'utf-8')
  const { frontMatter, body } = parseMarkdownFile(content)
  return { filePath, markdown: body, frontMatter }
}

/**
 * Writes a Markdown file to disk atomically.
 */
async function writeMarkdownFile({ filePath, markdown, frontMatter = {} }: FileWritePayload): Promise<void> {
  const content = serializeMarkdownFile({ frontMatter, body: markdown })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, content, 'utf-8')
  const { rename } = await import('fs/promises')
  await rename(tempPath, filePath)
}

/**
 * Opens the native file dialog and returns selected paths.
 */
async function handleOpenDialog(win: BrowserWindow): Promise<string[]> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  })
  return result.filePaths
}

/**
 * Registers IPC handlers for file and preference operations.
 */
function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_, filePath: string) => {
    app.addRecentDocument(filePath)
    return readMarkdownFile(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_, payload: FileWritePayload) => {
    await writeMarkdownFile(payload)
    app.addRecentDocument(payload.filePath)
    return { success: true }
  })

  // Keep native window chrome in sync with document state: dirty dot in the
  // close button, proxy icon via represented filename, and window title.
  ipcMain.handle(
    IPC_CHANNELS.WINDOW_SET_DIRTY,
    (event, { isDirty, filePath }: { isDirty: boolean; filePath: string | null }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      win.setDocumentEdited(isDirty)
      win.setRepresentedFilename(filePath ?? '')
      win.setTitle(filePath ? filePath.split('/').pop() ?? 'MarkDoc' : 'Untitled')

      if (!isDirty && pendingCloseWindows.has(win.id)) {
        pendingCloseWindows.delete(win.id)
        win.destroy()
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    return handleOpenDialog(win)
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_AS, async (event, defaultName?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName ?? 'Untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    return result.filePath ?? null
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_EXPORT, async (event, format: 'pdf' | 'docx' | 'html') => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const extensions: Record<string, string[]> = {
      pdf: ['pdf'],
      docx: ['docx'],
      html: ['html'],
    }
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: format.toUpperCase(), extensions: extensions[format] }],
    })
    return result.filePath ?? null
  })

  ipcMain.handle(IPC_CHANNELS.PREFS_GET, async () => preferencesStore.load())

  ipcMain.handle(IPC_CHANNELS.PREFS_SET, async (_, prefs: Partial<AppPreferences>) => {
    const updated = await preferencesStore.merge(prefs)
    for (const win of windows.values()) {
      win.webContents.send(IPC_CHANNELS.PREFS_CHANGED, updated)
    }
    return updated
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_THEME, async () => ({
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    appearance: preferencesStore.get('appearance'),
  }))

  ipcMain.handle(IPC_CHANNELS.RECOVERY_SAVE, async (_, { filePath, content }: { filePath: string; content: string }) => {
    const recoveryDir = join(app.getPath('userData'), 'Recovery')
    await mkdir(recoveryDir, { recursive: true })
    const safeName = Buffer.from(filePath).toString('base64url')
    await writeFile(join(recoveryDir, `${safeName}.md`), content, 'utf-8')
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_CHECK, async (_, filePath: string) => {
    const recoveryDir = join(app.getPath('userData'), 'Recovery')
    const safeName = Buffer.from(filePath).toString('base64url')
    const recoveryPath = join(recoveryDir, `${safeName}.md`)
    try {
      await access(recoveryPath, constants.F_OK)
      const content = await readFile(recoveryPath, 'utf-8')
      return { hasRecovery: true, content }
    } catch {
      return { hasRecovery: false, content: null }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_CLEAR, async (_, filePath: string) => {
    const recoveryDir = join(app.getPath('userData'), 'Recovery')
    const safeName = Buffer.from(filePath).toString('base64url')
    const recoveryPath = join(recoveryDir, `${safeName}.md`)
    try {
      await unlink(recoveryPath)
    } catch {
      // Recovery file may not exist
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_WATCH_START, (_, filePath: string) => {
    if (fileWatchers.has(filePath)) return
    const watcher = chokidar.watch(filePath, { ignoreInitial: true })
    watcher.on('change', () => {
      for (const win of windows.values()) {
        win.webContents.send(IPC_CHANNELS.FILE_CHANGED_EXTERNAL, filePath)
      }
    })
    fileWatchers.set(filePath, watcher)
  })

  ipcMain.handle(IPC_CHANNELS.FILE_WATCH_STOP, (_, filePath: string) => {
    const watcher = fileWatchers.get(filePath)
    if (watcher) {
      watcher.close()
      fileWatchers.delete(filePath)
    }
  })

  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (_, { html, destinationPath, pageSize }: ExportOptions & { html: string }) => {
    const exportWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await exportWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdfBuffer = await exportWin.webContents.printToPDF({
      pageSize: pageSize ?? 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    })
    exportWin.close()
    await writeFile(destinationPath, pdfBuffer)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.EXPORT_HTML, async (_, { html, destinationPath }: { html: string; destinationPath: string }) => {
    await writeFile(destinationPath, html, 'utf-8')
    return { success: true }
  })
}

/**
 * Processes file paths from CLI or Finder launch arguments.
 */
function processLaunchFiles(argv: string[]): string[] {
  return argv
    .filter((arg) => !arg.startsWith('-') && SUPPORTED_EXTENSIONS.some((ext) => arg.toLowerCase().endsWith(ext)))
    .map((p) => (p.startsWith('/') ? p : join(process.cwd(), p)))
}

/**
 * Application entry point.
 */
function bootstrap(): void {
  log.initialize()
  log.info('MarkDoc starting')

  const isTestMode = process.env.MARKDOC_TEST === '1'
  const gotLock = isTestMode ? true : app.requestSingleInstanceLock()

  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', (_event, argv) => {
    const files = processLaunchFiles(argv.slice(1))
    const existing = BrowserWindow.getAllWindows()
    if (existing.length > 0) {
      for (const file of files) {
        existing[0].webContents.send('file:open-path', file)
      }
      existing[0].focus()
    } else {
      for (const file of files) {
        createDocumentWindow(file)
      }
    }
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (app.isReady()) {
      createDocumentWindow(filePath)
    } else {
      pendingOpenFiles.push(filePath)
    }
  })

  app.whenReady().then(async () => {
    await preferencesStore.load()
    createApplicationMenu()
    registerIpcHandlers()

    nativeTheme.on('updated', () => {
      for (const win of windows.values()) {
        win.webContents.send(IPC_CHANNELS.APP_THEME_CHANGED, {
          shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        })
      }
    })

    const launchFiles = [
      ...pendingOpenFiles,
      ...processLaunchFiles(process.argv.slice(1)),
    ]

    if (launchFiles.length > 0) {
      for (const file of launchFiles) {
        createDocumentWindow(file)
      }
    } else {
      createDocumentWindow()
    }

    pendingOpenFiles = []
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDocumentWindow()
    }
  })
}

bootstrap()
