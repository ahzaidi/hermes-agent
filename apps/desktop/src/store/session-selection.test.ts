import { beforeEach, describe, expect, it } from 'vitest'

import {
  $selectedSessionIds,
  clearSessionSelection,
  forgetSessionRowOrder,
  pruneSessionSelection,
  registerSessionRowOrder,
  selectSessionRange,
  toggleSessionSelection
} from './session-selection'

const ROWS = ['a', 'b', 'c', 'd', 'e']

describe('session selection', () => {
  beforeEach(() => {
    clearSessionSelection()
    forgetSessionRowOrder('other')
    registerSessionRowOrder('recents', ROWS)
  })

  it('toggles rows in and out', () => {
    toggleSessionSelection('recents', 'b')
    toggleSessionSelection('recents', 'd')
    expect($selectedSessionIds.get()).toEqual(['b', 'd'])

    toggleSessionSelection('recents', 'b')
    expect($selectedSessionIds.get()).toEqual(['d'])
  })

  it('selects a range from the anchor, in list order', () => {
    toggleSessionSelection('recents', 'b')
    selectSessionRange('recents', 'd')
    expect($selectedSessionIds.get()).toEqual(['b', 'c', 'd'])
  })

  it('ranges upwards too', () => {
    toggleSessionSelection('recents', 'd')
    selectSessionRange('recents', 'b')
    expect($selectedSessionIds.get()).toEqual(['b', 'c', 'd'])
  })

  it('re-ranges from the same anchor instead of walking it', () => {
    toggleSessionSelection('recents', 'b')
    selectSessionRange('recents', 'e')
    selectSessionRange('recents', 'c')
    expect($selectedSessionIds.get()).toEqual(['b', 'c'])
  })

  it('falls back to a single select when there is no anchor', () => {
    selectSessionRange('recents', 'c')
    expect($selectedSessionIds.get()).toEqual(['c'])

    // …and the fallback planted an anchor, so the next ⇧-click ranges.
    selectSessionRange('recents', 'e')
    expect($selectedSessionIds.get()).toEqual(['c', 'd', 'e'])
  })

  it('ignores an anchor left in another list', () => {
    registerSessionRowOrder('other', ['x', 'y'])
    toggleSessionSelection('other', 'x')
    selectSessionRange('recents', 'c')
    expect($selectedSessionIds.get()).toEqual(['c'])
  })

  it('drops a deselected row as the anchor', () => {
    toggleSessionSelection('recents', 'b')
    toggleSessionSelection('recents', 'b')
    selectSessionRange('recents', 'd')
    expect($selectedSessionIds.get()).toEqual(['d'])
  })

  it('prunes ids that have left the list', () => {
    toggleSessionSelection('recents', 'b')
    selectSessionRange('recents', 'd')
    pruneSessionSelection(['c'])
    expect($selectedSessionIds.get()).toEqual(['b', 'd'])
  })

  it('ranges over an unregistered scope as a single select', () => {
    toggleSessionSelection('lanes', 'q')
    selectSessionRange('lanes', 'r')
    expect($selectedSessionIds.get()).toEqual(['r'])
  })
})
