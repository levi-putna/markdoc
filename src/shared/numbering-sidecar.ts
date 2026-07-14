import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import type { NumberingConfig, HeadingNumberingOverride, NumberingSidecar } from './heading-numbering'
import {
  DEFAULT_NUMBERING_CONFIG,
  parseNumberingSidecar,
  serializeNumberingSidecar,
} from './heading-numbering'

export type NumberingLoadResult = {
  config: NumberingConfig
  overrides: Record<string, HeadingNumberingOverride>
}

/**
 * Loads heading-numbering settings from a sidecar JSON file.
 */
export function loadNumberingSidecar(sidecarPath: string): NumberingLoadResult {
  if (!existsSync(sidecarPath)) {
    return { config: { ...DEFAULT_NUMBERING_CONFIG }, overrides: {} }
  }
  try {
    const raw = JSON.parse(readFileSync(sidecarPath, 'utf-8')) as unknown
    return parseNumberingSidecar({ raw })
  } catch {
    return { config: { ...DEFAULT_NUMBERING_CONFIG }, overrides: {} }
  }
}

/**
 * Saves heading-numbering settings to a sidecar JSON file.
 */
export function saveNumberingSidecar({
  sidecarPath,
  config,
  overrides = {},
}: {
  sidecarPath: string
  config: NumberingConfig
  overrides?: Record<string, HeadingNumberingOverride>
}): void {
  const payload: NumberingSidecar = serializeNumberingSidecar({ config, overrides })
  writeFileSync(sidecarPath, JSON.stringify(payload, null, 2), 'utf-8')
}

/**
 * Deletes the numbering sidecar if it exists.
 */
export function resetNumberingSidecar(sidecarPath: string): void {
  if (existsSync(sidecarPath)) {
    unlinkSync(sidecarPath)
  }
}
