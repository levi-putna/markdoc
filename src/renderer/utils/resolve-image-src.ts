import { isRemoteImageSrc } from '@shared/image-src'

/**
 * Resolves a markdown/Tiptap image `src` to a URL the Chromium renderer can load.
 * Local assets become `file://` URLs; remote URLs pass through unchanged.
 */
export async function resolveImageDisplaySrc({
  documentPath,
  src,
}: {
  documentPath: string | null
  src: string
}): Promise<string> {
  if (!src) return src
  if (isRemoteImageSrc({ src })) return src.trim()

  if (!window.markdoc || !documentPath) return src

  const resolved = await window.markdoc.resolveImageSrc({ documentPath, src })
  return resolved ?? src
}

/**
 * Rewrites image `src` attributes in an HTML string for preview rendering.
 */
export async function resolveImagesInHtml({
  html,
  documentPath,
}: {
  html: string
  documentPath: string | null
}): Promise<string> {
  if (!documentPath || typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images = Array.from(doc.querySelectorAll('img'))

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src) return
      const resolved = await resolveImageDisplaySrc({ documentPath, src })
      img.setAttribute('src', resolved)
    })
  )

  return doc.body.innerHTML
}
