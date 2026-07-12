/**
 * MarkDoc's auto-update policy, built on top of `electron-updater`.
 *
 * Every Electron / electron-updater object this module touches is received
 * as an injected dependency (see {@link AutoUpdaterDeps}) rather than
 * imported directly — the module never imports `electron` or
 * `electron-updater` at the value level. That keeps this file importable
 * (and unit-testable with plain fakes) outside of a real Electron runtime;
 * `src/main/index.ts` is the only place that wires the real singletons in.
 *
 * Policy summary:
 *  - Update checks and downloads are skipped entirely outside packaged
 *    builds (`isPackaged: false`), so local development never phones home
 *    and never fails trying to read update metadata that only exists in a
 *    packaged app (TR-6.6).
 *  - Once a downloaded update is ready, it is never installed while any
 *    open document window has unsaved changes (TR-14.3) — installation is
 *    deferred, and `autoInstallOnAppQuit` still covers a subsequent clean
 *    quit.
 *  - The manual "Check for Updates…" menu action reports its outcome back
 *    to the caller so it can show native-dialog feedback, mirroring the
 *    previous placeholder checker's UX.
 */

/** The subset of `BrowserWindow` this module needs to decide install safety. */
export interface UpdateWindowLike {
  isDocumentEdited(): boolean
}

/** The subset of electron-updater's `UpdateInfo` this module relies on. */
export interface UpdateInfoLike {
  version: string
}

/**
 * The subset of electron-updater's `autoUpdater` singleton this module
 * drives. `on`/`removeListener` intentionally use `any[]` (matching Node's
 * own `EventEmitter` typings) rather than a narrower type, so both the real
 * `autoUpdater` and a plain `EventEmitter`-based test double satisfy this
 * interface without casts.
 */
export interface AutoUpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener(event: string, listener: (...args: any[]) => void): unknown
}

/**
 * The subset of electron's `dialog` this module needs. Aliased directly
 * from `Electron.Dialog` (a type-only import, erased at build time — this
 * file never imports `electron` at the value level) so the real `dialog`
 * singleton is trivially assignable; this module only ever calls the
 * single-argument form.
 */
export type DialogLike = Pick<import('electron').Dialog, 'showMessageBox'>

/** The subset of electron-log's logger interface this module needs. */
export interface LoggerLike {
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface AutoUpdaterDeps {
  autoUpdater: AutoUpdaterLike
  dialog: DialogLike
  logger: LoggerLike
  /** Returns the currently open document windows, evaluated lazily (not a snapshot). */
  getWindows: () => UpdateWindowLike[]
  /** `app.isPackaged` — auto-update is a no-op in dev/unpackaged builds. */
  isPackaged: boolean
}

/** How often to silently poll for updates in the background. */
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * True only when every open document window is free of unsaved changes —
 * the single gate that decides whether it's safe to install a downloaded
 * update right now (TR-14.3).
 */
export function canInstallUpdate(windows: Iterable<UpdateWindowLike>): boolean {
  for (const win of windows) {
    if (win.isDocumentEdited()) return false
  }
  return true
}

/**
 * Registers the event handlers that drive MarkDoc's update policy. Safe to
 * call unconditionally, including in dev/unpackaged builds — it only wires
 * listeners and never itself triggers a network request.
 */
export function registerAutoUpdaterEvents(deps: AutoUpdaterDeps): void {
  const { autoUpdater, logger } = deps

  // We drive installation ourselves (gated on unsaved documents) rather
  // than letting electron-updater install immediately after download.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    logger.info('[auto-updater] checking for update')
  })

  autoUpdater.on('error', (error: Error) => {
    logger.error('[auto-updater] update check/download failed', error)
  })

  autoUpdater.on('update-available', (info: UpdateInfoLike) => {
    logger.info(`[auto-updater] update available: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('[auto-updater] no update available')
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfoLike) => {
    void promptToInstall(deps, info)
  })
}

/**
 * Called once an update has finished downloading. Defers installation
 * entirely if any open window has unsaved changes — the update still
 * installs automatically on the next clean app quit because
 * `autoInstallOnAppQuit` is enabled above. Otherwise asks the user whether
 * to restart now, re-checking safety immediately before installing in case
 * the user started typing while the dialog was open.
 */
async function promptToInstall(deps: AutoUpdaterDeps, info: UpdateInfoLike): Promise<void> {
  const { autoUpdater, dialog, logger, getWindows } = deps

  if (!canInstallUpdate(getWindows())) {
    logger.warn(`[auto-updater] update ${info.version} downloaded but deferred: unsaved documents open`)
    return
  }

  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: 'Update ready to install',
    detail: `MarkDoc ${info.version} has been downloaded. Restart now to finish installing it?`,
  })

  if (response === 0 && canInstallUpdate(getWindows())) {
    autoUpdater.quitAndInstall()
  }
}

/**
 * Starts the recurring background update check: one immediate check, then
 * one every `intervalMs`. Skipped entirely outside packaged builds so
 * local development never phones home. Returns the interval handle (or
 * `null` if skipped) so callers/tests can clear it.
 */
export function startBackgroundUpdateChecks(
  deps: Pick<AutoUpdaterDeps, 'autoUpdater' | 'logger' | 'isPackaged'>,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS
): ReturnType<typeof setInterval> | null {
  const { autoUpdater, logger, isPackaged } = deps

  if (!isPackaged) {
    logger.info('[auto-updater] skipping background checks: app is not packaged')
    return null
  }

  const runCheck = () => {
    autoUpdater.checkForUpdates().catch((error: Error) => {
      logger.error('[auto-updater] background check failed', error)
    })
  }

  runCheck()
  return setInterval(runCheck, intervalMs)
}

export type ManualUpdateCheckStatus = 'update-available' | 'up-to-date' | 'error'

export interface ManualUpdateCheckResult {
  status: ManualUpdateCheckStatus
  version?: string
  error?: Error
}

/**
 * Drives the "Check for Updates…" menu action: performs a single check and
 * resolves with a description of the outcome so the caller can show
 * native-dialog feedback. Always resolves (never rejects) — network and
 * update-metadata failures surface as `{ status: 'error' }`.
 */
export function checkForUpdatesManually(
  deps: Pick<AutoUpdaterDeps, 'autoUpdater' | 'isPackaged'>
): Promise<ManualUpdateCheckResult> {
  const { autoUpdater, isPackaged } = deps

  if (!isPackaged) {
    return Promise.resolve({ status: 'up-to-date' })
  }

  return new Promise((resolve) => {
    const onAvailable = (info: UpdateInfoLike) => {
      cleanup()
      resolve({ status: 'update-available', version: info.version })
    }
    const onNotAvailable = () => {
      cleanup()
      resolve({ status: 'up-to-date' })
    }
    const onError = (error: Error) => {
      cleanup()
      resolve({ status: 'error', error })
    }
    const cleanup = () => {
      autoUpdater.removeListener('update-available', onAvailable)
      autoUpdater.removeListener('update-not-available', onNotAvailable)
      autoUpdater.removeListener('error', onError)
    }

    autoUpdater.on('update-available', onAvailable)
    autoUpdater.on('update-not-available', onNotAvailable)
    autoUpdater.on('error', onError)

    autoUpdater.checkForUpdates().catch(onError)
  })
}
