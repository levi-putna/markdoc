import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchOverlay } from '@renderer/components/SearchOverlay'

describe('TC-SEARCH document search', () => {
  const markdown = '# Introduction\n\nSome body text about testing.\n\n## Details\n\nMore content here.'
  const outlineTexts = [
    { text: 'Introduction', pos: 0 },
    { text: 'Details', pos: 40 },
  ]

  it('TC-SEARCH.1 opens search overlay with input', () => {
    render(
      <SearchOverlay
        markdown={markdown}
        outlineTexts={outlineTexts}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByTestId('search-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('TC-SEARCH.2 ranks heading matches above body', () => {
    render(
      <SearchOverlay
        markdown={markdown}
        outlineTexts={outlineTexts}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Intro' } })
    const results = screen.getAllByTestId(/^search-result-/)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].textContent?.toLowerCase()).toContain('heading')
  })

  it('TC-SEARCH.7 shows no results state', () => {
    render(
      <SearchOverlay
        markdown={markdown}
        outlineTexts={outlineTexts}
        onSelect={() => {}}
        onClose={() => {}}
      />
    )
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'zzzznotfound' } })
    expect(screen.getByTestId('search-no-results')).toBeInTheDocument()
  })

  it('TC-SEARCH.5 closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <SearchOverlay
        markdown={markdown}
        outlineTexts={outlineTexts}
        onSelect={() => {}}
        onClose={onClose}
      />
    )
    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
