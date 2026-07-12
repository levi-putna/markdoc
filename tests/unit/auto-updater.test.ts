import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import {
  canInstallUpdate,
  registerAutoUpdaterEvents,
  startBackgroundUpdateChecks,
  checkForUpdatesManually,
  UPDATE_CHECK_INTERVAL_MS,
  type AutoUpdaterDeps,
  type UpdateWindowLike,
} from '../../src/main/auto-updater'

/**
 * A minimal stand-in for electron-updater's `autoUpdater` singleton. It's a
 * real `EventEmitter` (so `.on`/`.emit`/`.removeListener` behave exactly
 * like the real thing) with `checkForUpdates`/`quitAndInstall` mocked.
 * This lets every test below drive the module under test purely through
 * public events, without ever touching Electron or electron-updater.
 */
function createFakeAutoUpdater() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
  })
}

function createFakeDialog(response: number) {
  return { showMessageBox: vi.fn().mockResolvedValue({ response }) }
}

function createFakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function cleanWindow(): UpdateWindowLike {
  return { isDocumentEdited: () => false }
}

function dirtyWindow(): UpdateWindowLike {
  return { isDocumentEdited: () => true }
}

describe('canInstallUpdate', () => {
  it('returns true when there are no open windows', () => {
    expect(canInstallUpdate([])).toBe(true)
  })

  it('returns true when every window is clean', () => {
    expect(canInstallUpdate([cleanWindow(), cleanWindow()])).toBe(true)
  })

  it('returns false when any window has unsaved changes', () => {
    expect(canInstallUpdate([cleanWindow(), dirtyWindow()])).toBe(false)
  })
})

describe('registerAutoUpdaterEvents', () => {
  let autoUpdater: ReturnType<typeof createFakeAutoUpdater>
  let dialog: ReturnType<typeof createFakeDialog>
  let logger: ReturnType<typeof createFakeLogger>
  let windows: UpdateWindowLike[]
  let deps: AutoUpdaterDeps

  beforeEach(() => {
    autoUpdater = createFakeAutoUpdater()
    dialog = createFakeDialog(0)
    logger = createFakeLogger()
    windows = []
    deps = {
      autoUpdater,
      dialog,
      logger,
      getWindows: () => windows,
      isPackaged: true,
    }
  })

  it('enables autoDownload and autoInstallOnAppQuit', () => {
    registerAutoUpdaterEvents(deps)
    expect(autoUpdater.autoDownload).toBe(true)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('logs when checking for an update', () => {
    registerAutoUpdaterEvents(deps)
    autoUpdater.emit('checking-for-update')
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('checking for update'))
  })

  it('logs errors without throwing', () => {
    registerAutoUpdaterEvents(deps)
    const error = new Error('network down')
    expect(() => autoUpdater.emit('error', error)).not.toThrow()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed'), error)
  })

  it('logs when an update is available', () => {
    registerAutoUpdaterEvents(deps)
    autoUpdater.emit('update-available', { version: '1.2.3' })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1.2.3'))
  })

  it('logs when no update is available', () => {
    registerAutoUpdaterEvents(deps)
    autoUpdater.emit('update-not-available')
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('no update available'))
  })

  describe('update-downloaded', () => {
    it('prompts to restart and installs when the user accepts and all windows are clean', async () => {
      windows = [cleanWindow()]
      dialog = createFakeDialog(0) // "Restart Now"
      deps.dialog = dialog
      registerAutoUpdaterEvents(deps)

      autoUpdater.emit('update-downloaded', { version: '2.0.0' })
      await flushMicrotasks()

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(1)
      const options = dialog.showMessageBox.mock.calls[0][0]
      expect(options.detail).toContain('2.0.0')
      expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    it('does not install when the user picks "Later"', async () => {
      windows = [cleanWindow()]
      dialog = createFakeDialog(1) // "Later"
      deps.dialog = dialog
      registerAutoUpdaterEvents(deps)

      autoUpdater.emit('update-downloaded', { version: '2.0.0' })
      await flushMicrotasks()

      expect(dialog.showMessageBox).toHaveBeenCalledTimes(1)
      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })

    it('defers installation and never shows a dialog while a document has unsaved changes', async () => {
      windows = [cleanWindow(), dirtyWindow()]
      registerAutoUpdaterEvents(deps)

      autoUpdater.emit('update-downloaded', { version: '2.0.0' })
      await flushMicrotasks()

      expect(dialog.showMessageBox).not.toHaveBeenCalled()
      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('deferred'))
    })

    it('re-checks safety after the dialog resolves and skips install if a document became dirty in the meantime', async () => {
      windows = [cleanWindow()]
      dialog = createFakeDialog(0) // "Restart Now"
      deps.dialog = dialog
      registerAutoUpdaterEvents(deps)

      // Simulate the user starting to type while the confirmation dialog
      // is open, resolving only once we flip a window dirty.
      dialog.showMessageBox.mockImplementation(async () => {
        windows.push(dirtyWindow())
        return { response: 0 }
      })

      autoUpdater.emit('update-downloaded', { version: '2.0.0' })
      await flushMicrotasks()

      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })
  })
})

describe('startBackgroundUpdateChecks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing in unpackaged (dev) builds', () => {
    const autoUpdater = createFakeAutoUpdater()
    const logger = createFakeLogger()

    const handle = startBackgroundUpdateChecks({ autoUpdater, logger, isPackaged: false })

    expect(handle).toBeNull()
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('not packaged'))
  })

  it('checks immediately and then on every interval when packaged', () => {
    const autoUpdater = createFakeAutoUpdater()
    const logger = createFakeLogger()

    const handle = startBackgroundUpdateChecks({ autoUpdater, logger, isPackaged: true }, 1000)

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(2000)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(4)

    clearInterval(handle!)
  })

  it('defaults to a multi-hour interval', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBeGreaterThanOrEqual(60 * 60 * 1000)
  })

  it('logs and does not throw when a background check rejects', async () => {
    const autoUpdater = createFakeAutoUpdater()
    autoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'))
    const logger = createFakeLogger()

    startBackgroundUpdateChecks({ autoUpdater, logger, isPackaged: true }, 1000)
    await vi.advanceTimersByTimeAsync(0)

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('background check failed'), expect.any(Error))
  })
})

