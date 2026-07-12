import { execFile } from 'child_process'
import { constants } from 'fs'
import { access, chmod, readlink, realpath, symlink, unlink } from 'fs/promises'
import { join, dirname, isAbsolute } from 'path'
import { promisify } from 'util'
import { app } from 'electron'
import type { CliInstallResult } from '../shared/ipc'

const execFileAsync = promisify(execFile)

const CLI_NAME = 'markdoc'

/** Candidate install directories, preferring Homebrew on Apple Silicon. */
const BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'] as const

/**
 * Resolves the bundled CLI script inside the app (dev or packaged).
 */
export function getCliScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'cli', CLI_NAME)
  }

  return join(app.getAppPath(), 'cli', CLI_NAME)
}

/**
 * Escapes a path for safe inclusion in a single-quoted shell argument.
 */
function shellEscape({ value }: { value: string }): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Resolves a path to its canonical form, returning null when it does not exist.
 */
async function resolveRealPath({ filePath }: { filePath: string }): Promise<string | null> {
  try {
    return await realpath(filePath)
  } catch {
    return null
  }
}

/**
 * Returns the first existing bin directory, preferring a writable one.
 */
async function getPreferredBinDir(): Promise<string> {
  for (const dir of BIN_DIRS) {
    try {
      await access(dir, constants.W_OK | constants.X_OK)
      return dir
    } catch {
      try {
        await access(dir, constants.F_OK)
        return dir
      } catch {
        continue
      }
    }
  }

  return '/usr/local/bin'
}

/**
 * Checks whether a symlink at `linkPath` points at the MarkDoc CLI script.
 */
async function isMarkdocCliSymlink({
  linkPath,
  sourcePath,
}: {
  linkPath: string
  sourcePath: string
}): Promise<boolean> {
  try {
    const linkTarget = await readlink(linkPath)
    const absoluteTarget = isAbsolute(linkTarget) ? linkTarget : join(dirname(linkPath), linkTarget)
    const [sourceReal, targetReal] = await Promise.all([
      resolveRealPath({ filePath: sourcePath }),
      resolveRealPath({ filePath: absoluteTarget }),
    ])

    return sourceReal !== null && sourceReal === targetReal
  } catch {
    return false
  }
}

/**
 * Returns whether the MarkDoc CLI is installed on the user's PATH.
 */
export async function isCliInstalled(): Promise<boolean> {
  const sourcePath = getCliScriptPath()

  for (const dir of BIN_DIRS) {
    const linkPath = join(dir, CLI_NAME)
    if (await isMarkdocCliSymlink({ linkPath, sourcePath })) {
      return true
    }
  }

  return false
}

/**
 * Returns the installed CLI symlink path, if present.
 */
export async function getCliInstallPath(): Promise<string | null> {
  const sourcePath = getCliScriptPath()

  for (const dir of BIN_DIRS) {
    const linkPath = join(dir, CLI_NAME)
    if (await isMarkdocCliSymlink({ linkPath, sourcePath })) {
      return linkPath
    }
  }

  return null
}

/**
 * Runs a shell command with administrator privileges via AppleScript.
 */
async function runWithAdminPrivileges({ command }: { command: string }): Promise<void> {
  const escapedCommand = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  await execFileAsync('osascript', [
    '-e',
    `do shell script "${escapedCommand}" with administrator privileges`,
  ])
}

/**
 * Creates or replaces the CLI symlink, escalating to admin when required.
 */
async function createCliSymlink({
  sourcePath,
  linkPath,
}: {
  sourcePath: string
  linkPath: string
}): Promise<CliInstallResult> {
  const escapedSource = shellEscape({ value: sourcePath })
  const escapedLink = shellEscape({ value: linkPath })

  try {
    await symlink(sourcePath, linkPath)
    return { success: true, installPath: linkPath }
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'EACCES' && err.code !== 'EPERM') {
      return { success: false, error: err.message ?? 'Failed to install the CLI helper.' }
    }
  }

  try {
    await runWithAdminPrivileges({
      command: `ln -sf ${escapedSource} ${escapedLink}`,
    })
    return { success: true, installPath: linkPath }
  } catch (error) {
    return {
      success: false,
      error:
        (error as Error).message ??
        'Administrator permission is required to install the CLI helper.',
    }
  }
}

/**
 * Removes the CLI symlink, escalating to admin when required.
 */
async function removeCliSymlink({ linkPath }: { linkPath: string }): Promise<void> {
  try {
    await unlink(linkPath)
    return
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return
    if (err.code !== 'EACCES' && err.code !== 'EPERM') throw error
  }

  await runWithAdminPrivileges({
    command: `rm -f ${shellEscape({ value: linkPath })}`,
  })
}

/**
 * Installs the MarkDoc CLI helper onto the user's PATH.
 */
export async function installCli(): Promise<CliInstallResult> {
  const sourcePath = getCliScriptPath()

  try {
    await access(sourcePath, constants.F_OK)
    await chmod(sourcePath, 0o755)
  } catch {
    return { success: false, error: 'The MarkDoc CLI script could not be found in the app bundle.' }
  }

  const existingPath = await getCliInstallPath()
  if (existingPath) {
    return { success: true, installPath: existingPath }
  }

  const binDir = await getPreferredBinDir()
  const linkPath = join(binDir, CLI_NAME)

  try {
    if (await isMarkdocCliSymlink({ linkPath, sourcePath })) {
      return { success: true, installPath: linkPath }
    }

    try {
      await unlink(linkPath)
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code !== 'ENOENT') {
        const target = await readlink(linkPath).catch(() => null)
        if (target) {
          return {
            success: false,
            error: `Another program is already installed as ${linkPath}. Remove it manually before installing MarkDoc.`,
          }
        }
      }
    }
  } catch (error) {
    return { success: false, error: (error as Error).message ?? 'Failed to install the CLI helper.' }
  }

  return createCliSymlink({ sourcePath, linkPath })
}

/**
 * Removes the MarkDoc CLI helper from the user's PATH.
 */
export async function uninstallCli(): Promise<CliInstallResult> {
  const sourcePath = getCliScriptPath()
  let removed = false

  for (const dir of BIN_DIRS) {
    const linkPath = join(dir, CLI_NAME)
    if (!(await isMarkdocCliSymlink({ linkPath, sourcePath }))) continue

    try {
      await removeCliSymlink({ linkPath })
      removed = true
    } catch (error) {
      return { success: false, error: (error as Error).message ?? 'Failed to uninstall the CLI helper.' }
    }
  }

  if (!removed) {
    return { success: true }
  }

  return { success: true }
}
