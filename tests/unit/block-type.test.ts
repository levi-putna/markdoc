import { describe, it, expect } from 'vitest'
import { getActiveBlockType, getBlockTypeLabel } from '@renderer/utils/block-type'

describe('block-type utils', () => {
  it('returns label for paragraph', () => {
    expect(getBlockTypeLabel({ blockType: 'paragraph' })).toBe('Paragraph')
    expect(getBlockTypeLabel({ blockType: 'heading-2' })).toBe('Heading 2')
  })

  it('exports getActiveBlockType as a function', () => {
    expect(typeof getActiveBlockType).toBe('function')
  })
})
