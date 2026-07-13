import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import { migrateAiModelPreferences } from '@shared/ai/migrate-model-ids'
import { DEFAULT_PREFERENCES, type AppPreferences } from '../shared/ipc'

/**
 * Simple JSON file-based preferences store (TR-4.4).
 */
export class PreferencesStore {
  private configPath: string
  private cache: AppPreferences | null = null

  constructor() {
    this.configPath = join(app.getPath('userData'), 'config.json')
  }

  /**
   * Loads preferences from disk, falling back to defaults.
   */
  async load(): Promise<AppPreferences> {
    if (this.cache) return this.cache
    try {
      const raw = await readFile(this.configPath, 'utf-8')
      const merged = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } as AppPreferences
      const migrated = migrateAiModelPreferences({ preferences: merged })
      this.cache = migrated

      if (migrated !== merged) {
        await this.persist()
      }
    } catch {
      this.cache = { ...DEFAULT_PREFERENCES }
    }
    return this.cache ?? { ...DEFAULT_PREFERENCES }
  }

  /**
   * Returns the current preferences synchronously (must call load first).
   */
  get store(): AppPreferences {
    return this.cache ?? { ...DEFAULT_PREFERENCES }
  }

  /**
   * Gets a single preference value.
   */
  get<K extends keyof AppPreferences>(key: K): AppPreferences[K] {
    return this.store[key]
  }

  /**
   * Sets a single preference value and persists to disk.
   */
  async set<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]): Promise<void> {
    const current = await this.load()
    current[key] = value
    this.cache = current
    await this.persist()
  }

  /**
   * Merges partial preferences and persists to disk.
   */
  async merge(partial: Partial<AppPreferences>): Promise<AppPreferences> {
    const current = await this.load()
    this.cache = { ...current, ...partial }
    await this.persist()
    return this.cache
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }
}
