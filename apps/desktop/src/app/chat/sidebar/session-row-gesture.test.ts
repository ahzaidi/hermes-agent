import { describe, expect, it } from 'vitest'

import { resolveSessionRowClick } from './session-row-gesture'

const NO_MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }

describe('resolveSessionRowClick', () => {
  it('resumes on a plain click', () => {
    expect(resolveSessionRowClick(NO_MODS)).toBe('resume')
  })

  it('extends the selection on ⇧-click', () => {
    expect(resolveSessionRowClick({ ...NO_MODS, shiftKey: true })).toBe('selectRange')
  })

  it('toggles one row on ⌘/⌃-click', () => {
    expect(resolveSessionRowClick({ ...NO_MODS, metaKey: true })).toBe('selectToggle')
    expect(resolveSessionRowClick({ ...NO_MODS, ctrlKey: true })).toBe('selectToggle')
  })

  // ⌘/⌃+⇧ is Explorer's "extend with toggle"; we have no such verb, so the
  // range wins rather than the toggle — the gesture stays additive-ish instead
  // of collapsing the selection to one row.
  it('ranges on ⌘/⌃+⇧-click', () => {
    expect(resolveSessionRowClick({ ...NO_MODS, metaKey: true, shiftKey: true })).toBe('selectRange')
    expect(resolveSessionRowClick({ ...NO_MODS, ctrlKey: true, shiftKey: true })).toBe('selectRange')
  })

  // The regression this whole module guards: ⌥+⇧ sets shiftKey too, so a naive
  // "check shiftKey first" would swallow archive into a range select.
  it('archives on ⌥+⇧-click', () => {
    expect(resolveSessionRowClick({ ...NO_MODS, altKey: true, shiftKey: true })).toBe('archive')
  })

  it('does not archive on ⌥-click alone', () => {
    expect(resolveSessionRowClick({ ...NO_MODS, altKey: true })).toBe('resume')
  })
})
