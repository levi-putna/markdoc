import { basename, dirname, isAbsolute, resolve } from 'path'
import { getAssetFolderPath } from './file-utils'
import { isRemoteImageSrc } from './image-src'

/**
 * Returns the asset folder directory name for a document (e.g. `notes.assets`).
 */
export function getAssetFolderName({ documentPath }: { documentPath: string }): string {
  return basename(getAssetFolderPath(documentPath))
}

/**
 * Rewrites image paths when a document is saved under a new name, so
 * `old.assets/image.png` becomes `new.assets/image.png` in the Markdown.
 */
export function rewriteAssetFolderInMarkdown({
  markdown,
  oldDocumentPath,
  newDocumentPath,
}: {
  markdown: string
  oldDocumentPath: string
  newDocumentPath: string
}): string {
  const oldFolder = getAssetFolderName({ documentPath: oldDocumentPath })
  const newFolder = getAssetFolderName({ documentPath: newDocumentPath })
  if (oldFolder === newFolder) return markdown

  const escaped = oldFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(!\\[[^\\]]*\\]\\()${escaped}/`, 'g')
  return markdown.replace(pattern, `$1${newFolder}/`)
}

/**
 * Resolves a markdown image src to an absolute filesystem path for local assets.
 */
export function resolveLocalImagePath({
  documentPath,
  src,
}: {
  documentPath: string | null
  src: string
}): string | null {
  if (!documentPath || isRemoteImageSrc({ src })) return null

  const trimmed = src.trim()
  if (trimmed.startsWith('file://')) {
    return trimmed.slice('file://'.length)
  }
  if (isAbsolute(trimmed)) {
    return trimmed
  }
  return resolve(dirname(documentPath), trimmed)
}

/**
 * Extracts image references from markdown for path rewriting.
 */
export function extractImageSrcsFromMarkdown({ markdown }: { markdown: string }): string[] {
  const srcs: string[] = []
  const imagePattern = /!\[[^\]]*\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = imagePattern.exec(markdown)) !== null) {
    srcs.push(match[1].trim())
  }
  return srcs
}
