import type { OutlineNode } from './types'

/** Supported document-level numbering presets. */
export type NumberingPreset = 'decimal' | 'classic' | 'legalMilitary' | 'chapter'

/** Formats for a single level segment. */
export type NumberFormat =
  | 'decimal'
  | 'upperRoman'
  | 'lowerRoman'
  | 'upperAlpha'
  | 'lowerAlpha'
  | 'parenAlpha'
  | 'parenRoman'
  | 'chapter'

/** How much of the full number path is shown on headings. */
export type DisplayMode = 'full' | 'lastSegment' | 'lastTwoSegments'

/** Document-level numbering configuration persisted in the sidecar. */
export interface NumberingConfig {
  enabled: boolean
  preset: NumberingPreset
  displayMode?: DisplayMode
  /** Legal/military style trailing zeros (e.g. 1.0, 1.1.0). */
  trailingZero?: boolean
  /** When numbering is on, prefix @heading mentions with the computed label. */
  showNumbersInMentions?: boolean
  version: number
}

/** Per-heading override that applies to that heading's descendants. */
export interface HeadingNumberingOverride {
  preset?: NumberingPreset
  /** Custom formats relative to the override root's children depth. */
  levelFormats?: NumberFormat[]
  displayMode?: DisplayMode
  separator?: string
}

/** Full sidecar payload for heading numbering. */
export interface NumberingSidecar {
  version: number
  enabled: boolean
  preset: NumberingPreset
  displayMode?: DisplayMode
  trailingZero?: boolean
  showNumbersInMentions?: boolean
  overrides?: Record<string, HeadingNumberingOverride>
}

/** Computed number for a single heading. */
export interface HeadingNumberResult {
  fullPath: number[]
  displayLabel: string
  /** Bare title without the number prefix (when known). */
  bareTitle?: string
}

export const DEFAULT_NUMBERING_CONFIG: NumberingConfig = {
  enabled: false,
  preset: 'decimal',
  displayMode: 'full',
  trailingZero: false,
  version: 1,
}

/** Format sequences for each built-in preset (L1 → L6). */
export const PRESET_FORMATS: Record<NumberingPreset, NumberFormat[]> = {
  decimal: ['decimal', 'decimal', 'decimal', 'decimal', 'decimal', 'decimal'],
  classic: ['upperRoman', 'upperAlpha', 'decimal', 'lowerAlpha', 'lowerRoman', 'lowerAlpha'],
  legalMilitary: ['decimal', 'decimal', 'decimal', 'decimal', 'decimal', 'decimal'],
  chapter: ['chapter', 'decimal', 'decimal', 'decimal', 'decimal', 'decimal'],
}

/** Alpha/Roman hybrid formats used as a subtree override option. */
export const ALPHA_ROMAN_HYBRID_FORMATS: NumberFormat[] = [
  'parenAlpha',
  'parenRoman',
  'parenAlpha',
  'parenRoman',
  'parenAlpha',
  'parenRoman',
]

const ROMAN_MAP: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/**
 * Converts a positive integer to Roman numerals.
 */
export function toRoman({ value, lower = false }: { value: number; lower?: boolean }): string {
  if (value <= 0) return String(value)
  let remaining = value
  let result = ''
  for (const [num, glyph] of ROMAN_MAP) {
    while (remaining >= num) {
      result += glyph
      remaining -= num
    }
  }
  return lower ? result.toLowerCase() : result
}

/**
 * Converts a 1-based index to alphabetic (A, B, … Z, AA, …).
 */
