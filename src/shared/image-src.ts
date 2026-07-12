/**
 * Browser-safe image src helpers (no Node path/fs imports).
 */

/**
 * Returns true when an image src points at a remote or inline resource
 * that should not be copied into the document asset folder.
 */
export function isRemoteImageSrc({ src }: { src: string }): boolean {
  const trimmed = src.trim()
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  )
}

/**
 * Validates that a string is a usable http(s) image URL.
 */
export function isValidImageUrl({ url }: { url: string }): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Guesses a file extension from a URL pathname.
 */
export function extensionFromUrl({ url }: { url: string }): string {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.slice(pathname.lastIndexOf('.')).toLowerCase()
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      return ext.slice(1)
    }
  } catch {
    // Fall through
  }
  return 'png'
}
