import { describe, it, expect } from 'vitest'
import { isRemoteImageSrc, isValidImageUrl, extensionFromUrl } from '@shared/image-src'
import {
  rewriteAssetFolderInMarkdown,
  resolveLocalImagePath,
  extractImageSrcsFromMarkdown,
} from '@shared/image-paths'

describe('image src', () => {
  it('detects remote image sources', () => {
    expect(isRemoteImageSrc({ src: 'https://example.com/a.png' })).toBe(true)
    expect(isRemoteImageSrc({ src: 'http://example.com/a.png' })).toBe(true)
    expect(isRemoteImageSrc({ src: 'data:image/png;base64,abc' })).toBe(true)
    expect(isRemoteImageSrc({ src: 'notes.assets/image-1.png' })).toBe(false)
  })

  it('validates http(s) image URLs', () => {
    expect(isValidImageUrl({ url: 'https://example.com/image.png' })).toBe(true)
    expect(isValidImageUrl({ url: 'ftp://example.com/image.png' })).toBe(false)
    expect(isValidImageUrl({ url: 'not-a-url' })).toBe(false)
  })

  it('guesses extensions from URLs', () => {
    expect(extensionFromUrl({ url: 'https://example.com/photo.jpg' })).toBe('jpg')
    expect(extensionFromUrl({ url: 'https://example.com/noext' })).toBe('png')
  })
})

describe('image paths', () => {
  it('rewrites asset folder names when a document is saved as', () => {
    const markdown = '![diagram](notes.assets/image-1.png)'
    const rewritten = rewriteAssetFolderInMarkdown({
      markdown,
      oldDocumentPath: '/tmp/notes.md',
      newDocumentPath: '/tmp/report.md',
    })
    expect(rewritten).toBe('![diagram](report.assets/image-1.png)')
  })

  it('resolves relative local image paths from the document directory', () => {
    expect(
      resolveLocalImagePath({
        documentPath: '/tmp/notes.md',
        src: 'notes.assets/image-1.png',
      })
    ).toBe('/tmp/notes.assets/image-1.png')
  })

  it('extracts image src values from markdown', () => {
    const markdown = 'Text\n![alt](notes.assets/a.png) and ![b](https://x.com/b.jpg)'
    expect(extractImageSrcsFromMarkdown({ markdown })).toEqual([
      'notes.assets/a.png',
      'https://x.com/b.jpg',
    ])
  })
})
