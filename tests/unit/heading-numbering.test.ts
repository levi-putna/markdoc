import { describe, it, expect } from 'vitest'
import type { OutlineNode } from '@shared/types'
import {
  buildNumberedHeadingText,
  computeHeadingNumbers,
  formatSegment,
  getPresetPreviewLabels,
  parseNumberingSidecar,
  serializeNumberingSidecar,
  stripNumberingPrefix,
  toAlpha,
  toRoman,
  type NumberingConfig,
  ALPHA_ROMAN_HYBRID_FORMATS,
} from '@shared/heading-numbering'

function heading({
  id,
  text,
  level,
  children = [],
}: {
  id: string
  text: string
  level: number
  children?: OutlineNode[]
}): OutlineNode {
  return { id, text, level, pos: 0, sectionEnd: 1, children }
}

const sampleOutline: OutlineNode[] = [
  heading({
    id: 'top',
    text: 'Top',
    level: 1,
    children: [
      heading({
        id: 'child-a',
        text: 'Child A',
        level: 2,
        children: [
          heading({ id: 'gc-1', text: 'Grandchild 1', level: 3 }),
          heading({ id: 'gc-2', text: 'Grandchild 2', level: 3 }),
        ],
      }),
      heading({ id: 'child-b', text: 'Child B', level: 2 }),
    ],
  }),
  heading({
    id: 'second',
    text: 'Second',
    level: 1,
    children: [heading({ id: 'second-a', text: 'Second A', level: 2 })],
  }),
]

function labels(config: NumberingConfig, overrides = {}) {
  const map = computeHeadingNumbers({
    outline: sampleOutline,
    config,
    overridesByHeadingId: overrides,
  })
  return {
    top: map.get('top')?.displayLabel,
    childA: map.get('child-a')?.displayLabel,
    gc1: map.get('gc-1')?.displayLabel,
    gc2: map.get('gc-2')?.displayLabel,
    childB: map.get('child-b')?.displayLabel,
    second: map.get('second')?.displayLabel,
    secondA: map.get('second-a')?.displayLabel,
  }
}

describe('heading numbering helpers', () => {
  it('converts to Roman numerals', () => {
    expect(toRoman({ value: 1 })).toBe('I')
    expect(toRoman({ value: 4 })).toBe('IV')
    expect(toRoman({ value: 14, lower: true })).toBe('xiv')
  })

  it('converts to alphabetic', () => {
    expect(toAlpha({ value: 1 })).toBe('A')
    expect(toAlpha({ value: 26 })).toBe('Z')
    expect(toAlpha({ value: 27, lower: true })).toBe('aa')
  })

  it('formats segments', () => {
    expect(formatSegment({ value: 2, format: 'chapter' })).toBe('Chapter 2')
    expect(formatSegment({ value: 1, format: 'parenAlpha' })).toBe('(a)')
    expect(formatSegment({ value: 2, format: 'parenRoman' })).toBe('(ii)')
  })
})

describe('computeHeadingNumbers — presets (TC-NUMBER.1/2/3)', () => {
  const config: NumberingConfig = {
    enabled: true,
    preset: 'decimal',
    displayMode: 'full',
    version: 1,
  }

  it('TC-NUMBER.1 produces 1, 1.1, 1.1.1, 1.1.2, 1.2, 2, 2.1 for decimal', () => {
    expect(labels(config)).toEqual({
      top: '1',
      childA: '1.1',
      gc1: '1.1.1',
      gc2: '1.1.2',
      childB: '1.2',
      second: '2',
      secondA: '2.1',
    })
  })

  it('TC-NUMBER.3 returns empty map when disabled', () => {
    const map = computeHeadingNumbers({
      outline: sampleOutline,
      config: { ...config, enabled: false },
    })
    expect(map.size).toBe(0)
  })

  it('TC-NUMBER.2 supports lastSegment display mode', () => {
    const result = labels({ ...config, displayMode: 'lastSegment' })
    expect(result.top).toBe('1')
    expect(result.childA).toBe('.1')
    expect(result.gc1).toBe('.1')
    expect(result.gc2).toBe('.2')
  })

  it('TC-NUMBER.2 supports lastTwoSegments display mode', () => {
    const result = labels({ ...config, displayMode: 'lastTwoSegments' })
    expect(result.top).toBe('1')
    expect(result.childA).toBe('1.1')
    expect(result.gc1).toBe('.1.1')
    expect(result.gc2).toBe('.1.2')
  })

  it('TC-NUMBER.1 uses I, A, 1 pattern for classic', () => {
    const result = labels({
      enabled: true,
      preset: 'classic',
      displayMode: 'full',
      version: 1,
    })
    expect(result.top).toBe('I')
    expect(result.childA).toBe('A')
    expect(result.gc1).toBe('1')
    expect(result.gc2).toBe('2')
    expect(result.childB).toBe('B')
    expect(result.second).toBe('II')
    expect(result.secondA).toBe('A')
  })

  it('TC-NUMBER.1 adds trailing zeros for legal/military', () => {
    const result = labels({
      enabled: true,
      preset: 'legalMilitary',
      displayMode: 'full',
      version: 1,
    })
    expect(result.top).toBe('1.0')
    expect(result.childA).toBe('1.1')
    expect(result.gc1).toBe('1.1.1')
    expect(result.second).toBe('2.0')
    expect(result.secondA).toBe('2.1')
  })

  it('TC-NUMBER.1 uses Chapter N then decimal children', () => {
    const result = labels({
      enabled: true,
      preset: 'chapter',
      displayMode: 'full',
      version: 1,
    })
    expect(result.top).toBe('Chapter 1')
    expect(result.childA).toBe('1.1')
    expect(result.gc1).toBe('1.1.1')
    expect(result.second).toBe('Chapter 2')
    expect(result.secondA).toBe('2.1')
  })

  it('TC-NUMBER.2 does not crash for classic/chapter lastSegment modes', () => {
    expect(() =>
      labels({ enabled: true, preset: 'classic', displayMode: 'lastSegment', version: 1 })
    ).not.toThrow()
    expect(() =>
      labels({ enabled: true, preset: 'chapter', displayMode: 'lastTwoSegments', version: 1 })
    ).not.toThrow()
  })
})

