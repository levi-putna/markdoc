import { createLowlight, common } from 'lowlight'

/**
 * Shared lowlight instance registered with a curated set of commonly used
 * languages (kept in sync with `CODE_LANGUAGE_OPTIONS` below). Used by the
 * code-block extension to decorate fenced code with syntax-highlight tokens.
 */
export const lowlight = createLowlight(common)

export interface CodeLanguageOption {
  value: string
  label: string
}

/** Friendly display names for lowlight's `common` language grammars. */
const LANGUAGE_LABELS: Record<string, string> = {
  arduino: 'Arduino',
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  diff: 'Diff',
  go: 'Go',
  graphql: 'GraphQL',
  ini: 'INI',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  less: 'Less',
  lua: 'Lua',
  makefile: 'Makefile',
  markdown: 'Markdown',
  objectivec: 'Objective-C',
  perl: 'Perl',
  php: 'PHP',
  'php-template': 'PHP Template',
  plaintext: 'Plain text',
  python: 'Python',
  'python-repl': 'Python (REPL)',
  r: 'R',
  ruby: 'Ruby',
  rust: 'Rust',
  scss: 'SCSS',
  shell: 'Shell',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  vbnet: 'VB.NET',
  wasm: 'WebAssembly',
  xml: 'HTML/XML',
  yaml: 'YAML',
}

/**
 * Language picker options for the code-block toolbar. "Auto" (no `language`
 * attribute — highlighting is guessed from content) and "Plain text"
 * (highlighting explicitly disabled) are pinned first; the rest are sorted
 * alphabetically by display label.
 */
export const CODE_LANGUAGE_OPTIONS: CodeLanguageOption[] = [
  { value: '', label: 'Auto' },
  { value: 'plaintext', label: 'Plain text' },
  ...Object.keys(common)
    .filter((value) => value !== 'plaintext')
    .map((value) => ({ value, label: LANGUAGE_LABELS[value] ?? value }))
    .sort((a, b) => a.label.localeCompare(b.label)),
]

/**
 * Resolves the display label for a stored `language` attribute value.
 */
export function getCodeLanguageLabel({ value }: { value: string | null | undefined }): string {
  if (!value) return 'Auto'
  return CODE_LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value
}
