import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Loads per-document style overrides from a sidecar JSON file.
 */
export function loadStyleOverrides(sidecarPath: string): Record<string, string> {
  if (!existsSync(sidecarPath)) return {}
  try {
    const raw = readFileSync(sidecarPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const cssVars: Record<string, string> = {}
    if (parsed.bodyColor) cssVars['--content-text'] = String(parsed.bodyColor)
    if (parsed.bodyFontSize) cssVars['--editor-font-size'] = String(parsed.bodyFontSize)
    if (parsed.bodyFontFamily) cssVars['--editor-font-family'] = String(parsed.bodyFontFamily)
    if (parsed.headingColors && typeof parsed.headingColors === 'object') {
      for (const [level, color] of Object.entries(parsed.headingColors as Record<string, string>)) {
        cssVars[`--content-heading-${level.replace('h', '')}`] = color
      }
    }
    return cssVars
  } catch {
    return {}
  }
}

/**
 * Saves style overrides to a sidecar JSON file.
 */
export function saveStyleOverrides(
  sidecarPath: string,
  overrides: Record<string, unknown>
): void {
  writeFileSync(sidecarPath, JSON.stringify({ version: 1, ...overrides }, null, 2), 'utf-8')
}

/**
 * Applies CSS custom property overrides to a DOM element.
 */
export function applyStyleOverrides(
  element: HTMLElement,
  overrides: Record<string, string>
): void {
  for (const [key, value] of Object.entries(overrides)) {
    element.style.setProperty(key, value)
  }
}

/**
 * Copies an image buffer into the document asset folder.
 */
export function writeImageAsset({
  assetFolder,
  filename,
  data,
}: {
  assetFolder: string
  filename: string
  data: Buffer
}): string {
  if (!existsSync(assetFolder)) {
    mkdirSync(assetFolder, { recursive: true })
  }
  const dest = join(assetFolder, filename)
  writeFileSync(dest, data)
  return dest
}