export function toAlpha({ value, lower = false }: { value: number; lower?: boolean }): string {
  if (value <= 0) return String(value)
  let n = value
  let result = ''
  while (n > 0) {
    n -= 1
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return lower ? result.toLowerCase() : result
}

/**
 * Formats a single path segment with the given format style.
 */
export function formatSegment({
  value,
  format,
}: {
  value: number
  format: NumberFormat
}): string {
  switch (format) {
    case 'decimal':
      return String(value)
    case 'upperRoman':
      return toRoman({ value })
    case 'lowerRoman':
      return toRoman({ value, lower: true })
    case 'upperAlpha':
      return toAlpha({ value })
    case 'lowerAlpha':
      return toAlpha({ value, lower: true })
    case 'parenAlpha':
      return `(${toAlpha({ value, lower: true })})`
    case 'parenRoman':
      return `(${toRoman({ value, lower: true })})`
    case 'chapter':
      return `Chapter ${value}`
    default:
      return String(value)
  }
}

/**
 * Builds the display label from a full counter path and format list.
 */
export function formatNumberPath({
  path,
  formats,
  displayMode = 'full',
  trailingZero = false,
  separator = '.',
  standaloneFormats,
}: {
  path: number[]
  formats: NumberFormat[]
  displayMode?: DisplayMode
  trailingZero?: boolean
  separator?: string
  /** Formats that render alone (never joined with ancestors). */
  standaloneFormats?: Set<NumberFormat>
}): string {
  if (path.length === 0) return ''

  const standingAlone = standaloneFormats ?? new Set<NumberFormat>(['chapter', 'parenAlpha', 'parenRoman'])
  const lastFormat = formats[Math.min(path.length - 1, formats.length - 1)] ?? 'decimal'

  // Parenthetical / chapter styles show only their own segment
  if (standingAlone.has(lastFormat) && displayMode === 'full') {
    return formatSegment({ value: path[path.length - 1], format: lastFormat })
  }

  let startIndex = 0
  if (displayMode === 'lastSegment') {
    startIndex = path.length - 1
  } else if (displayMode === 'lastTwoSegments') {
    startIndex = Math.max(0, path.length - 2)
  }

  const slice = path.slice(startIndex)
  const formatSlice = formats.slice(startIndex, startIndex + slice.length)

  // Classic/mixed formats with non-decimal mixes: join each formatted segment
  const allDecimal = formatSlice.every((f) => f === 'decimal' || f === 'chapter')
  if (!allDecimal && displayMode === 'full' && startIndex === 0) {
    // For classic outline, each level uses its own format independently when
    // joined — but traditionally classic shows only the current level's glyph.
    // Prefer single-segment display for non-decimal presets at full mode.
    if (formatSlice.some((f) => f !== 'decimal' && f !== 'chapter')) {
      return formatSegment({ value: path[path.length - 1], format: lastFormat })
    }
  }

  // Chapter L1: "Chapter N"; deeper levels use decimal path (1.1, 1.2)
  if (formats[0] === 'chapter' && displayMode === 'full' && startIndex === 0) {
    if (path.length === 1) {
      return formatSegment({ value: path[0], format: 'chapter' })
    }
    return path.map(String).join(separator)
  }

  const segments = slice.map((value, i) => {
    const format = formatSlice[i] ?? 'decimal'
    if (format === 'chapter') {
      return String(value)
    }
    return formatSegment({ value, format })
  })

  // Legal/military: pad top-level as N.0 when depth is 1 and trailingZero is on
  if (trailingZero && displayMode === 'full' && path.length === 1 && startIndex === 0) {
    return `${segments[0]}${separator}0`
  }

  let label = segments.join(separator)

  // Skip-level display prefixes a leading separator for last-segment modes
  if (displayMode === 'lastSegment' && path.length > 1) {
    label = `${separator}${label}`
  } else if (displayMode === 'lastTwoSegments' && path.length > 2) {
    label = `${separator}${label}`
  }

  return label
}

interface EffectiveStyle {
  formats: NumberFormat[]
  displayMode: DisplayMode
  trailingZero: boolean
  separator: string
  /** Depth offset: formats[0] applies at this outline depth within the override scope. */
  formatDepthBase: number
}

/**
 * Resolves the effective numbering style for a heading given ancestor overrides.
 */
function resolveEffectiveStyle({
  config,
  overrideStack,
}: {
  config: NumberingConfig
  overrideStack: Array<{ override: HeadingNumberingOverride; appliedAtDepth: number }>
  depth: number
}): EffectiveStyle {
  const nearest = overrideStack.length > 0 ? overrideStack[overrideStack.length - 1] : null

  if (nearest) {
    const { override, appliedAtDepth } = nearest
    const formats =
      override.levelFormats ??
      (override.preset ? PRESET_FORMATS[override.preset] : PRESET_FORMATS[config.preset])
    return {
      formats,
      displayMode: override.displayMode ?? config.displayMode ?? 'full',
      trailingZero: override.preset === 'legalMilitary' || config.trailingZero === true,
      separator: override.separator ?? '.',
      // Formats apply to children of the override root, not the root itself
      formatDepthBase: appliedAtDepth + 1,
    }
  }

  const preset = config.preset
  return {
    formats: PRESET_FORMATS[preset],
    displayMode: config.displayMode ?? 'full',
    trailingZero: preset === 'legalMilitary' || config.trailingZero === true,
    separator: '.',
    formatDepthBase: 0,
  }
}

/**
 * Computes display numbers for every heading in the outline tree.
 *
 * Overrides keyed by headingId apply to that heading's **children** (subtree),
 * not to the heading itself.
 */
export function computeHeadingNumbers({
  outline,
  config,
  overridesByHeadingId = {},
}: {
  outline: OutlineNode[]
  config: NumberingConfig
  overridesByHeadingId?: Record<string, HeadingNumberingOverride>
}): Map<string, HeadingNumberResult> {
  const results = new Map<string, HeadingNumberResult>()
  if (!config.enabled) return results

  /**
   * Walks the tree, maintaining a counter stack aligned with outline depth.
   * Counters at each depth are sibling indices (1-based).
   */
  function walk({
    nodes,
    counters,
    overrideStack,
    depth,
  }: {
    nodes: OutlineNode[]
    counters: number[]
    overrideStack: Array<{ override: HeadingNumberingOverride; appliedAtDepth: number }>
    depth: number
  }): void {
    // Ensure counter slot for this depth
    while (counters.length <= depth) counters.push(0)
    // Reset deeper counters when entering a new sibling group
    counters.length = depth + 1

    for (const node of nodes) {
      counters[depth] = (counters[depth] ?? 0) + 1
      // Zero out levels below this one for subsequent siblings
      for (let i = depth + 1; i < counters.length; i++) {
        counters[i] = 0
      }
      counters.length = depth + 1

      const style = resolveEffectiveStyle({ config, overrideStack, depth })

      // Path relative to format depth base (document root or override children root)
      const pathStart = style.formatDepthBase
      const fullPath = counters.slice(0, depth + 1).filter((_, i) => i >= pathStart)
      // Map format index: depth - formatDepthBase
      const formatIndex = depth - style.formatDepthBase
      const formatsForPath = style.formats.slice(
        Math.max(0, formatIndex - fullPath.length + 1),
        formatIndex + 1
      )

      // Align formats with fullPath length
      let alignedFormats = formatsForPath
      if (alignedFormats.length < fullPath.length) {
        // Pad from the start of the preset formats
        const needed = fullPath.length
        alignedFormats = style.formats.slice(0, needed)
        if (alignedFormats.length < needed) {
          while (alignedFormats.length < needed) {
            alignedFormats.push('decimal')
          }
        }
      } else if (alignedFormats.length > fullPath.length) {
        alignedFormats = alignedFormats.slice(-fullPath.length)
      }

      // Prefer formats indexed by relative depth within the style scope
      alignedFormats = fullPath.map((_, i) => {
        const idx = style.formatDepthBase === 0 ? i : i
        return style.formats[idx] ?? 'decimal'
      })

      const displayLabel = formatNumberPath({
        path: fullPath,
        formats: alignedFormats,
        displayMode: style.displayMode,
        trailingZero: style.trailingZero && style.formatDepthBase === 0,
        separator: style.separator,
      })

      results.set(node.id, { fullPath: [...fullPath], displayLabel })

      const override = overridesByHeadingId[node.id]
      const nextOverrideStack = override
        ? [...overrideStack, { override, appliedAtDepth: depth }]
        : overrideStack

      if (node.children.length > 0) {
        const childCounters = [...counters]
        walk({
          nodes: node.children,
          counters: childCounters,
          overrideStack: nextOverrideStack,
          depth: depth + 1,
        })
        // Copy sibling counters back so next sibling at this level continues
        counters[depth] = childCounters[depth]
      }
    }
  }

  walk({ nodes: outline, counters: [], overrideStack: [], depth: 0 })
  return results
}

/**
 * Returns a short example sequence for UI preview of a preset.
 */
export function getPresetPreviewLabels({
  preset,
  displayMode = 'full',
}: {
  preset: NumberingPreset
  displayMode?: DisplayMode
}): string[] {
  const mockOutline: OutlineNode[] = [
    {
      id: 'a',
      text: 'A',
      level: 1,
      pos: 0,
      sectionEnd: 10,
      children: [
        {
          id: 'a1',
          text: 'A1',
          level: 2,
          pos: 1,
          sectionEnd: 5,
          children: [
            { id: 'a1a', text: 'A1a', level: 3, pos: 2, sectionEnd: 3, children: [] },
            { id: 'a1b', text: 'A1b', level: 3, pos: 3, sectionEnd: 4, children: [] },
          ],
        },
        { id: 'a2', text: 'A2', level: 2, pos: 5, sectionEnd: 6, children: [] },
      ],
    },
    {
      id: 'b',
      text: 'B',
      level: 1,
      pos: 10,
      sectionEnd: 20,
      children: [{ id: 'b1', text: 'B1', level: 2, pos: 11, sectionEnd: 12, children: [] }],
    },
  ]

  const config: NumberingConfig = {
    enabled: true,
    preset,
    displayMode,
    trailingZero: preset === 'legalMilitary',
    version: 1,
  }
  const map = computeHeadingNumbers({ outline: mockOutline, config })
  return ['a', 'a1', 'a1a', 'a1b', 'a2', 'b', 'b1']
    .map((id) => map.get(id)?.displayLabel)
    .filter((label): label is string => Boolean(label))
}

/**
 * Strips a known numbering prefix from heading text, returning the bare title.
 *
 * When `loose` is true, also strips classic outline tokens that have no trailing
 * period (e.g. "I Title", "A Title") — used when cleaning residuals after a
 * preset change. Keep `loose` false for first-time title capture so headings
 * like "A complete guide" are not mangled.
 */
export function stripNumberingPrefix({
  text,
  displayLabel,
  loose = false,
  peelSingleLetters = true,
}: {
  text: string
  displayLabel?: string
  loose?: boolean
  /**
   * When loose, also peel single-letter classic tokens ("A Title").
   * Set false when cleaning stored bare titles so "A complete guide" stays
   * intact — only Roman/decimal/paren residuals are removed then.
   */
  peelSingleLetters?: boolean
}): string {
  let trimmed = text.trim()
  if (!trimmed) return trimmed

  if (displayLabel) {
    const escaped = displayLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const withLabel = new RegExp(`^${escaped}\\s+`)
    if (withLabel.test(trimmed)) {
      trimmed = trimmed.replace(withLabel, '').trim()
    }
  }

  // Keep stripping while a numbering token remains (stacked residuals from
  // preset switches, e.g. "1 I Introduction" or "I A Title").
  let guard = 0
  while (guard < 6) {
    guard += 1
    const before = trimmed
    const patterns: RegExp[] = [
      /^Chapter\s+\d+\s+/i,
      /^\(\s*[a-zivxlcdm]+\s*\)\s+/i,
      /^[IVXLCDM]+\.\s+/,
      /^[A-Z]\.\s+/,
      /^[a-z]\.\s+/,
      /^[ivxlcdm]+\.\s+/,
      /^\.?\d+(?:\.\d+)*\.0?\s+/,
      /^\.?\d+(?:\.\d+)*\.?\s+/,
    ]
    if (loose) {
      // Roman without trailing period — common classic residual
      patterns.push(/^[IVXLCDM]{1,12}\s+/i)
      if (peelSingleLetters) {
        patterns.push(/^[A-Z]\s+/, /^[a-z]\s+/, /^[ivxlcdm]{1,12}\s+/)
      } else {
        // Safer stored-title cleanup: peel "A Scope" (letter before a capital
        // word) but NOT "A complete guide" (letter before lowercase prose).
        patterns.push(/^[A-Z]\s+(?=[A-Z])/, /^[a-z]\s+(?=[A-Z])/)
      }
    }
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        trimmed = trimmed.replace(pattern, '').trim()
        break
      }
    }
    if (trimmed === before) break
  }

  return trimmed
}

