import { describe, it, expect } from 'vitest'
import { loadMarkdownIntoEditor, getMarkdownFromEditor } from '@shared/markdown'
import { buildOutlineFromDoc } from '@shared/document-index'
import {
  syncHeadingNumbersInEditor,
  clearHeadingNumbersInEditor,
  isHeadingNumberingTransaction,
  headingNumberingKey,
} from '@shared/heading-numbering-apply'
import type { NumberingConfig } from '@shared/heading-numbering'
import { Plugin, PluginKey } from '@tiptap/pm/state'

describe('heading numbering apply (TC-NUMBER.11–16)', () => {
  const markdown = `# Introduction

## Scope

### Details

## Background

# Appendix
`

  const decimalConfig: NumberingConfig = {
    enabled: true,
    preset: 'decimal',
    displayMode: 'full',
    version: 1,
  }

  it('TC-NUMBER.11 writes decimal numbers into markdown and keeps bare titles in the editor', () => {
    const editor = loadMarkdownIntoEditor(markdown)

    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const numbered = getMarkdownFromEditor(editor)
    expect(numbered).toContain('# 1 Introduction')
    expect(numbered).toContain('## 1.1 Scope')
    expect(numbered).toContain('### 1.1.1 Details')
    expect(numbered).toContain('## 1.2 Background')
    expect(numbered).toContain('# 2 Appendix')

    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'heading') return
      expect(node.attrs.headingNumberLabel).toBeTruthy()
      expect(node.textContent).not.toMatch(/^\d/)
    })

    clearHeadingNumbersInEditor({ editor })
    const cleared = getMarkdownFromEditor(editor)
    expect(cleared).toContain('# Introduction')
    expect(cleared).toContain('## Scope')
    expect(cleared).not.toMatch(/^#\s+\d+/m)

    editor.destroy()
  })

  it('TC-NUMBER.11 clears via sync when config.enabled is false', () => {
    const editor = loadMarkdownIntoEditor(markdown)
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    expect(getMarkdownFromEditor(editor)).toContain('# 1 Introduction')

    syncHeadingNumbersInEditor({
      editor,
      config: { ...decimalConfig, enabled: false },
    })
    const cleared = getMarkdownFromEditor(editor)
    expect(cleared).toContain('# Introduction')
    expect(cleared).not.toMatch(/^#\s+\d+/m)

    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'heading') return
      expect(node.attrs.headingNumberLabel).toBeNull()
    })
    editor.destroy()
  })

  it('TC-NUMBER.12 preserves headingId suffixes on serialise', () => {
    const editor = loadMarkdownIntoEditor('# Introduction {#intro-heading}\n\n## Scope {#scope-heading}\n')
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# 1 Introduction {#intro-heading}')
    expect(result).toContain('## 1.1 Scope {#scope-heading}')
    editor.destroy()
  })

  it('TC-NUMBER.13 migrates legacy inline numbers without double-prefixing on reload', () => {
    const editor = loadMarkdownIntoEditor(`# 1 Introduction

## 1.1 Scope
`)
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })

    const titles: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') titles.push(node.textContent)
    })
    expect(titles).toEqual(['Introduction', 'Scope'])

    // Second sync must not stack another "1 " into the attr-driven serialise
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# 1 Introduction')
    expect(result).toContain('## 1.1 Scope')
    expect(result).not.toMatch(/# 1 1 /)
    expect(result).not.toMatch(/## 1\.1 1\.1 /)
    editor.destroy()
  })

  it('TC-NUMBER.14 cleans classic attr-driven tokens when switching to decimal', () => {
    const editor = loadMarkdownIntoEditor(markdown)
    const classic: NumberingConfig = {
      enabled: true,
      preset: 'classic',
      displayMode: 'full',
      version: 1,
    }
    syncHeadingNumbersInEditor({ editor, config: classic })
    expect(getMarkdownFromEditor(editor)).toContain('# I Introduction')
    expect(getMarkdownFromEditor(editor)).toContain('## A Scope')
    expect(getMarkdownFromEditor(editor)).toContain('### 1 Details')

    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# 1 Introduction')
    expect(result).toContain('## 1.1 Scope')
    expect(result).toContain('### 1.1.1 Details')
    expect(result).not.toMatch(/# \d+ I /)
    expect(result).not.toMatch(/## [\d.]+ A /)
    editor.destroy()
  })

  it('TC-NUMBER.14 leaves classic inline prose prefixes when migrating to decimal', () => {
    const editor = loadMarkdownIntoEditor('# I Introduction\n\n## A Scope\n')
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const result = getMarkdownFromEditor(editor)
    // Ambiguous classic prefixes are not stripped from prose — label is stored on attr
    expect(result).toContain('# 1 I Introduction')
    expect(result).toContain('## 1.1 A Scope')

    const titles: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading') titles.push(node.textContent)
    })
    expect(titles).toEqual(['I Introduction', 'A Scope'])
    editor.destroy()
  })

  it('TC-NUMBER.15 re-numbers after outline structure changes', () => {
    const editor = loadMarkdownIntoEditor('# Alpha\n\n# Beta\n')
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    expect(getMarkdownFromEditor(editor)).toContain('# 1 Alpha')
    expect(getMarkdownFromEditor(editor)).toContain('# 2 Beta')

    const outline = buildOutlineFromDoc(editor.state.doc)
    const secondPos = outline[1].pos
    editor
      .chain()
      .insertContentAt(secondPos, {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Middle' }],
      })
      .run()
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# 1 Alpha')
    expect(result).toContain('# 2 Middle')
    expect(result).toContain('# 3 Beta')
    editor.destroy()
  })

  it('TC-NUMBER.18 re-numbers after nesting depth changes', () => {
    const editor = loadMarkdownIntoEditor('# Alpha\n\n## Beta\n')
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    expect(getMarkdownFromEditor(editor)).toContain('## 1.1 Beta')

    // Promote Beta to a top-level sibling (outdent)
    let betaPos = -1
    let betaAttrs: Record<string, unknown> | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent === 'Beta') {
        betaPos = pos
        betaAttrs = { ...node.attrs }
      }
    })
    expect(betaPos).toBeGreaterThanOrEqual(0)
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeMarkup(betaPos, undefined, { ...betaAttrs, level: 1 })
        return true
      })
      .run()
    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# 1 Alpha')
    expect(result).toContain('# 2 Beta')
    expect(result).not.toContain('## 1.1 Beta')
    editor.destroy()
  })

  it('TC-NUMBER.16 tags sync/clear transactions and excludes them from history', () => {
    const editor = loadMarkdownIntoEditor('# Title\n')
    const seen: Array<{ isNumbering: boolean; addToHistory: unknown }> = []
    const probeKey = new PluginKey('numberingHistoryProbe')

    editor.registerPlugin(
      new Plugin({
        key: probeKey,
        appendTransaction(transactions) {
          for (const transaction of transactions) {
            if (!transaction.docChanged) continue
            seen.push({
              isNumbering: isHeadingNumberingTransaction(transaction),
              addToHistory: transaction.getMeta('addToHistory'),
            })
          }
          return null
        },
      })
    )

    syncHeadingNumbersInEditor({ editor, config: decimalConfig })
    clearHeadingNumbersInEditor({ editor })

    expect(seen.length).toBeGreaterThanOrEqual(2)
    for (const entry of seen) {
      expect(entry.isNumbering).toBe(true)
      expect(entry.addToHistory).toBe(false)
    }

    // Direct meta probe — the PluginKey used by the apply helpers
    expect(headingNumberingKey).toBeTruthy()
    editor.destroy()
  })

  it('applies chapter preset labels into markdown', () => {
    const editor = loadMarkdownIntoEditor('# Intro\n\n## Scope\n')
    syncHeadingNumbersInEditor({
      editor,
      config: { enabled: true, preset: 'chapter', displayMode: 'full', version: 1 },
    })
    const result = getMarkdownFromEditor(editor)
    expect(result).toContain('# Chapter 1 Intro')
    expect(result).toContain('## 1.1 Scope')
    editor.destroy()
  })
})
