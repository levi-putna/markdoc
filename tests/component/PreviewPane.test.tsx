import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviewPane } from '@renderer/components/PreviewPane'

describe('TC-PREVIEW.1 preview rendering', () => {
  it('renders HTML without raw markdown syntax in text', () => {
    render(
      <PreviewPane html="<h1>Heading</h1><p><strong>Bold</strong> text</p>" />
    )
    const pane = screen.getByTestId('preview-pane')
    expect(pane.textContent).toContain('Heading')
    expect(pane.textContent).toContain('Bold')
    expect(pane.textContent).not.toContain('#')
    expect(pane.textContent).not.toContain('**')
  })

  it('strips script tags from HTML', () => {
    render(<PreviewPane html='<p>Safe</p><script>alert("xss")</script>' />)
    const pane = screen.getByTestId('preview-pane')
    expect(pane.innerHTML).not.toContain('<script>')
    expect(pane.textContent).toContain('Safe')
  })
})
