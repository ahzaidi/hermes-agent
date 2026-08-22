import { beforeEach, describe, expect, it } from 'vitest'

import { $pinnedSessionIds, dropSessionPins, restoreSessionPins } from './layout'

beforeEach(() => {
  $pinnedSessionIds.set([])
})

describe('dropSessionPins', () => {
  it('drops every named pin in one write and reports where each sat', () => {
    $pinnedSessionIds.set(['a', 'b', 'c', 'd'])

    expect(dropSessionPins(['b', 'd'])).toEqual([
      ['b', 1],
      ['d', 3]
    ])
    expect($pinnedSessionIds.get()).toEqual(['a', 'c'])
  })

  it('ignores blank and unpinned ids without touching the list', () => {
    $pinnedSessionIds.set(['a'])

    expect(dropSessionPins([null, undefined, '  ', 'stranger'])).toEqual([])
    expect($pinnedSessionIds.get()).toEqual(['a'])
  })

  it('collapses a stored id and its lineage-root pin id to one removal each', () => {
    // archiveSession passes both, because a compressed session's pin is keyed on
    // the lineage root while the row carries the live tip.
    $pinnedSessionIds.set(['root', 'other'])

    expect(dropSessionPins(['tip', 'root'])).toEqual([['root', 0]])
    expect($pinnedSessionIds.get()).toEqual(['other'])
  })
})

describe('restoreSessionPins', () => {
  it('puts a rolled-back pin back at the index it held', () => {
    $pinnedSessionIds.set(['a', 'b', 'c'])
    const dropped = dropSessionPins(['b'])

    restoreSessionPins(dropped)

    expect($pinnedSessionIds.get()).toEqual(['a', 'b', 'c'])
  })

  it('does not resurrect a sibling row un-pinned while its RPC was in flight', () => {
    // The whole point of the read-modify-write pair: two bulk rows overlap, the
    // first fails and rolls back, and the second's un-pin must survive it. The
    // old snapshot-restore wrote back the pre-await list and undid both.
    $pinnedSessionIds.set(['keep', 'fails', 'succeeds'])

    const failing = dropSessionPins(['fails'])

    dropSessionPins(['succeeds'])
    restoreSessionPins(failing)

    expect($pinnedSessionIds.get()).toEqual(['keep', 'fails'])
  })

  it('clamps to the end when a concurrent row shortened the list', () => {
    $pinnedSessionIds.set(['a', 'b', 'c'])
    const failing = dropSessionPins(['c'])

    dropSessionPins(['a'])
    restoreSessionPins(failing)

    expect($pinnedSessionIds.get()).toEqual(['b', 'c'])
  })

  it('is a no-op for an empty rollback', () => {
    $pinnedSessionIds.set(['a'])
    restoreSessionPins([])

    expect($pinnedSessionIds.get()).toEqual(['a'])
  })
})
