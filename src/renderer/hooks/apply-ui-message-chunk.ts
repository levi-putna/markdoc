import type { UIMessage } from 'ai'

export type ActiveTextPartIndexes = Record<string, number>

export type UIMessageStreamChunk = {
  type?: string
  id?: string
  delta?: string
  errorText?: string
  toolCallId?: string
  toolName?: string
  input?: unknown
  output?: unknown
}

/**
 * Applies one UI message stream chunk while preserving part order.
 */
export function applyUIMessageChunk({
  message,
  chunk,
  activeTextPartIndexes,
}: {
  message: UIMessage
  chunk: UIMessageStreamChunk
  activeTextPartIndexes: ActiveTextPartIndexes
}): { message: UIMessage; activeTextPartIndexes: ActiveTextPartIndexes } {
  if (chunk.type === 'text-start' && chunk.id) {
    const partIndex = message.parts.length
    const nextActiveTextPartIndexes = {
      ...activeTextPartIndexes,
      [chunk.id]: partIndex,
    }

    return {
      message: {
        ...message,
        parts: [...message.parts, { type: 'text', text: '' }],
      },
      activeTextPartIndexes: nextActiveTextPartIndexes,
    }
  }

  if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
    const nextParts = [...message.parts]
    let partIndex = chunk.id ? activeTextPartIndexes[chunk.id] : undefined

    if (partIndex === undefined && chunk.id) {
      partIndex = nextParts.length
      nextParts.push({ type: 'text', text: '' })
    }

    if (partIndex === undefined) {
      partIndex = findLastTextPartIndex({ parts: nextParts })
      if (partIndex === -1) {
        partIndex = nextParts.length
        nextParts.push({ type: 'text', text: '' })
      }
    }

    const existingPart = nextParts[partIndex]
    if (!existingPart || existingPart.type !== 'text') {
      return { message, activeTextPartIndexes }
    }

    const existingText = 'text' in existingPart ? existingPart.text : ''
    nextParts[partIndex] = { type: 'text', text: existingText + chunk.delta }

    const nextActiveTextPartIndexes =
      chunk.id && activeTextPartIndexes[chunk.id] === undefined
        ? { ...activeTextPartIndexes, [chunk.id]: partIndex }
        : activeTextPartIndexes

    return {
      message: { ...message, parts: nextParts },
      activeTextPartIndexes: nextActiveTextPartIndexes,
    }
  }

  if (chunk.type === 'text-end' && chunk.id) {
    const nextActiveTextPartIndexes = { ...activeTextPartIndexes }
    delete nextActiveTextPartIndexes[chunk.id]
    return { message, activeTextPartIndexes: nextActiveTextPartIndexes }
  }

  if (chunk.type === 'tool-input-start' && chunk.toolCallId && chunk.toolName) {
    const existingIndex = message.parts.findIndex(
      (part) => 'toolCallId' in part && part.toolCallId === chunk.toolCallId
    )

    if (existingIndex !== -1) {
      return { message, activeTextPartIndexes }
    }

    const toolPart = {
      type: `tool-${chunk.toolName}`,
      toolCallId: chunk.toolCallId,
      state: 'input-streaming',
      input: undefined,
    } as UIMessage['parts'][number]

    return {
      message: { ...message, parts: [...message.parts, toolPart] },
      activeTextPartIndexes,
    }
  }

  if (chunk.type === 'tool-input-available' && chunk.toolCallId && chunk.toolName) {
    const toolPart = {
      type: `tool-${chunk.toolName}`,
      toolCallId: chunk.toolCallId,
      state: 'input-available',
      input: chunk.input,
    } as UIMessage['parts'][number]

    const existingIndex = message.parts.findIndex(
      (part) => 'toolCallId' in part && part.toolCallId === chunk.toolCallId
    )

    if (existingIndex === -1) {
      return {
        message: { ...message, parts: [...message.parts, toolPart] },
        activeTextPartIndexes,
      }
    }

    const nextParts = [...message.parts]
    nextParts[existingIndex] = toolPart
    return { message: { ...message, parts: nextParts }, activeTextPartIndexes }
  }

  if (chunk.type === 'tool-output-available' && chunk.toolCallId) {
    const existingIndex = message.parts.findIndex(
      (part) => 'toolCallId' in part && part.toolCallId === chunk.toolCallId
    )

    if (existingIndex === -1) {
      return { message, activeTextPartIndexes }
    }

    const existing = message.parts[existingIndex]
    const nextParts = [...message.parts]
    nextParts[existingIndex] = {
      ...existing,
      state: 'output-available',
      output: chunk.output,
    } as UIMessage['parts'][number]

    return { message: { ...message, parts: nextParts }, activeTextPartIndexes }
  }

  if (chunk.type === 'tool-output-error' && chunk.toolCallId) {
    const existingIndex = message.parts.findIndex(
      (part) => 'toolCallId' in part && part.toolCallId === chunk.toolCallId
    )

    if (existingIndex === -1) {
      return { message, activeTextPartIndexes }
    }

    const existing = message.parts[existingIndex]
    const nextParts = [...message.parts]
    nextParts[existingIndex] = {
      ...existing,
      state: 'output-error',
      errorText: chunk.errorText,
    } as UIMessage['parts'][number]

    return { message: { ...message, parts: nextParts }, activeTextPartIndexes }
  }

  return { message, activeTextPartIndexes }
}

/**
 * Finds the last text part index so post-tool deltas append in order.
 */
function findLastTextPartIndex({ parts }: { parts: UIMessage['parts'] }): number {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index]?.type === 'text') {
      return index
    }
  }

  return -1
}
