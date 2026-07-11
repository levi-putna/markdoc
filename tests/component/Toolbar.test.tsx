import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from '@renderer/components/Toolbar'
import { useDocumentStore } from '@renderer/store/document-store'

describe('TC-HEADER toolbar', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset()
  })

  it('TC-HEADER.1 renders sidebar toggle, view control, and search', () => {
    render(<Toolbar onSearchOpen={() => {}} />)
    expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('view-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('search-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('view-edit')).toBeInTheDocument()
    expect(screen.getByTestId('view-markdown')).toBeInTheDocument()
    expect(screen.getByTestId('view-preview')).toBeInTheDocument()
    expect(screen.getByTestId('view-split')).toBeInTheDocument()
  })

  it('TC-HEADER.3 switches view mode on segment click', () => {
    render(<Toolbar onSearchOpen={() => {}} />)
    fireEvent.click(screen.getByTestId('view-preview'))
    expect(useDocumentStore.getState().viewMode).toBe('preview')
    fireEvent.click(screen.getByTestId('view-split'))
    expect(useDocumentStore.getState().viewMode).toBe('split')
  })

  it('TC-HEADER.2 toggles sidebar visibility', () => {
    render(<Toolbar onSearchOpen={() => {}} />)
    expect(useDocumentStore.getState().sidebarVisible).toBe(true)
    fireEvent.click(screen.getByTestId('sidebar-toggle'))
    expect(useDocumentStore.getState().sidebarVisible).toBe(false)
  })
})

describe('TC-PERF.2 large document mode indicator', () => {
  beforeEach(() => {
    useDocumentStore.getState().reset()
  })

  it('shows indicator when document tier is large', () => {
    useDocumentStore.getState().setDocumentTier('large')
    render(<Toolbar onSearchOpen={() => {}} />)
    expect(screen.getByTestId('large-doc-indicator')).toBeInTheDocument()
  })

  it('hides indicator for standard tier', () => {
    useDocumentStore.getState().setDocumentTier('standard')
    render(<Toolbar onSearchOpen={() => {}} />)
    expect(screen.queryByTestId('large-doc-indicator')).not.toBeInTheDocument()
  })
})
