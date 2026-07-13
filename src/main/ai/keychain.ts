import { safeStorage } from 'electron'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

const KEY_FILENAME = 'ai-gateway-key.enc'

/**
 * Returns the path to the encrypted API key file.
 */
function keyFilePath(): string {
  return join(app.getPath('userData'), KEY_FILENAME)
}

/**
 * Stores the Vercel AI Gateway API key using Electron safeStorage.
 */
export async function setApiKey({ apiKey }: { apiKey: string }): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system.')
  }
  const encrypted = safeStorage.encryptString(apiKey)
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(keyFilePath(), encrypted)
}

/**
 * Retrieves the stored API key, or null if none is set.
 */
export async function getApiKey(): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const encrypted = await readFile(keyFilePath())
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

/**
 * Returns whether an API key is stored.
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey()
  return Boolean(key && key.length > 0)
}

/**
 * Removes the stored API key.
 */
export async function clearApiKey(): Promise<void> {
  try {
    await unlink(keyFilePath())
  } catch {
    // Key file may not exist
  }
}
