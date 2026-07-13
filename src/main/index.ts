import { app, BrowserWindow, ipcMain, dialog, nativeTheme, Menu, shell, clipboard, session, type WebContents } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, dirname, basename, extname } from 'path'
import { pathToFileURL } from 'url'
import { tmpdir } from 'os'
import { readFile, writeFile, mkdir, access, unlink, mkdtemp, rm, cp, rename } from 'fs/promises'
import { constants, existsSync } from 'fs'
import log from 'electron-log'
import chokidar from 'chokidar'
import icon from '../../resources/icon.png?asset'
import { PreferencesStore } from './preferences-store'
import { openExternalUrl, registerExternalLinkHandlers } from './external-links'
import {
  IPC_CHANNELS,
  type AppPreferences,
  type FileReadResult,
  type FileWritePayload,
  type ExportPdfPayload,
  type ExportHtmlPayload,
  type ExportDocxPayload,
  type ExportResult,
  type StyleOverride,
  type WindowState,
  type AssetWritePayload,
  type FileOperationResult,
} from '../shared/ipc'
import { parseMarkdownFile, serializeMarkdownFile, getAssetFolderPath, getStyleSidecarPath } from '../shared/file-utils'
import { exportToDocx, wrapStandaloneHtml } from '../shared/export'
import { loadStyleOverrides, saveStyleOverrides } from '../shared/style-engine'
import { findBrokenImageRefs, relativeAssetPath, generateImageFilename } from '../shared/asset-utils'
import { rewriteAssetFolderInMarkdown, resolveLocalImagePath } from '../shared/image-paths'
import { isRemoteImageSrc } from '../shared/image-src'
import { checkForUpdatesManually, registerAutoUpdaterEvents, startBackgroundUpdateChecks } from './auto-updater'
import { getCliInstallPath, installCli, isCliInstalled, uninstallCli } from './cli-installer'
import { parseLaunchArgv } from '../shared/launch-args'
import { registerAiIpcHandlers } from './ai/register-ai-handlers'

const preferencesStore = new PreferencesStore()

const windows = new Map<number, BrowserWindow>()
const windowStates = new Map<number, Partial<WindowState>>()
const fileWatchers = new Map<string, ReturnType<typeof chokidar.watch>>()
// Windows waiting on a save round-trip before they can close
const pendingCloseWindows = new Set<number>()
let pendingOpenFiles: string[] = []

/**
 * Resolves the window a menu action should target. Prefers the OS-reported
 * focused window, but only if it's actually a document window — menu actions
 * like Open/Save only make sense there, and `windows` is exactly the set of
 * windows whose renderer has a `DocumentWindow` mounted (Preferences and any
 * other utility window are deliberately excluded). Without this check, a
 * focused Preferences window (or any other non-document window) would
 * silently swallow the action: its renderer never listens for it, so e.g. a
 * picked file path from File > Open would be sent nowhere and the document
 * would never load. Falls back to the most recently created document window
 * — `getFocusedWindow()` can legitimately return null (e.g. right after
 * programmatic focus, or in automated/scripted contexts) even though
 * there's an obvious single window the action should apply to.
 */
function getTargetWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && windows.has(focused.id)) return focused
  return [...windows.values()].at(-1) ?? null
}

/**
 * Populates the native macOS About panel with MarkDoc's version information,
 * so `role: 'about'` shows something more useful than the Electron defaults.
 *
 * Follows Apple's About panel layout (`NSApplication.AboutPanelOptionKey`):
 * icon, `applicationName`, "Version `applicationVersion`", `credits`,
 * `copyright`. The `credits` field surfaces the underlying runtime versions
 * — Electron, Chromium, Node, and V8 — which is the convention most
 * Electron apps (VS Code, Slack, Discord) use for their About screen, since
 * that's usually the first thing a bug report needs.
 */
function configureAboutPanel(): void {
  const { electron, chrome, node, v8 } = process.versions

  app.setAboutPanelOptions({
    applicationName: 'MarkDoc',
    applicationVersion: app.getVersion(),
    copyright: `Copyright © ${new Date().getFullYear()} MarkDoc`,
    credits: `Electron ${electron} · Chromium ${chrome} · Node ${node} · V8 ${v8}`,
    // Without an explicit iconPath, macOS falls back to the generic
    // Electron icon instead of MarkDoc's own — same reasoning as the
    // Dock icon override below.
    iconPath: icon,
  })
}

