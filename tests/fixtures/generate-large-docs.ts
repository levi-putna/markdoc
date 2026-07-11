import { writeFileSync } from 'fs'
import { join } from 'path'

const fixturesDir = join(__dirname)

/**
 * Generates synthetic large documents for performance testing (QR-4.2).
 */
function generateWords(count: number): string {
  const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit']
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    parts.push(words[i % words.length])
  }
  return parts.join(' ')
}

function generateDocument(wordCount: number, withDiagrams = false): string {
  const sections = Math.ceil(wordCount / 500)
  const lines: string[] = ['# Performance Test Document\n']

  for (let s = 0; s < sections; s++) {
    lines.push(`\n## Section ${s + 1}\n`)
    lines.push(generateWords(500))

    if (withDiagrams && s % 5 === 0) {
      lines.push('\n```mermaid\ngraph TD\n    A --> B\n```\n')
    }

    if (s % 10 === 0) {
      lines.push('\n| Col A | Col B |\n|-------|-------|\n| a | b |\n')
    }
  }

  return lines.join('\n')
}

// Standard tier ~10k words
writeFileSync(join(fixturesDir, 'perf-standard.md'), generateDocument(10_000))

// Large tier ~50k words with diagrams
writeFileSync(join(fixturesDir, 'perf-large.md'), generateDocument(50_000, true))

// Very large tier ~150k words
writeFileSync(join(fixturesDir, 'perf-very-large.md'), generateDocument(150_000))

console.log('Generated performance fixtures: perf-standard.md, perf-large.md, perf-very-large.md')
