import { describe, expect, it } from 'vitest'

import { advanceTokenRate, IDLE_TOKEN_RATE, type TokenRateState } from './token-rate'

const feed = (samples: { busy: boolean; now: number; output: number }[], from: TokenRateState = IDLE_TOKEN_RATE) =>
  samples.reduce((state, sample) => advanceTokenRate(state, sample), from)

describe('advanceTokenRate', () => {
  it('reports nothing before a turn produces output', () => {
    expect(feed([{ busy: true, now: 1_000, output: 0 }]).rate).toBeNull()
  })

  it('measures from the first output tick, not from the turn start', () => {
    // Turn is busy for 4s before the first token, then 100 tokens over 2s.
    const state = feed([
      { busy: true, now: 0, output: 0 },
      { busy: true, now: 4_000, output: 10 },
      { busy: true, now: 6_000, output: 110 }
    ])

    // 100 tokens / 2s — the 4s of prompt processing is excluded, and the 10
    // tokens that arrived before the window opened are not counted either.
    expect(state.rate).toBeCloseTo(50)
  })

  it('holds its number until the window is wide enough to trust', () => {
    const state = feed([
      { busy: true, now: 0, output: 5 },
      { busy: true, now: 100, output: 60 }
    ])

    expect(state.rate).toBeNull()
  })

  it('keeps the finished turn rate after the turn ends', () => {
    const running = feed([
      { busy: true, now: 0, output: 0 },
      { busy: true, now: 1_000, output: 10 },
      { busy: true, now: 3_000, output: 70 }
    ])

    expect(running.rate).toBeCloseTo(30)

    const idle = advanceTokenRate(running, { busy: false, now: 4_000, output: 70 })
    expect(idle.rate).toBeCloseTo(30)
    expect(idle.startedAt).toBeNull()
  })

  it('measures the next turn on its own, not against the last one', () => {
    const afterFirst = feed([
      { busy: true, now: 0, output: 0 },
      { busy: true, now: 1_000, output: 10 },
      { busy: true, now: 3_000, output: 70 },
      { busy: false, now: 4_000, output: 70 }
    ])

    const second = feed(
      [
        { busy: true, now: 5_000, output: 80 },
        { busy: true, now: 7_000, output: 280 }
      ],
      afterFirst
    )

    expect(second.rate).toBeCloseTo(100)
  })

  it('re-baselines when the counters go backwards (session switch)', () => {
    const state = feed([
      { busy: true, now: 0, output: 0 },
      { busy: true, now: 1_000, output: 500 },
      { busy: true, now: 3_000, output: 12 }
    ])

    expect(state.rate).toBeNull()
    expect(state.startOutput).toBe(12)
  })
})
