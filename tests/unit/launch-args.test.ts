import { describe, it, expect } from 'vitest'
import { parseLaunchArgv } from '@shared/launch-args'

describe('parseLaunchArgv', () => {
  it('extracts markdown file paths from argv', () => {
    const result = parseLaunchArgv({
      argv: ['notes.md', 'readme.markdown'],
      cwd: '/Users/test/docs',
    })

    expect(result.files).toEqual(['/Users/test/docs/notes.md', '/Users/test/docs/readme.markdown'])
    expect(result.newWindow).toBe(false)
  })

  it('keeps absolute paths unchanged', () => {
    const result = parseLaunchArgv({
      argv: ['/tmp/example.md'],
      cwd: '/Users/test',
    })

    expect(result.files).toEqual(['/tmp/example.md'])
  })

  it('detects the --new-window flag', () => {
    const result = parseLaunchArgv({
      argv: ['--new-window', 'notes.md'],
      cwd: '/Users/test',
    })

    expect(result.files).toEqual(['/Users/test/notes.md'])
    expect(result.newWindow).toBe(true)
  })

  it('ignores unsupported extensions and unknown flags', () => {
    const result = parseLaunchArgv({
      argv: ['--verbose', 'notes.txt', 'draft.mdown'],
      cwd: '/Users/test',
    })

    expect(result.files).toEqual(['/Users/test/draft.mdown'])
    expect(result.newWindow).toBe(false)
  })
})
