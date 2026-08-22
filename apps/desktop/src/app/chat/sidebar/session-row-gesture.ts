// Which action a left-click on a sidebar session row triggers, given the
// modifier keys held. Kept as a pure resolver (separate from the row
// component) so the precedence — the part that's easy to get subtly wrong —
// is unit-testable without rendering the whole sidebar.

export type SessionRowClickAction = 'archive' | 'resume' | 'selectRange' | 'selectToggle'

export interface SessionRowClickModifiers {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

/**
 * Resolve the click action from its modifiers.
 *
 * ⇧ and ⌘/⌃ are the file-manager selection gestures (range and toggle): they
 * feed the sidebar's multi-select, which the row's ⋯ and right-click menus then
 * act on in bulk. They used to mean pin and open-in-new-tab; both verbs are
 * still one right-click away, and middle-click still opens a new tab.
 *
 * Precedence matters: ⌥+⇧ (archive) MUST be checked before the single-modifier
 * gestures, because it sets `shiftKey` too — testing `shiftKey` first would
 * swallow it into "select a range".
 */
export function resolveSessionRowClick({
  altKey,
  ctrlKey,
  metaKey,
  shiftKey
}: SessionRowClickModifiers): SessionRowClickAction {
  if (altKey && shiftKey) {
    return 'archive'
  }

  if (shiftKey) {
    return 'selectRange'
  }

  if (metaKey || ctrlKey) {
    return 'selectToggle'
  }

  return 'resume'
}
