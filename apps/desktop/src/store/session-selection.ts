import { atom } from 'nanostores'

// Sidebar multi-select: the set of rows a bulk verb (archive, delete) applies
// to. Kept out of the row components so every surface that renders a session
// row — flat recents, the virtualized list, pinned, workspace groups — shares
// one selection without threading state through four layers of props.
//
// Gestures (see `resolveSessionRowClick`): ⇧-click extends a range from the
// anchor, ⌘/⌃-click toggles one row, a plain click clears and resumes.

/** Selected rows, in the order they were added (range selects add top-down). */
export const $selectedSessionIds = atom<readonly string[]>([])

interface SelectionAnchor {
  scope: string
  sessionId: string
}

// Where the next range starts. Scoped: a range only makes sense within one
// list, so an anchor left behind in another section is ignored rather than
// producing a selection that spans a boundary the user can't see.
const $selectionAnchor = atom<null | SelectionAnchor>(null)

// scope -> the session ids that scope renders, in visual order. Registered by
// the section that owns the list (it is the only thing that knows the order
// AFTER grouping, sorting and manual drag order are applied); the virtualizer
// is irrelevant here because this is the data order, not the mounted order.
const rowOrderByScope = new Map<string, readonly string[]>()

export function registerSessionRowOrder(scope: string, ids: readonly string[]): void {
  rowOrderByScope.set(scope, ids)
}

export function forgetSessionRowOrder(scope: string): void {
  rowOrderByScope.delete(scope)
}

export function clearSessionSelection(): void {
  $selectionAnchor.set(null)

  if ($selectedSessionIds.get().length > 0) {
    $selectedSessionIds.set([])
  }
}

/** ⌘/⌃-click: add or remove one row, and re-anchor the next range on it. */
export function toggleSessionSelection(scope: string, sessionId: string): void {
  const current = $selectedSessionIds.get()
  const selected = current.includes(sessionId)
  const next = selected ? current.filter(id => id !== sessionId) : [...current, sessionId]

  $selectedSessionIds.set(next)
  // Deselecting drops the anchor: ranging from a row that is no longer part of
  // the selection reads as a bug from the outside.
  $selectionAnchor.set(selected ? null : { scope, sessionId })
}

/**
 * ⇧-click: select every row between the anchor and this one.
 *
 * With no usable anchor (first shift-click, or one left in another section)
 * this behaves as a plain select of the clicked row and plants the anchor, so
 * the NEXT shift-click ranges — the same recovery Explorer and Finder do.
 *
 * The anchor deliberately stays put afterwards: repeated shift-clicks grow and
 * shrink one range from a fixed origin instead of walking it down the list.
 */
export function selectSessionRange(scope: string, sessionId: string): void {
  const order = rowOrderByScope.get(scope) ?? []
  const anchor = $selectionAnchor.get()
  const from = anchor?.scope === scope ? order.indexOf(anchor.sessionId) : -1
  const to = order.indexOf(sessionId)

  if (from < 0 || to < 0) {
    $selectedSessionIds.set([sessionId])
    $selectionAnchor.set({ scope, sessionId })

    return
  }

  const [lo, hi] = from <= to ? [from, to] : [to, from]

  $selectedSessionIds.set(order.slice(lo, hi + 1))
}

/** Drop ids that have left the list (archived, deleted) from the selection. */
export function pruneSessionSelection(goneIds: readonly string[]): void {
  const gone = new Set(goneIds)
  const current = $selectedSessionIds.get()
  const next = current.filter(id => !gone.has(id))

  if (next.length !== current.length) {
    $selectedSessionIds.set(next)
  }

  const anchor = $selectionAnchor.get()

  if (anchor && gone.has(anchor.sessionId)) {
    $selectionAnchor.set(null)
  }
}

export interface BulkSessionActions {
  archive: (sessionIds: readonly string[]) => void
  remove: (sessionIds: readonly string[]) => void
}

// Registered by the wiring layer (same pattern as `$newSessionTabAction`): the
// row menu is four prop layers below the hook that owns these calls, and the
// bulk verbs act on the STORE's selection rather than on the row they were
// invoked from, so passing them down per row would be noise.
export const $bulkSessionActions = atom<BulkSessionActions | null>(null)

export function registerBulkSessionActions(actions: BulkSessionActions | null): void {
  $bulkSessionActions.set(actions)
}
