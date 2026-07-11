import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OutlineHeadingBadge } from '@renderer/components/OutlineHeadingBadge'

describe('OutlineHeadingBadge', () => {
  it('renders compact H-level badges', () => {
    render(<OutlineHeadingBadge level={2} />)
    expect(screen.getByText('H2')).toBeInTheDocument()
  })

  it('clamps invalid levels to H1–H6', () => {
    const { rerender } = render(<OutlineHeadingBadge level={9} />)
    expect(screen.getByText('H6')).toBeInTheDocument()

    rerender(<OutlineHeadingBadge level={0} />)
    expect(screen.getByText('H1')).toBeInTheDocument()
  })
})
