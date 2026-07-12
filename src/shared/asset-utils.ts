import { basename, join, dirname } from 'path'
import { getAssetFolderPath } from './file-utils'
import { isRemoteImageSrc } from './image-src'

/**
 * Generates a unique filename for a new image asset.
 */
export function generateImageFilename({
  mimeType,
  existingNames = [],
}: {
  mimeType: string
  existingNames?: string[]
}): string {
  const ext = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? 'jpg'
      : mimeType.includes('gif')
        ? 'gif'
        : mimeType.includes('webp')
          ? 'webp'
          : 'png'

  let index = 1
  let candidate = `image-${index}.${ext}`
  const taken = new Set(existingNames)
  while (taken.has(candidate)) {
    index += 1
    candidate = `image-${index}.${ext}`
  }
  return candidate
}

/**
 * Returns the relative path from a document to an asset file.
 */
export function relativeAssetPath({
  documentPath,
  filename,
}: {
  documentPath: string
  filename: string
}): string {
  const assetFolder = basename(getAssetFolderPath(documentPath))
  return `${assetFolder}/${filename}`
}

/**
 * Scans markdown for image references and returns broken relative paths.
 */
export function findBrokenImageRefs({
  markdown,
  documentPath,
  existsFn,
}: {
  markdown: string
  documentPath: string
  existsFn: (absolutePath: string) => boolean
}): Array<{ src: string; line: number }> {
  const broken: Array<{ src: string; line: number }> = []
  const docDir = dirname(documentPath)
  const lines = markdown.split('\n')
  const imagePattern = /!\[[^\]]*\]\(([^)]+)\)/g

  lines.forEach((line, lineIndex) => {
    let match: RegExpExecArray | null
    imagePattern.lastIndex = 0
    while ((match = imagePattern.exec(line)) !== null) {
      const src = match[1].trim()
      if (isRemoteImageSrc({ src })) {
        continue
      }
      const absolute = join(docDir, src)
      if (!existsFn(absolute)) {
        broken.push({ src, line: lineIndex + 1 })
      }
    }
  })

  return broken
}