describe('computeHeadingNumbers — overrides (TC-NUMBER.4/5)', () => {
  const config: NumberingConfig = {
    enabled: true,
    preset: 'decimal',
    displayMode: 'full',
    version: 1,
  }

  it('TC-NUMBER.4 applies alpha/Roman hybrid to children of the override heading', () => {
    const result = labels(config, {
      'child-a': { levelFormats: ALPHA_ROMAN_HYBRID_FORMATS },
    })
    // Override root keeps document numbering; children switch style
    expect(result.childA).toBe('1.1')
    expect(result.gc1).toBe('(a)')
    expect(result.gc2).toBe('(b)')
  })

  it('TC-NUMBER.4 clears cascade when using a nested preset override', () => {
    const result = labels(config, {
      top: { preset: 'classic' },
    })
    expect(result.top).toBe('1')
    expect(result.childA).toBe('I')
    expect(result.gc1).toBe('A')
    expect(result.childB).toBe('II')
  })

  it('TC-NUMBER.5 resolves stacked overrides from the nearest ancestor', () => {
    const result = labels(config, {
      top: { preset: 'classic' },
      'child-a': { levelFormats: ALPHA_ROMAN_HYBRID_FORMATS },
    })
    expect(result.top).toBe('1')
    expect(result.childA).toBe('I')
    // Grandchildren under child-a use the nearer hybrid override
    expect(result.gc1).toBe('(a)')
    expect(result.gc2).toBe('(b)')
    // Sibling of child-a still under classic override from top
    expect(result.childB).toBe('II')
  })

  it('TC-NUMBER.4 honours per-override displayMode for descendants', () => {
    const result = labels(config, {
      top: { displayMode: 'lastSegment' },
    })
    // Override root keeps document style; descendants use a relative path
    // under the override scope (so depth-1 children are a single segment).
    expect(result.top).toBe('1')
    expect(result.childA).toBe('1')
    expect(result.gc1).toBe('.1')
    expect(result.gc2).toBe('.2')
  })
})

