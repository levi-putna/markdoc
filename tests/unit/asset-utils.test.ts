import { describe, it, expect } from 'vitest'
import { findBrokenImageRefs, relativeAssetPath } from '@shared/asset-utils'

describe('asset utils', () => {
  it('builds relative asset paths', () => {
    expect(
      relativeAssetPath({
        documentPath: '/tmp/notes.md',
        filename: 'image-1.png',
      })
    ).toBe('notes.assets/image-1.png')
  })

  it('detects broken relative image references', () => {
    const broken = findBrokenImageRefs({
      markdown: '![alt](missing.assets/nope.png)',
      documentPath: '/tmp/doc.md',
      existsFn: () => false,
    })
    expect(broken).toHaveLength(1)
    expect(broken[0].src).toBe('missing.assets/nope.png')
  })
})
