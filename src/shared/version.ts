/**
 * Compares two dot-separated version strings (e.g. "1.2.3").
 * Returns a positive number if `a` is newer than `b`, a negative number if
 * `a` is older, and 0 if they're equivalent. Missing segments are treated
 * as 0, so "1.2" is considered equal to "1.2.0".
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const length = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }

  return 0
}