describe('checkForUpdatesManually', () => {
  it('resolves up-to-date without calling checkForUpdates in unpackaged builds', async () => {
    const autoUpdater = createFakeAutoUpdater()

    const result = await checkForUpdatesManually({ autoUpdater, isPackaged: false })

    expect(result).toEqual({ status: 'up-to-date' })
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('resolves update-available with the version when the library reports one', async () => {
    const autoUpdater = createFakeAutoUpdater()
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      autoUpdater.emit('update-available', { version: '9.9.9' })
    })

    const result = await checkForUpdatesManually({ autoUpdater, isPackaged: true })

    expect(result).toEqual({ status: 'update-available', version: '9.9.9' })
  })

  it('resolves up-to-date when the library reports no update', async () => {
    const autoUpdater = createFakeAutoUpdater()
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      autoUpdater.emit('update-not-available', { version: '1.0.0' })
    })

    const result = await checkForUpdatesManually({ autoUpdater, isPackaged: true })

    expect(result).toEqual({ status: 'up-to-date' })
  })

  it('resolves error when the check emits an error event', async () => {
    const autoUpdater = createFakeAutoUpdater()
    const error = new Error('feed unreachable')
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      autoUpdater.emit('error', error)
    })

    const result = await checkForUpdatesManually({ autoUpdater, isPackaged: true })

    expect(result).toEqual({ status: 'error', error })
  })

  it('resolves error when checkForUpdates itself rejects', async () => {
    const autoUpdater = createFakeAutoUpdater()
    const error = new Error('rejected before emitting anything')
    autoUpdater.checkForUpdates.mockRejectedValue(error)

    const result = await checkForUpdatesManually({ autoUpdater, isPackaged: true })

    expect(result).toEqual({ status: 'error', error })
  })

  it('cleans up its listeners after resolving, leaving no leaks', async () => {
    const autoUpdater = createFakeAutoUpdater()
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      autoUpdater.emit('update-not-available')
    })

    await checkForUpdatesManually({ autoUpdater, isPackaged: true })

    expect(autoUpdater.listenerCount('update-available')).toBe(0)
    expect(autoUpdater.listenerCount('update-not-available')).toBe(0)
    expect(autoUpdater.listenerCount('error')).toBe(0)
  })
})

/** Lets pending promise microtasks (e.g. an emitted event's async listener) settle. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
