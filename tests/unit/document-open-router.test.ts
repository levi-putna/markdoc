import { describe, expect, it } from 'vitest'
import {
  PRISTINE_DOCUMENT_SNAPSHOT,
  findPristineWindowId,
  isOccupiedSnapshot,
  isPristineSnapshot,
  resolveFileOpenRoute,
} from '../../src/main/document-open-router'
import type { WindowDocumentSnapshot } from '../../src/shared/ipc'

function snapshots(entries: Record<number, WindowDocumentSnapshot>) {
  return new Map(Object.entries(entries).map(([id, snapshot]) => [Number(id), snapshot]))
}

describe('document-open-router', () => {
  it('treats the default snapshot as pristine', () => {
    expect(isPristineSnapshot(PRISTINE_DOCUMENT_SNAPSHOT)).toBe(true)
    expect(isOccupiedSnapshot(PRISTINE_DOCUMENT_SNAPSHOT)).toBe(false)
  })

  it('detects occupied documents', () => {
    expect(
      isOccupiedSnapshot({ filePath: '/tmp/doc.md', isDirty: false, isEmpty: true })
    ).toBe(true)
    expect(isOccupiedSnapshot({ filePath: null, isDirty: true, isEmpty: true })).toBe(true)
    expect(isOccupiedSnapshot({ filePath: null, isDirty: false, isEmpty: false })).toBe(true)
  })

  it('prefers the focused pristine window when reusing externally', () => {
    const result = findPristineWindowId({
      windowIds: [1, 2],
      snapshots: snapshots({
        1: { filePath: '/tmp/a.md', isDirty: false, isEmpty: false },
        2: PRISTINE_DOCUMENT_SNAPSHOT,
      }),
      focusedWindowId: 2,
    })

    expect(result).toBe(2)
  })

  it('reuses any pristine window for external opens when focused window is occupied', () => {
    const result = findPristineWindowId({
      windowIds: [1, 2],
      snapshots: snapshots({
        1: PRISTINE_DOCUMENT_SNAPSHOT,
        2: { filePath: '/tmp/a.md', isDirty: false, isEmpty: false },
      }),
      focusedWindowId: 2,
    })

    expect(result).toBe(1)
  })

  it('routes external opens into a pristine window', () => {
    const route = resolveFileOpenRoute({
      source: 'external',
      forceNewWindow: false,
      focusedWindowId: 1,
      windowIds: [1],
      snapshots: snapshots({ 1: PRISTINE_DOCUMENT_SNAPSHOT }),
    })

    expect(route).toEqual({ type: 'in-place', windowId: 1 })
  })

  it('routes external opens to a new window when every window is occupied', () => {
    const route = resolveFileOpenRoute({
      source: 'external',
      forceNewWindow: false,
      focusedWindowId: 1,
      windowIds: [1],
      snapshots: snapshots({
        1: { filePath: '/tmp/a.md', isDirty: false, isEmpty: false },
      }),
    })

    expect(route).toEqual({ type: 'new-window' })
  })

  it('forces a new window when --new-window is set', () => {
    const route = resolveFileOpenRoute({
      source: 'external',
      forceNewWindow: true,
      focusedWindowId: 1,
      windowIds: [1],
      snapshots: snapshots({ 1: PRISTINE_DOCUMENT_SNAPSHOT }),
    })

    expect(route).toEqual({ type: 'new-window' })
  })

  it('reuses a pristine window for File > Open', () => {
    const route = resolveFileOpenRoute({
      source: 'menu',
      forceNewWindow: false,
      focusedWindowId: 4,
      windowIds: [4],
      snapshots: snapshots({ 4: PRISTINE_DOCUMENT_SNAPSHOT }),
    })

    expect(route).toEqual({ type: 'in-place', windowId: 4 })
  })

  it('opens a new window from File > Open when the focused document has content', () => {
    const route = resolveFileOpenRoute({
      source: 'menu',
      forceNewWindow: false,
      focusedWindowId: 4,
      windowIds: [4],
      snapshots: snapshots({
        4: { filePath: '/tmp/a.md', isDirty: false, isEmpty: false },
      }),
    })

    expect(route).toEqual({ type: 'new-window' })
  })

  it('reuses a pristine drop target window', () => {
    const route = resolveFileOpenRoute({
      source: 'drop',
      forceNewWindow: false,
      targetWindowId: 7,
      focusedWindowId: 3,
      windowIds: [3, 7],
      snapshots: snapshots({
        3: { filePath: '/tmp/a.md', isDirty: false, isEmpty: false },
        7: PRISTINE_DOCUMENT_SNAPSHOT,
      }),
    })

    expect(route).toEqual({ type: 'in-place', windowId: 7 })
  })

  it('opens a new window for drops onto an occupied target window', () => {
    const route = resolveFileOpenRoute({
      source: 'drop',
      forceNewWindow: false,
      targetWindowId: 7,
      focusedWindowId: 7,
      windowIds: [7],
      snapshots: snapshots({
        7: { filePath: '/tmp/a.md', isDirty: true, isEmpty: false },
      }),
    })

    expect(route).toEqual({ type: 'new-window' })
  })
})
