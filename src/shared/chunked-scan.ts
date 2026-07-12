/**
 * Runs a synchronous scan in chunks, yielding to the event loop between chunks
 * so the UI thread never locks up on large documents (TR-12.10).
 */
export async function chunkedScan<T>({
  items,
  chunkSize = 200,
  processItem,
  onChunkComplete,
}: {
  items: T[]
  chunkSize?: number
  processItem: (item: T, index: number) => void
  onChunkComplete?: (processed: number, total: number) => void
}): Promise<void> {
  let index = 0

  while (index < items.length) {
    const end = Math.min(index + chunkSize, items.length)
    for (let i = index; i < end; i += 1) {
      processItem(items[i], i)
    }
    index = end
    onChunkComplete?.(index, items.length)
    if (index < items.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    }
  }
}

/**
 * Finds all matches of `query` in `text`, processing line-by-line in chunks.
 */
export async function chunkedFindMatches({
  text,
  query,
  chunkSize = 100,
}: {
  text: string
  query: string
  chunkSize?: number
}): Promise<Array<{ index: number; length: number }>> {
  const matches: Array<{ index: number; length: number }> = []
  const lowerQuery = query.toLowerCase()
  if (!lowerQuery) return matches

  const lines = text.split('\n')
  let charOffset = 0

  await chunkedScan({
    items: lines,
    chunkSize,
    processItem: (line) => {
      const lowerLine = line.toLowerCase()
      let searchFrom = 0
      let idx = lowerLine.indexOf(lowerQuery, searchFrom)
      while (idx !== -1) {
        matches.push({ index: charOffset + idx, length: query.length })
        searchFrom = idx + 1
        idx = lowerLine.indexOf(lowerQuery, searchFrom)
      }
      charOffset += line.length + 1
    },
  })

  return matches
}