/**
 * Builds the numbered heading text from a display label and bare title.
 */
export function buildNumberedHeadingText({
  displayLabel,
  bareTitle,
}: {
  displayLabel: string
  bareTitle: string
}): string {
  const title = bareTitle.trim() || 'Untitled'
  if (!displayLabel) return title
  return `${displayLabel} ${title}`
}

/**
 * Normalises a sidecar payload into a NumberingConfig + overrides map.
 */
export function parseNumberingSidecar({
  raw,
}: {
  raw: unknown
}): { config: NumberingConfig; overrides: Record<string, HeadingNumberingOverride> } {
  if (!raw || typeof raw !== 'object') {
    return { config: { ...DEFAULT_NUMBERING_CONFIG }, overrides: {} }
  }
  const data = raw as Partial<NumberingSidecar>
  const preset = (['decimal', 'classic', 'legalMilitary', 'chapter'] as NumberingPreset[]).includes(
    data.preset as NumberingPreset
  )
    ? (data.preset as NumberingPreset)
    : 'decimal'

  const enabled = Boolean(data.enabled)

  return {
    config: {
      enabled,
      preset,
      displayMode: data.displayMode ?? 'full',
      trailingZero: data.trailingZero ?? preset === 'legalMilitary',
      showNumbersInMentions: enabled
        ? (data.showNumbersInMentions ?? true)
        : (data.showNumbersInMentions ?? false),
      version: typeof data.version === 'number' ? data.version : 1,
    },
    overrides: data.overrides && typeof data.overrides === 'object' ? { ...data.overrides } : {},
  }
}

/**
 * Serialises config + overrides into a sidecar payload.
 */
export function serializeNumberingSidecar({
  config,
  overrides = {},
}: {
  config: NumberingConfig
  overrides?: Record<string, HeadingNumberingOverride>
}): NumberingSidecar {
  const payload: NumberingSidecar = {
    version: config.version ?? 1,
    enabled: config.enabled,
    preset: config.preset,
    displayMode: config.displayMode ?? 'full',
  }
  if (config.trailingZero !== undefined) {
    payload.trailingZero = config.trailingZero
  }
  if (config.showNumbersInMentions !== undefined) {
    payload.showNumbersInMentions = config.showNumbersInMentions
  }
  if (Object.keys(overrides).length > 0) {
    payload.overrides = overrides
  }
  return payload
}
