import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { AutocompleteContextWindow } from './ai/types'
import { flattenOutline } from './document-index'
import type { OutlineNode } from './types'

export interface AutocompleteBlockContext {
  blockType: 'paragraph' | 'heading' | 'listItem' | 'blockquote' | 'codeBlock' | 'other'
  headingLevel?: number
  sectionTitle?: string
}

export interface AutocompleteEditorContext {
  prefix: string
  suffix: string
  charBeforeCursor: string
  charAfterCursor: string
  cursorInWord: boolean
  block: AutocompleteBlockContext
  contextWindow: AutocompleteContextWindow
}

const CONTEXT_LIMITS: Record<
  AutocompleteContextWindow,
  { prefix: number; suffix: number }
> = {
  paragraph: { prefix: 2_000, suffix: 600 },
  section: { prefix: 4_000, suffix: 1_200 },
  document: { prefix: 8_000, suffix: 2_000 },
}

/**
 * Builds scoped prefix/suffix and structural context for inline autocomplete.
 */
export function buildAutocompleteEditorContext({
  editor,
  contextWindow,
  outline,
}: {
  editor: Editor
  contextWindow: AutocompleteContextWindow
  outline: OutlineNode[]
}): AutocompleteEditorContext | null {
  const { from } = editor.state.selection
  const doc = editor.state.doc

  const fullPrefix = doc.textBetween(0, from, '\n')
  const fullSuffix = doc.textBetween(from, doc.content.size, '\n')

  if (fullPrefix.trim().length < 8) return null

  const blockRange = getBlockRangeAtPosition({ doc, pos: from })
  const sectionRange = getSectionRangeAtPosition({ outline, pos: from, docSize: doc.content.size })

  const scoped = scopeAutocompleteText({
    contextWindow,
    fullPrefix,
    fullSuffix,
    blockPrefix: doc.textBetween(blockRange.from, from, '\n'),
    blockSuffix: doc.textBetween(from, blockRange.to, '\n'),
    sectionPrefix: doc.textBetween(sectionRange.from, from, '\n'),
    sectionSuffix: doc.textBetween(from, sectionRange.to, '\n'),
  })

  const charBeforeCursor = fullPrefix.slice(-1)
  const charAfterCursor = fullSuffix.slice(0, 1)

  return {
    prefix: scoped.prefix,
    suffix: scoped.suffix,
    charBeforeCursor,
    charAfterCursor,
    cursorInWord: isCursorInsideWord({ charBeforeCursor, charAfterCursor }),
    block: detectBlockContext({ editor, pos: from, outline }),
    contextWindow,
  }
}

/**
 * Trims model output while preserving leading spacing needed at the cursor.
 */
export function normaliseAutocompleteSuggestion({
  suggestion,
  prefix,
  suffix,
  charBeforeCursor,
  charAfterCursor,
  cursorInWord,
}: {
  suggestion: string
  prefix: string
  suffix: string
  charBeforeCursor: string
  charAfterCursor: string
  cursorInWord: boolean
}): string | null {
  if (!suggestion) return null

  let text = suggestion.replace(/\r\n/g, '\n').replace(/\n+$/g, '')
  if (!text.trim()) return null

  if (cursorInWord) return null

  if (text.startsWith(prefix.slice(-Math.min(prefix.length, text.length)))) {
    return null
  }

  if (suffix && text === suffix) return null

  const overlapLength = longestSharedPrefixLength({ left: text, right: suffix })
  if (overlapLength > 0 && overlapLength >= Math.min(text.length, suffix.length)) {
    return null
  }
  if (overlapLength > 0) {
    text = text.slice(overlapLength)
    if (!text.trim()) return null
  }

  text = applyLeadingSpacing({
    text,
    charBeforeCursor,
    charAfterCursor,
  })

  if (!text) return null
  return text
}

/**
 * Builds the system and user prompts for autocomplete generation.
 */
export function buildAutocompletePrompt({
  context,
}: {
  context: AutocompleteEditorContext
}): { system: string; prompt: string } {
  const blockDescription = describeBlockContext({ block: context.block })

  const system = [
    'You are an inline writing autocomplete engine for a Markdown document editor.',
    'Return only the text that should appear immediately after the cursor.',
    'Do not repeat any text already present before the cursor.',
    'Do not include text that already appears after the cursor.',
    'Do not wrap the answer in quotes, markdown fences, or explanations.',
    'Preserve the author\'s voice, tense, and formatting.',
    'Include leading spaces or punctuation when they are required for correct grammar.',
    'Stop after a phrase, clause, or sentence — do not draft an entire section.',
  ].join(' ')

  const prompt = [
    `Context window: ${context.contextWindow}`,
    `Current block: ${blockDescription}`,
    context.block.sectionTitle ? `Current section: ${context.block.sectionTitle}` : null,
    'Continue the document at <CURSOR>.',
    '',
    '<<<BEFORE_CURSOR',
    context.prefix,
    'BEFORE_CURSOR>>>',
    '<CURSOR>',
    '<<<AFTER_CURSOR',
    context.suffix,
    'AFTER_CURSOR>>>',
  ]
    .filter(Boolean)
    .join('\n')

  return { system, prompt }
}

