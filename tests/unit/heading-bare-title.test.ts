import { describe, it, expect } from 'vitest'
import { loadMarkdownIntoEditor, getMarkdownFromEditor } from '@shared/markdown'
import {
  syncHeadingNumbersInEditor,
  migrateLegacyNumberedHeadingText,
  clearHeadingNumbersInEditor,
} from '@shared/heading-numbering-apply'
import type { NumberingConfig } from '@shared/heading-numbering'

describe('heading numbering attrs (TC-NUMBER.7/11/13)', () => {
  it('TC-NUMBER.11 enable keeps bare title text and writes numbers to markdown on serialise', () => {
    const md = `# Introduction

## Scope of Work

# Background

## Appendix
`
    const editor = loadMarkdownIntoEditor(md)
    const config: NumberingConfig = {
      enabled: true,
      preset: 'decimal',
      displayMode: 'full',
      version: 1,
    }
    syncHeadingNumbersInEditor({ editor, config })

    // Editor text stays bare; numbers live on the attr + serialised markdown
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'heading') return
      expect(node.textContent).not.toMatch(/^\d/)
      expect(node.textContent).not.toBe('Untitled')
      expect(node.textContent).not.toBe('T')
    })

    const numbered = getMarkdownFromEditor(editor)
    expect(numbered).toContain('# 1 Introduction')
    expect(numbered).toContain('## 1.1 Scope of Work')
    expect(numbered).toContain('# 2 Background')
    expect(numbered).toContain('## 2.1 Appendix')

    clearHeadingNumbersInEditor({ editor })
    const cleared = getMarkdownFromEditor(editor)
    expect(cleared).toContain('# Introduction')
    expect(cleared).toContain('## Scope of Work')
    expect(cleared).not.toContain('Untitled')
    editor.destroy()
  })

  it('TC-NUMBER.7 does not mangle titles that start like classic labels', () => {
    const editor = loadMarkdownIntoEditor(`# I Love Cats

## A complete guide

## The Theory of Everything
`)
    syncHeadingNumbersInEditor({
      editor,
      config: { enabled: true, preset: 'classic', displayMode: 'full', version: 1 },
    })

    const texts: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') texts.push(node.textContent)
    })
    expect(texts).toContain('I Love Cats')
    expect(texts).toContain('A complete guide')
    expect(texts).toContain('The Theory of Everything')
    expect(texts).not.toContain('T')
    expect(texts).not.toContain('Untitled')
    editor.destroy()
  })

  it('TC-NUMBER.7 migrates legacy inline numbers out of text once', () => {
    expect(
      migrateLegacyNumberedHeadingText({ text: '1.2 Introduction', displayLabel: '1.2' })
    ).toBe('Introduction')
    expect(
      migrateLegacyNumberedHeadingText({ text: 'Chapter 2 Methods', displayLabel: 'Chapter 2' })
    ).toBe('Methods')
    expect(
      migrateLegacyNumberedHeadingText({ text: 'A complete guide', displayLabel: 'A' })
    ).toBeNull()
    expect(
      migrateLegacyNumberedHeadingText({ text: 'I Love Cats', displayLabel: 'I' })
    ).toBeNull()
  })

  it('TC-NUMBER.13 recovers from documents already saved with inline numbers', () => {
    const editor = loadMarkdownIntoEditor(`# 1 Introduction

## 1.1 Scope
`)
    syncHeadingNumbersInEditor({
      editor,
      config: { enabled: true, preset: 'decimal', displayMode: 'full', version: 1 },
    })

    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'heading') return
      expect(node.textContent).toBe(
        node.textContent === 'Introduction' || node.textContent === 'Scope'
          ? node.textContent
          : 'unexpected'
      )
    })

    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# 1 Introduction')
    expect(result).toContain('## 1.1 Scope')
    editor.destroy()
  })
})
