import { join } from 'path'
import { SUPPORTED_EXTENSIONS } from './ipc'

export interface ParsedLaunchArgs {
  files: string[]
  newWindow: boolean
}

/**
 * Parses CLI/Finder launch arguments into file paths and flags.
 */
export function parseLaunchArgv({
  argv,
  cwd = process.cwd(),
}: {
  argv: string[]
  cwd?: string
}): ParsedLaunchArgs {
  let newWindow = false
  const files: string[] = []

  for (const arg of argv) {
    if (arg === '--new-window') {
      newWindow = true
      continue
    }

    if (arg.startsWith('-')) continue

    if (SUPPORTED_EXTENSIONS.some((ext) => arg.toLowerCase().endsWith(ext))) {
      files.push(arg.startsWith('/') ? arg : join(cwd, arg))
    }
  }

  return { files, newWindow }
}