/**
 * Checks for a newer MarkDoc version and reports the outcome to the user
 * via a native dialog — whether an update is now downloading in the
 * background, the app is already up to date, or the check failed (e.g. no
 * network connection). In dev/unpackaged builds this always reports "up to
 * date" without touching the network, since there's no update feed to
 * check against.
 */
async function checkForUpdatesAndNotify(win: BrowserWindow | null): Promise<void> {
  // showMessageBox's typings require the window argument to be omitted
  // entirely (not just undefined) when there's no parent to attach to.
  const showDialog = (options: Electron.MessageBoxOptions) =>
    win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)

  const result = await checkForUpdatesManually({ autoUpdater, isPackaged: app.isPackaged })

  if (result.status === 'update-available') {
    await showDialog({
      type: 'info',
      message: 'A new version of MarkDoc is available',
      detail: `Version ${result.version} is downloading in the background. You'll be prompted to restart once it's ready to install.`,
    })
  } else if (result.status === 'error') {
    log.error('Failed to check for updates', result.error)
    await showDialog({
      type: 'error',
      message: 'Unable to check for updates',
      detail: 'Please check your internet connection and try again.',
    })
  } else {
    await showDialog({
      type: 'info',
      message: "You're up to date",
      detail: `MarkDoc ${app.getVersion()} is the latest version.`,
    })
  }
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
              {
                label: 'Check for Updates…',
                click: () => checkForUpdatesAndNotify(getTargetWindow()),
              },
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
        {
          label: 'Duplicate',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            getTargetWindow()?.webContents.send('menu:duplicate')
          },
        },
        {
          label: 'Rename…',
          click: () => {
            getTargetWindow()?.webContents.send('menu:rename')
          },
        },
        {
          label: 'Move To…',
          click: () => {
            getTargetWindow()?.webContents.send('menu:move-to')
          },
        },
        {
          label: 'Revert to Saved',
          click: () => {
            getTargetWindow()?.webContents.send('menu:revert')
          },
        },
        { type: 'separator' },
        {
          label: 'Export To…',
          accelerator: 'CmdOrCtrl+E',
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
        {
          label: 'Toggle Assistant',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            getTargetWindow()?.webContents.send('menu:toggle-assistant')
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
        {
          label: 'Document Styles…',
          click: () => {
            getTargetWindow()?.webContents.send('menu:document-styles')
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Show Logs in Finder',
          click: () => {
            shell.openPath(join(app.getPath('logs'), 'MarkDoc'))
          },
        },
        {
          label: 'Copy Diagnostic Info',
          click: async () => {
            const { electron, chrome, node } = process.versions
            const info = [
              `MarkDoc ${app.getVersion()}`,
              `macOS ${process.getSystemVersion()}`,
              `Electron ${electron} · Chromium ${chrome} · Node ${node}`,
              `Arch ${process.arch}`,
            ].join('\n')
            clipboard.writeText(info)
            const win = getTargetWindow()
            if (win) {
              await dialog.showMessageBox(win, {
                type: 'info',
                message: 'Diagnostic info copied to clipboard',
              })
            }
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Creates a new document window.
 */
function createDocumentWindow({
  filePath,
  restoredState,
}: {
  filePath?: string
  restoredState?: WindowState
} = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: restoredState?.bounds.width ?? 1200,
    height: restoredState?.bounds.height ?? 800,
    x: restoredState?.bounds.x,
    y: restoredState?.bounds.y,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    show: false,
    icon,
    tabbingIdentifier: 'markdoc-document',
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
    const openPath = filePath ?? restoredState?.filePath ?? undefined
    if (openPath) {
      win.webContents.send('file:open-path', openPath)
    }
    if (restoredState) {
      win.webContents.send('window:restore-state', restoredState)
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
    windowStates.delete(win.id)
    void persistSessionState()
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
 * Loads the dedicated Preferences renderer into a window.
 */
function loadPreferencesWindow(win: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const baseUrl = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
    void win.loadURL(`${baseUrl}/preferences.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/preferences.html'))
  }
}

/**
 * Opens the Preferences window.
 */
function createPreferencesWindow(): void {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.focus()
    // Re-load in case an older build pointed this window at the document shell.
    loadPreferencesWindow(preferencesWindow)
    return
  }

  preferencesWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 520,
    minHeight: 400,
    maxWidth: 960,
    maxHeight: 720,
    resizable: true,
    title: 'Preferences',
    icon,
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

  loadPreferencesWindow(preferencesWindow)
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
 * Waits for web fonts and images to finish loading in the export window
 * before calling `printToPDF`, since printing immediately after
 * `did-finish-load` can capture a partially laid-out page.
 */
async function waitForExportPageReady(webContents: WebContents): Promise<void> {
  await webContents.executeJavaScript(`
    (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve;
                })
        )
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()
  `)
}

/**
 * Persists open window states for session restoration (FR-5.9).
 */
async function persistSessionState(): Promise<void> {
  const states: WindowState[] = []
  for (const [id, win] of windows.entries()) {
    const saved = windowStates.get(id)
    if (!saved) continue
    states.push({
      filePath: saved.filePath ?? null,
      bounds: win.getBounds(),
      viewMode: saved.viewMode ?? 'edit',
      sidebarVisible: saved.sidebarVisible ?? true,
      sidebarWidth: saved.sidebarWidth ?? 240,
      assistantVisible: saved.assistantVisible ?? false,
      assistantWidth: saved.assistantWidth ?? 320,
    })
  }
  await preferencesStore.merge({ windowStates: states })
}

/**
 * Registers IPC handlers for file and preference operations.
 */
function registerIpcHandlers(): void {
  registerAiIpcHandlers({ preferencesStore })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_PREFERENCES, async () => {
    createPreferencesWindow()
  })

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_, { url }: { url: string }) => {
    await openExternalUrl(url)
  })

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

  ipcMain.handle(IPC_CHANNELS.DIALOG_FOLDER, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.filePaths[0] ?? null
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

  ipcMain.handle(IPC_CHANNELS.DIALOG_EXPORT, async (event, format: 'pdf' | 'docx' | 'html', defaultName?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const extensions: Record<string, string[]> = {
      pdf: ['pdf'],
      docx: ['docx'],
      html: ['html'],
    }
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: format.toUpperCase(), extensions: extensions[format] }],
    })
    return result.filePath ?? null
  })

  ipcMain.handle(IPC_CHANNELS.PREFS_GET, async () => syncCliInstalledPreference())

  ipcMain.handle(IPC_CHANNELS.PREFS_SET, async (_, prefs: Partial<AppPreferences>) => {
    const updated = await preferencesStore.merge(prefs)
    broadcastPreferencesChanged(updated)
    return updated
  })

  ipcMain.handle(IPC_CHANNELS.CLI_STATUS, async () => {
    const installed = await isCliInstalled()
    return {
      installed,
      installPath: installed ? await getCliInstallPath() : null,
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLI_INSTALL, async () => {
    const result = await installCli()
    if (result.success) {
      const updated = await preferencesStore.merge({ cliInstalled: true })
      broadcastPreferencesChanged(updated)
    }
    return result
  })

  ipcMain.handle(IPC_CHANNELS.CLI_UNINSTALL, async () => {
    const result = await uninstallCli()
    if (result.success) {
      const updated = await preferencesStore.merge({ cliInstalled: false })
      broadcastPreferencesChanged(updated)
    }
    return result
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

  // Export handlers (Section 12 of functional-requirements.md). Each is a
  // request-response IPC call (TR-5.1) that resolves with `ExportResult`
  // rather than throwing across the bridge, so a failing stage — render,
  // rasterize, or write-to-disk — surfaces a clear message to the renderer
  // instead of an unhandled rejection (FR-11.6/TR-10.5).
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_PDF,
    async (
      _,
      { bodyHtml, css, isDark, title, destinationPath, pageSize, margins }: ExportPdfPayload
    ): Promise<ExportResult> => {
      let exportWin: BrowserWindow | null = null
      let tempDir: string | null = null
      try {
        const html = wrapStandaloneHtml({ bodyHtml, css, isDark, title })
        // Write to a temp file instead of a data URL — long documents with
        // inlined CSS can exceed Chromium's data-URL length limits and get
        // silently truncated.
        tempDir = await mkdtemp(join(tmpdir(), 'markdoc-export-'))
        const tempHtmlPath = join(tempDir, 'export.html')
        await writeFile(tempHtmlPath, html, 'utf-8')

        exportWin = new BrowserWindow({
          show: false,
          width: 794,
          height: 1123,
          webPreferences: { sandbox: true },
        })
        await exportWin.loadFile(tempHtmlPath)
        await waitForExportPageReady(exportWin.webContents)

        const pdfBuffer = await exportWin.webContents.printToPDF({
          pageSize: pageSize ?? 'A4',
          margins: margins ?? { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
          printBackground: true,
        })
        await writeFile(destinationPath, pdfBuffer)
        return { success: true }
      } catch (error) {
        log.error('PDF export failed', error)
        return { success: false, error: (error as Error).message ?? 'Failed to export PDF' }
      } finally {
        exportWin?.close()
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {})
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_HTML,
    async (_, { bodyHtml, css, isDark, title, destinationPath }: ExportHtmlPayload): Promise<ExportResult> => {
      try {
        const html = wrapStandaloneHtml({ bodyHtml, css, isDark, title })
        await writeFile(destinationPath, html, 'utf-8')
        return { success: true }
      } catch (error) {
        log.error('HTML export failed', error)
        return { success: false, error: (error as Error).message ?? 'Failed to export HTML' }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_DOCX,
    async (_, { doc, title, documentDir, destinationPath }: ExportDocxPayload): Promise<ExportResult> => {
      try {
        const { buffer, warnings } = await exportToDocx({ doc, title, documentDir })
        await writeFile(destinationPath, buffer)
        return { success: true, warnings: warnings.length > 0 ? warnings : undefined }
      } catch (error) {
        log.error('DOCX export failed', error)
        return { success: false, error: (error as Error).message ?? 'Failed to export DOCX' }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.ASSET_WRITE, async (_, payload: AssetWritePayload) => {
    const assetFolder = getAssetFolderPath(payload.documentPath)
    await mkdir(assetFolder, { recursive: true })
    const buffer = Buffer.from(payload.dataBase64, 'base64')
    const absolutePath = join(assetFolder, payload.filename)
    await writeFile(absolutePath, buffer)
    const relativePath = relativeAssetPath({
      documentPath: payload.documentPath,
      filename: payload.filename,
    })
    return { relativePath, absolutePath }
  })

  ipcMain.handle(
    IPC_CHANNELS.ASSET_READ,
    async (_, { documentPath, relativePath }: { documentPath: string; relativePath: string }) => {
      const absolutePath = join(dirname(documentPath), relativePath)
      const buffer = await readFile(absolutePath)
      const ext = extname(relativePath).toLowerCase()
      const mimeType =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.webp'
                ? 'image/webp'
                : 'application/octet-stream'
      return { dataBase64: buffer.toString('base64'), mimeType }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.ASSET_IMPORT,
    async (_, { documentPath, sourcePath }: { documentPath: string; sourcePath: string }) => {
      const assetFolder = getAssetFolderPath(documentPath)
      await mkdir(assetFolder, { recursive: true })
      const ext = extname(sourcePath).toLowerCase()
      const mimeType =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.webp'
                ? 'image/webp'
                : 'image/png'
      const filename = generateImageFilename({ mimeType })
      const absolutePath = join(assetFolder, filename)
      await cp(sourcePath, absolutePath)
      const relativePath = relativeAssetPath({ documentPath, filename })
      return { relativePath, absolutePath }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.RESOLVE_IMAGE_SRC,
    async (_, { documentPath, src }: { documentPath: string; src: string }) => {
      if (isRemoteImageSrc({ src })) return src.trim()
      const absolutePath = resolveLocalImagePath({ documentPath, src })
      if (!absolutePath || !existsSync(absolutePath)) return null
      return pathToFileURL(absolutePath).href
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SAVE_AS_WITH_ASSETS,
    async (
      _,
      {
        oldFilePath,
        newFilePath,
        markdown,
        frontMatter = {},
      }: {
        oldFilePath: string | null
        newFilePath: string
        markdown: string
        frontMatter?: Record<string, unknown>
      }
    ) => {
      let updatedMarkdown = markdown

      if (oldFilePath) {
        updatedMarkdown = rewriteAssetFolderInMarkdown({
          markdown,
          oldDocumentPath: oldFilePath,
          newDocumentPath: newFilePath,
        })

        const oldAssetFolder = getAssetFolderPath(oldFilePath)
        const newAssetFolder = getAssetFolderPath(newFilePath)

        if (existsSync(oldAssetFolder) && oldAssetFolder !== newAssetFolder) {
          await mkdir(dirname(newAssetFolder), { recursive: true })
          if (existsSync(newAssetFolder)) {
            await cp(oldAssetFolder, newAssetFolder, { recursive: true, force: true })
          } else {
            await cp(oldAssetFolder, newAssetFolder, { recursive: true })
          }
        }
      }

      await writeMarkdownFile({ filePath: newFilePath, markdown: updatedMarkdown, frontMatter })
      app.addRecentDocument(newFilePath)
      return { success: true, markdown: updatedMarkdown }
    }
  )

  ipcMain.handle(IPC_CHANNELS.STYLE_LOAD, async (_, documentPath: string) => {
    return loadStyleOverrides(getStyleSidecarPath(documentPath))
  })

  ipcMain.handle(
    IPC_CHANNELS.STYLE_SAVE,
    async (_, { documentPath, overrides }: { documentPath: string; overrides: StyleOverride }) => {
      saveStyleOverrides(getStyleSidecarPath(documentPath), overrides)
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.STYLE_RESET, async (_, documentPath: string) => {
    const sidecar = getStyleSidecarPath(documentPath)
    try {
      await unlink(sidecar)
    } catch {
      // Sidecar may not exist
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_SAVE_STATE, async (event, state: WindowState) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    windowStates.set(win.id, state)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE, async () => {
    await persistSessionState()
  })

  ipcMain.handle(
    IPC_CHANNELS.FILE_DUPLICATE,
    async (
      _,
      {
        filePath,
        markdown,
        frontMatter,
      }: { filePath: string; markdown: string; frontMatter: Record<string, unknown> }
    ): Promise<FileOperationResult> => {
      try {
        const dir = dirname(filePath)
        const base = basename(filePath).replace(/\.(md|markdown|mdown|mkd)$/i, '')
        const ext = extname(filePath) || '.md'
        let candidate = join(dir, `${base} copy${ext}`)
        let counter = 2
        while (existsSync(candidate)) {
          candidate = join(dir, `${base} copy ${counter}${ext}`)
          counter += 1
        }
        await writeMarkdownFile({ filePath: candidate, markdown, frontMatter })
        const assetFolder = getAssetFolderPath(filePath)
        if (existsSync(assetFolder)) {
          await cp(assetFolder, getAssetFolderPath(candidate), { recursive: true })
        }
        const sidecar = getStyleSidecarPath(filePath)
        if (existsSync(sidecar)) {
          await cp(sidecar, getStyleSidecarPath(candidate))
        }
        return { success: true, newPath: candidate }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_RENAME,
    async (_, { filePath, newName }: { filePath: string; newName: string }): Promise<FileOperationResult> => {
      try {
        const dir = dirname(filePath)
        const newPath = join(dir, newName)
        await rename(filePath, newPath)
        const assetFolder = getAssetFolderPath(filePath)
        if (existsSync(assetFolder)) {
          await rename(assetFolder, getAssetFolderPath(newPath))
        }
        const sidecar = getStyleSidecarPath(filePath)
        if (existsSync(sidecar)) {
          await rename(sidecar, getStyleSidecarPath(newPath))
        }
        return { success: true, newPath }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_MOVE,
    async (
      _,
      { filePath, destinationDir }: { filePath: string; destinationDir: string }
    ): Promise<FileOperationResult> => {
      try {
        const newPath = join(destinationDir, basename(filePath))
        await rename(filePath, newPath)
        const assetFolder = getAssetFolderPath(filePath)
        if (existsSync(assetFolder)) {
          await rename(assetFolder, getAssetFolderPath(newPath))
        }
        const sidecar = getStyleSidecarPath(filePath)
        if (existsSync(sidecar)) {
          await rename(sidecar, getStyleSidecarPath(newPath))
        }
        return { success: true, newPath }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.FILE_REVERT, async (_, filePath: string) => {
    try {
      return await readMarkdownFile(filePath)
    } catch {
      return null
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.FILE_CHECK_IMAGES,
    async (_, { documentPath, markdown }: { documentPath: string; markdown: string }) => {
      return findBrokenImageRefs({
        markdown,
        documentPath,
        existsFn: (absolutePath) => existsSync(absolutePath),
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.DIALOG_IMAGE_PICK, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    })
    if (!result.filePaths[0]) return null
    const sourcePath = result.filePaths[0]
    const ext = extname(sourcePath).toLowerCase()
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : 'application/octet-stream'
    return {
      sourcePath,
      mimeType,
      filename: basename(sourcePath),
    }
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_LOGS, async () => {
    await shell.openPath(join(app.getPath('logs'), 'MarkDoc'))
  })

  ipcMain.handle(IPC_CHANNELS.COPY_DIAGNOSTICS, async () => {
    const { electron, chrome, node } = process.versions
    const info = [
      `MarkDoc ${app.getVersion()}`,
      `macOS ${process.getSystemVersion()}`,
      `Electron ${electron} · Chromium ${chrome} · Node ${node}`,
      `Arch ${process.arch}`,
    ].join('\n')
    clipboard.writeText(info)
    return info
  })
}

/**
 * Broadcasts preference changes to every open window.
 */
function broadcastPreferencesChanged(prefs: AppPreferences): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.PREFS_CHANGED, prefs)
    }
  }
}

/**
 * Opens files received from the CLI, Finder, or cold-start argv.
 */
function openLaunchFiles({
  files,
  newWindow,
}: {
  files: string[]
  newWindow: boolean
}): void {
  if (files.length === 0) {
    const existing = BrowserWindow.getAllWindows()
    if (existing.length > 0) {
      existing[0].focus()
    } else {
      createDocumentWindow()
    }
    return
  }

  if (newWindow) {
    for (const file of files) {
      createDocumentWindow({ filePath: file })
    }
    return
  }

  const existing = [...windows.values()]
  if (existing.length > 0) {
    for (const file of files) {
      createDocumentWindow({ filePath: file })
    }
    existing[0].focus()
  } else {
    for (const file of files) {
      createDocumentWindow({ filePath: file })
    }
  }
}

/**
 * Syncs the stored CLI install flag with the filesystem.
 */
async function syncCliInstalledPreference(): Promise<AppPreferences> {
  const prefs = await preferencesStore.load()
  const installed = await isCliInstalled()

  if (installed === prefs.cliInstalled) {
    return prefs
  }

  return preferencesStore.merge({ cliInstalled: installed })
}


/**
 * Application entry point.
 */
function bootstrap(): void {
  // Must run before any other app.* call — it's what makes the app menu,
  // Dock, About panel, and OS-level process name (Activity Monitor, `ps`)
  // read "MarkDoc" rather than falling back to the lowercase package.json
  // "name" field or, in an unpackaged dev build, "Electron".
  app.setName('MarkDoc')

  log.initialize()
  log.info('MarkDoc starting')

  const isTestMode = process.env.MARKDOC_TEST === '1'
  const gotLock = isTestMode ? true : app.requestSingleInstanceLock()

  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', (_event, argv, workingDirectory) => {
    const { files, newWindow } = parseLaunchArgv({
      argv: argv.slice(1),
      cwd: workingDirectory,
    })
    openLaunchFiles({ files, newWindow })
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (app.isReady()) {
      createDocumentWindow({ filePath })
    } else {
      pendingOpenFiles.push(filePath)
    }
  })

  app.whenReady().then(async () => {
    // Packaged builds pick up build/icon.icns automatically; in dev the Dock
    // otherwise shows the generic Electron icon, so set it explicitly.
    if (process.platform === 'darwin' && !app.isPackaged) {
      app.dock?.setIcon(icon)
    }

    await preferencesStore.load()
    configureAboutPanel()
    createApplicationMenu()
    registerExternalLinkHandlers()
    registerIpcHandlers()

    // Spellchecker language follows system locale (TR-2.13)
    session.defaultSession.setSpellCheckerLanguages(
      app.getLocale() ? [app.getLocale()] : ['en-AU']
    )

    app.on('before-quit', () => {
      void persistSessionState()
    })

    // Real auto-update: silently checks/downloads in the background and
    // only ever prompts once a download is ready (TR-6.6). No-op in
    // dev/unpackaged builds. See src/main/auto-updater.ts for policy.
    registerAutoUpdaterEvents({
      autoUpdater,
      dialog,
      logger: log,
      getWindows: () => [...windows.values()],
      isPackaged: app.isPackaged,
    })
    startBackgroundUpdateChecks({ autoUpdater, logger: log, isPackaged: app.isPackaged })

    nativeTheme.on('updated', () => {
      for (const win of windows.values()) {
        win.webContents.send(IPC_CHANNELS.APP_THEME_CHANGED, {
          shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        })
      }
    })

    const coldLaunch = parseLaunchArgv({
      argv: process.argv.slice(1),
      cwd: process.cwd(),
    })
    const launchFiles = [...pendingOpenFiles, ...coldLaunch.files]
    const prefs = await preferencesStore.load()

    if (launchFiles.length > 0) {
      openLaunchFiles({ files: launchFiles, newWindow: coldLaunch.newWindow })
    } else if (prefs.windowStates.length > 0) {
      for (const state of prefs.windowStates) {
        createDocumentWindow({ restoredState: state })
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