describe('computeHeadingNumbers — structure edge cases (TC-NUMBER.6)', () => {
  const config: NumberingConfig = {
    enabled: true,
    preset: 'decimal',
    displayMode: 'full',
    version: 1,
  }

  it('returns an empty map for an empty outline', () => {
    const map = computeHeadingNumbers({ outline: [], config })
    expect(map.size).toBe(0)
  })

  it('numbers a single top-level heading', () => {
    const map = computeHeadingNumbers({
      outline: [heading({ id: 'only', text: 'Only', level: 1 })],
      config,
    })
    expect(map.get('only')?.displayLabel).toBe('1')
  })

  it('numbers skip-level outlines by tree depth', () => {
    // H1 → H3 child is depth 1 under the outline tree
    const outline = [
      heading({
        id: 'root',
        text: 'Root',
        level: 1,
        children: [heading({ id: 'skip', text: 'Skip', level: 3 })],
      }),
    ]
    const map = computeHeadingNumbers({ outline, config })
    expect(map.get('root')?.displayLabel).toBe('1')
    expect(map.get('skip')?.displayLabel).toBe('1.1')
  })

  it('numbers deep H4–H6 branches', () => {
    const outline = [
      heading({
        id: 'l1',
        text: 'L1',
        level: 1,
        children: [
          heading({
            id: 'l2',
            text: 'L2',
            level: 2,
            children: [
              heading({
                id: 'l3',
                text: 'L3',
                level: 3,
                children: [
                  heading({
                    id: 'l4',
                    text: 'L4',
                    level: 4,
                    children: [
                      heading({
                        id: 'l5',
                        text: 'L5',
                        level: 5,
                        children: [heading({ id: 'l6', text: 'L6', level: 6 })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]
    const map = computeHeadingNumbers({ outline, config })
    expect(map.get('l4')?.displayLabel).toBe('1.1.1.1')
    expect(map.get('l5')?.displayLabel).toBe('1.1.1.1.1')
    expect(map.get('l6')?.displayLabel).toBe('1.1.1.1.1.1')
  })
})

describe('stripNumberingPrefix (TC-NUMBER.7)', () => {
  it('strips a known display label', () => {
    expect(stripNumberingPrefix({ text: '1.2 Introduction', displayLabel: '1.2' })).toBe(
      'Introduction'
    )
  })

  it('strips Chapter and parenthetical prefixes', () => {
    expect(stripNumberingPrefix({ text: 'Chapter 3 Methods' })).toBe('Methods')
    expect(stripNumberingPrefix({ text: '(a) Definitions' })).toBe('Definitions')
  })

  it('strips classic tokens without periods when loose', () => {
    expect(stripNumberingPrefix({ text: 'I Introduction', loose: true })).toBe('Introduction')
    expect(stripNumberingPrefix({ text: 'A Scope', loose: true })).toBe('Scope')
    expect(stripNumberingPrefix({ text: '1 I Introduction', displayLabel: '1', loose: true })).toBe(
      'Introduction'
    )
  })

  it('does not strip leading capitals without loose mode', () => {
    expect(stripNumberingPrefix({ text: 'A complete guide' })).toBe('A complete guide')
    expect(stripNumberingPrefix({ text: 'I Love Cats' })).toBe('I Love Cats')
  })
})

describe('buildNumberedHeadingText', () => {
  it('joins label and bare title', () => {
    expect(buildNumberedHeadingText({ displayLabel: '1.2', bareTitle: 'Scope' })).toBe('1.2 Scope')
  })

  it('falls back to Untitled when the title is empty', () => {
    expect(buildNumberedHeadingText({ displayLabel: '1', bareTitle: '  ' })).toBe('1 Untitled')
  })
})

describe('sidecar parse/serialize (TC-NUMBER.8)', () => {
  it('round-trips config and overrides', () => {
    const config: NumberingConfig = {
      enabled: true,
      preset: 'classic',
      displayMode: 'lastSegment',
      trailingZero: true,
      version: 1,
    }
    const overrides = { abc: { preset: 'decimal' as const } }
    const raw = serializeNumberingSidecar({ config, overrides })
    const parsed = parseNumberingSidecar({ raw })
    expect(parsed.config.enabled).toBe(true)
    expect(parsed.config.preset).toBe('classic')
    expect(parsed.config.displayMode).toBe('lastSegment')
    expect(parsed.config.trailingZero).toBe(true)
    expect(parsed.overrides.abc).toEqual({ preset: 'decimal' })
  })

  it('returns defaults for invalid payload', () => {
    const parsed = parseNumberingSidecar({ raw: null })
    expect(parsed.config.enabled).toBe(false)
    expect(parsed.config.preset).toBe('decimal')
  })

  it('falls back to decimal for unknown presets', () => {
    const parsed = parseNumberingSidecar({
      raw: { enabled: true, preset: 'not-a-preset', version: 1 },
    })
    expect(parsed.config.preset).toBe('decimal')
    expect(parsed.config.enabled).toBe(true)
  })

  it('defaults showNumbersInMentions to true when numbering is enabled', () => {
    const parsed = parseNumberingSidecar({
      raw: { enabled: true, preset: 'decimal', version: 1 },
    })
    expect(parsed.config.showNumbersInMentions).toBe(true)
  })

  it('round-trips showNumbersInMentions', () => {
    const raw = serializeNumberingSidecar({
      config: {
        enabled: true,
        preset: 'decimal',
        showNumbersInMentions: false,
        version: 1,
      },
    })
    expect(parseNumberingSidecar({ raw }).config.showNumbersInMentions).toBe(false)
  })
})

describe('getPresetPreviewLabels (TC-NUMBER.17)', () => {
  it('returns a non-empty preview for each preset', () => {
    for (const preset of ['decimal', 'classic', 'legalMilitary', 'chapter'] as const) {
      const preview = getPresetPreviewLabels({ preset })
      expect(preview.length).toBeGreaterThan(0)
    }
  })

  it('supports lastSegment display mode without throwing', () => {
    const preview = getPresetPreviewLabels({ preset: 'classic', displayMode: 'lastSegment' })
    expect(preview.length).toBeGreaterThan(0)
  })
})
