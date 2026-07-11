import matter from 'gray-matter'

/**
 * Parses a Markdown string into front matter and body.
 */
export function parseMarkdownFile(content: string): {
  frontMatter: Record<string, unknown>
  body: string
} {
  const parsed = matter(content)
  return {
    frontMatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  }
}

/**
 * Serialises front matter and body back into a Markdown file string.
 */
export function serializeMarkdownFile({
  frontMatter = {},
  body,
}: {
  frontMatter?: Record<string, unknown>
  body: string
}): string {
  if (!frontMatter || Object.keys(frontMatter).length === 0) {
    return body
  }
  return matter.stringify(body, frontMatter)
}

/**
 * Performs an atomic file write by writing to a temp file first.
 */
export async function atomicWrite(
  writeFn: (path: string) => Promise<void>,
  targetPath: string
): Promise<void> {
  const tempPath = `${targetPath}.tmp`
  await writeFn(tempPath)
  const { rename } = await import('fs/promises')
  await rename(tempPath, targetPath)
}

/**
 * Returns the asset folder path for a given document path.
 */
export function getAssetFolderPath(documentPath: string): string {
  const base = documentPath.replace(/\.(md|markdown|mdown|mkd)$/i, '')
  return `${base}.assets`
}

/**
 * Returns the style sidecar path for a given document path.
 */
export function getStyleSidecarPath(documentPath: string): string {
  const base = documentPath.replace(/\.(md|markdown|mdown|mkd)$/i, '')
  return `${base}.markdoc-style.json`
}