function scopeAutocompleteText({
  contextWindow,
  fullPrefix,
  fullSuffix,
  blockPrefix,
  blockSuffix,
  sectionPrefix,
  sectionSuffix,
}: {
  contextWindow: AutocompleteContextWindow
  fullPrefix: string
  fullSuffix: string
  blockPrefix: string
  blockSuffix: string
  sectionPrefix: string
  sectionSuffix: string
}): { prefix: string; suffix: string } {
  const limits = CONTEXT_LIMITS[contextWindow]

  if (contextWindow === 'paragraph') {
    return {
      prefix: tailText({ text: blockPrefix, maxChars: limits.prefix }),
      suffix: headText({ text: blockSuffix, maxChars: limits.suffix }),
    }
  }

  if (contextWindow === 'section') {
    return {
      prefix: tailText({ text: sectionPrefix, maxChars: limits.prefix }),
      suffix: headText({ text: sectionSuffix, maxChars: limits.suffix }),
    }
  }

  return {
    prefix: tailText({ text: fullPrefix, maxChars: limits.prefix }),
    suffix: headText({ text: fullSuffix, maxChars: limits.suffix }),
  }
}

function getBlockRangeAtPosition({
  doc,
  pos,
}: {
  doc: ProseMirrorNode
  pos: number
}): { from: number; to: number } {
  const $pos = doc.resolve(pos)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.isBlock) {
      return { from: $pos.start(depth), to: $pos.end(depth) }
    }
  }

  return { from: 0, to: doc.content.size }
}

function getSectionRangeAtPosition({
  outline,
  pos,
  docSize,
}: {
  outline: OutlineNode[]
  pos: number
  docSize: number
}): { from: number; to: number } {
  const flat = flattenOutline(outline)
  let active: { pos: number; sectionEnd: number } | null = null

  for (const item of flat) {
    if (item.pos <= pos) {
      active = item
    }
  }

  if (!active) {
    return { from: 0, to: docSize }
  }

  return { from: active.pos, to: active.sectionEnd }
}

function detectBlockContext({
  editor,
  pos,
  outline,
}: {
  editor: Editor
  pos: number
  outline: OutlineNode[]
}): AutocompleteBlockContext {
  const $pos = editor.state.doc.resolve(pos)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    const name = node.type.name

    if (name === 'heading') {
      return {
        blockType: 'heading',
        headingLevel: node.attrs.level as number,
        sectionTitle: node.textContent,
      }
    }

    if (name === 'listItem') {
      return {
        blockType: 'listItem',
        sectionTitle: findSectionTitle({ outline, pos }),
      }
    }

    if (name === 'blockquote') {
      return {
        blockType: 'blockquote',
        sectionTitle: findSectionTitle({ outline, pos }),
      }
    }

    if (name === 'codeBlock') {
      return { blockType: 'codeBlock' }
    }

    if (name === 'paragraph') {
      return {
        blockType: 'paragraph',
        sectionTitle: findSectionTitle({ outline, pos }),
      }
    }
  }

  return {
    blockType: 'other',
    sectionTitle: findSectionTitle({ outline, pos }),
  }
}

function findSectionTitle({
  outline,
  pos,
}: {
  outline: OutlineNode[]
  pos: number
}): string | undefined {
  const flat = flattenOutline(outline)
  let title: string | undefined

  for (const item of flat) {
    if (item.pos <= pos) {
      title = item.text
    }
  }

  return title
}

function describeBlockContext({ block }: { block: AutocompleteBlockContext }): string {
  if (block.blockType === 'heading' && block.headingLevel) {
    return `heading level ${block.headingLevel}`
  }

  return block.blockType
}

function isCursorInsideWord({
  charBeforeCursor,
  charAfterCursor,
}: {
  charBeforeCursor: string
  charAfterCursor: string
}): boolean {
  return /[A-Za-z0-9]/.test(charBeforeCursor) && /[A-Za-z0-9]/.test(charAfterCursor)
}

function applyLeadingSpacing({
  text,
  charBeforeCursor,
  charAfterCursor,
}: {
  text: string
  charBeforeCursor: string
  charAfterCursor: string
}): string {
  if (!text) return text
  if (text.startsWith(' ')) return text

  const needsSpace =
    /[A-Za-z0-9]/.test(charBeforeCursor) &&
    /^[A-Za-z0-9]/.test(text) &&
    charAfterCursor !== ' '

  if (needsSpace) {
    return ` ${text}`
  }

  return text
}

function longestSharedPrefixLength({ left, right }: { left: string; right: string }): number {
  const limit = Math.min(left.length, right.length)
  let index = 0

  while (index < limit && left[index] === right[index]) {
    index += 1
  }

  return index
}

function tailText({ text, maxChars }: { text: string; maxChars: number }): string {
  if (text.length <= maxChars) return text
  return text.slice(text.length - maxChars)
}

function headText({ text, maxChars }: { text: string; maxChars: number }): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars)
}
