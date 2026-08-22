import { describe, expect, it } from 'vitest'

import { advanceTokenRate, IDLE_TOKEN_RATE, type TokenRateInput, type TokenRateState } from './token-rate'

const feed = (samples: TokenRateInput[], from: TokenRateState = IDLE_TOKEN_RATE) =>
  samples.reduce((state, sample) => advanceTokenRate(state, sample), from)

describe('advanceTokenRate', () => {
  it('reports nothing before a turn produces output', () => {
    expect(feed([{ busy: true, now: 1_000, output: 0, turnStartedAt: 1_000 }]).rate).toBeNull()
  })

  // The one-shot provider: counters move exactly once, and often only after the
  // turn is already marked done. A tick-to-tick window can never form, so the
  // turn average is the only honest number — and showing it beats showing
  // nothing, which is what a tick-only sampler did.
  it('reports a turn average from a single usage report', () => {
    const state = feed([
      { busy: true, now: 1_000, output: 0, turnStartedAt: 1_000 },
      { busy: false, now: 5_000, output: 200, turnStartedAt: null }
    ])

    // 200 tokens over the 4s the turn took.
    expect(state.rate).toBeCloseTo(50)
  })

  it('refines to the tick-to-tick rate once usage streams', () => {
    const state = feed([
      { busy: true, now: 0, output: 0, turnStartedAt: 0 },
      // First sighting 4s in (prompt processing): turn average is 10/4 ≈ 2.5.
      { busy: true, now: 4_000, output: 10, turnStartedAt: 0 },
      // Second sighting: 100 tokens in the 2s since — the real generation rate.
      { busy: true, now: 6_000, output: 110, turnStartedAt: 0 }
    ])

    expect(state.rate).toBeCloseTo(50)
  })

  // busy flipping false is an observation too, and it carries no new tokens —
  // so it must not stretch the window and walk the number down.
  it('does not re-measure when no new tokens arrived', () => {
    const running = feed([
      { busy: true, now: 0, output: 0, turnStartedAt: 0 },
      { busy: true, now: 1_000, output: 10, turnStartedAt: 0 },
      { busy: true, now: 3_000, output: 70, turnStartedAt: 0 }
    ])

    const later = feed(
      [
        { busy: false, now: 9_000, output: 70, turnStartedAt: null },
        { busy: false, now: 30_000, output: 70, turnStartedAt: null }
      ],
      running
    )

    expect(later.rate).toBeCloseTo(30)
  })

  it('ignores a window too small to trust', () => {
    const state = feed([
      { busy: true, now: 0, output: 5, turnStartedAt: 0 },
      { busy: true, now: 100, output: 60, turnStartedAt: 0 }
    ])

    expect(state.rate).toBeNull()
  })

  it('keeps the finished turn rate on screen while idle', () => {
    const running = feed([
      { busy: true, now: 0, output: 0, turnStartedAt: 0 },
      { busy: true, now: 1_000, output: 10, turnStartedAt: 0 },
      { busy: true, now: 3_000, output: 70, turnStartedAt: 0 }
    ])

    expect(running.rate).toBeCloseTo(30)
    expect(advanceTokenRate(running, { busy: false, now: 9_000, output: 70, turnStartedAt: null }).rate).toBeCloseTo(30)
  })

  it('measures the next turn on its own, not against the last one', () => {
    const afterFirst = feed([
      { busy: true, now: 0, output: 0, turnStartedAt: 0 },
      { busy: true, now: 1_000, output: 10, turnStartedAt: 0 },
      { busy: true, now: 3_000, output: 70, turnStartedAt: 0 },
      { busy: false, now: 4_000, output: 70, turnStartedAt: null }
    ])

    const second = feed(
      [
        { busy: true, now: 5_000, output: 70, turnStartedAt: 5_000 },
        { busy: true, now: 6_000, output: 170, turnStartedAt: 5_000 },
        { busy: true, now: 7_000, output: 270, turnStartedAt: 5_000 }
      ],
      afterFirst
    )

    expect(second.rate).toBeCloseTo(100)
  })

  it('re-baselines when the counters go backwards (session switch)', () => {
    const state = feed([
      { busy: true, now: 0, output: 0, turnStartedAt: 0 },
      { busy: true, now: 1_000, output: 500, turnStartedAt: 0 },
      { busy: true, now: 3_000, output: 12, turnStartedAt: 0 }
    ])

    expect(state.rate).toBeNull()
    expect(state.turnStartOutput).toBe(12)
    expect(state.lastOutput).toBe(12)
  })
})
