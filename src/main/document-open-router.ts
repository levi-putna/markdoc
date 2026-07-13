import type { FileOpenSource, WindowDocumentSnapshot } from '../shared/ipc'

export type { WindowDocumentSnapshot }

/** Default snapshot for a freshly created document window before the renderer syncs. */
export const PRISTINE_DOCUMENT_SNAPSHOT: WindowDocumentSnapshot = {
  filePath: null,
  isDirty: false,
  isEmpty: true,
}

export type FileOpenRouteAction =
  | { type: 'new-window' }
  | { type: 'in-place'; windowId: number }

/**
 * True when the window holds an untouched untitled document that can be
 * replaced by an incoming file open without discarding user work.
 */
export function isPristineSnapshot(snapshot: WindowDocumentSnapshot | undefined): boolean {
  if (!snapshot) return false
  return snapshot.filePath === null && !snapshot.isDirty && snapshot.isEmpty
}

/**
 * True when the window is occupied by a saved path, edits, or non-empty content.
 */
export function isOccupiedSnapshot(snapshot: WindowDocumentSnapshot | undefined): boolean {
  return !isPristineSnapshot(snapshot)
}

/**
 * Picks the best pristine window to reuse, preferring the focused document window.
 */
export function findPristineWindowId({
  windowIds,
  snapshots,
  focusedWindowId,
}: {
  windowIds: number[]
  snapshots: Map<number, WindowDocumentSnapshot>
  focusedWindowId: number | null
}): number | null {
  if (focusedWindowId !== null && isPristineSnapshot(snapshots.get(focusedWindowId))) {
    return focusedWindowId
  }

  for (const id of windowIds) {
    if (isPristineSnapshot(snapshots.get(id))) {
      return id
    }
  }

  return null
}

/**
 * Pure routing decision for where an incoming file open should land.
 */
export function resolveFileOpenRoute({
  source,
  forceNewWindow,
  targetWindowId,
  focusedWindowId,
  windowIds,
  snapshots,
}: {
  source: FileOpenSource
  forceNewWindow: boolean
  targetWindowId?: number
  focusedWindowId: number | null
  windowIds: number[]
  snapshots: Map<number, WindowDocumentSnapshot>
}): FileOpenRouteAction {
  if (forceNewWindow) {
    return { type: 'new-window' }
  }

  if (source === 'external') {
    const pristineId = findPristineWindowId({ windowIds, snapshots, focusedWindowId })
    if (pristineId !== null) {
      return { type: 'in-place', windowId: pristineId }
    }
    return { type: 'new-window' }
  }

  const targetId =
    source === 'drop' && targetWindowId !== undefined ? targetWindowId : focusedWindowId

  if (targetId !== null && isPristineSnapshot(snapshots.get(targetId))) {
    return { type: 'in-place', windowId: targetId }
  }

  return { type: 'new-window' }
}
