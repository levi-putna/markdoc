import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'path'
import { existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs'
import {
  loadNumberingSidecar,
  saveNumberingSidecar,
  resetNumberingSidecar,
} from '@shared/numbering-sidecar'
import { getNumberingSidecarPath } from '@shared/file-utils'
import { DEFAULT_NUMBERING_CONFIG } from '@shared/heading-numbering'

const sidecarPath = join(__dirname, '../fixtures/test-numbering.markdoc-numbering.json')
const fixturePath = join(__dirname, '../fixtures/with-numbering.markdoc-numbering.json')

/**
 * Removes a temp sidecar created during a test, if present.
 */
function cleanupTempSidecar(): void {
  if (existsSync(sidecarPath)) unlinkSync(sidecarPath)
}

describe('TC-NUMBER.9/10 numbering sidecar file I/O', () => {
  afterEach(() => {
    cleanupTempSidecar()
  })

  it('TC-NUMBER.9 maps document paths to .markdoc-numbering.json', () => {
    expect(getNumberingSidecarPath('/path/to/notes.md')).toBe(
      '/path/to/notes.markdoc-numbering.json'
    )
    expect(getNumberingSidecarPath('/path/to/notes.markdown')).toBe(
      '/path/to/notes.markdoc-numbering.json'
    )
    expect(getNumberingSidecarPath('/path/to/notes.mdown')).toBe(
      '/path/to/notes.markdoc-numbering.json'
    )
  })

  it('TC-NUMBER.10 returns defaults when no sidecar exists', () => {
    const result = loadNumberingSidecar('/nonexistent/path.markdoc-numbering.json')
    expect(result.config).toEqual(DEFAULT_NUMBERING_CONFIG)
    expect(result.overrides).toEqual({})
  })

  it('TC-NUMBER.10 returns defaults for corrupt JSON without throwing', () => {
    writeFileSync(sidecarPath, '{not-valid-json', 'utf-8')
    const result = loadNumberingSidecar(sidecarPath)
    expect(result.config.enabled).toBe(false)
    expect(result.config.preset).toBe('decimal')
    expect(result.overrides).toEqual({})
  })

  it('TC-NUMBER.10 persists and reloads config + overrides', () => {
    saveNumberingSidecar({
      sidecarPath,
      config: {
        enabled: true,
        preset: 'classic',
        displayMode: 'lastTwoSegments',
        showNumbersInMentions: false,
        version: 1,
      },
      overrides: {
        'abc-123': { preset: 'decimal', displayMode: 'lastSegment' },
      },
    })

    expect(existsSync(sidecarPath)).toBe(true)
    const raw = JSON.parse(readFileSync(sidecarPath, 'utf-8')) as Record<string, unknown>
    expect(raw.enabled).toBe(true)
    expect(raw.preset).toBe('classic')

    const loaded = loadNumberingSidecar(sidecarPath)
    expect(loaded.config.enabled).toBe(true)
    expect(loaded.config.preset).toBe('classic')
    expect(loaded.config.displayMode).toBe('lastTwoSegments')
    expect(loaded.config.showNumbersInMentions).toBe(false)
    expect(loaded.overrides['abc-123']).toEqual({
      preset: 'decimal',
      displayMode: 'lastSegment',
    })
  })

  it('TC-NUMBER.10 resets by deleting the sidecar file', () => {
    saveNumberingSidecar({
      sidecarPath,
      config: { enabled: true, preset: 'chapter', version: 1 },
    })
    expect(existsSync(sidecarPath)).toBe(true)

    resetNumberingSidecar(sidecarPath)
    expect(existsSync(sidecarPath)).toBe(false)

    // Resetting a missing file is a no-op
    expect(() => resetNumberingSidecar(sidecarPath)).not.toThrow()
  })

  it('TC-NUMBER.10 loads the checked-in numbering fixture', () => {
    const loaded = loadNumberingSidecar(fixturePath)
    expect(loaded.config.enabled).toBe(true)
    expect(loaded.config.preset).toBe('decimal')
    expect(loaded.config.showNumbersInMentions).toBe(true)
    expect(loaded.overrides['scope-heading']).toEqual({ preset: 'classic' })
  })
})
