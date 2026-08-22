// Output-token throughput ("tok/s") for the statusbar, derived from the live
// `session.usage` ticks the gateway emits mid-turn.
//
// Two decisions worth stating, because both change the number a lot:
//
//   - The clock starts at the FIRST usage tick that carries new output, not at
//     the turn's start. Prompt processing, queueing and tool time are not
//     generation; counting them reports a rate the model never ran at, and on a
//     long prompt it halves the figure.
//   - The window is the whole turn, not a short trailing average. A rate that
//     jitters every tick is unreadable in a 12px statusbar slot; a turn average
//     settles within a second or two and stays legible.
//
// The counters are cumulative per session, so everything here works on deltas
// and re-baselines when they move backwards (a session switch).

/** ms the window must cover before a rate is worth showing (early ticks are noise). */
const MIN_WINDOW_MS = 750

export interface TokenRateState {
  /** When the current measurement window opened; null while idle/unarmed. */
  startedAt: null | number
  /** Cumulative output tokens at the window's start. */
  startOutput: number
  /** Tokens per second, or null when nothing measurable has happened yet. */
  rate: null | number
}

export const IDLE_TOKEN_RATE: TokenRateState = { rate: null, startOutput: 0, startedAt: null }

export interface TokenRateInput {
  busy: boolean
  /** Cumulative output tokens for the session (`$currentUsage.output`). */
  output: number
  /** Now, in ms. */
  now: number
}

/**
 * Fold one observation into the rate state. Pure so the sampling rules are
 * testable without a running turn.
 *
 * While idle the last measured rate is KEPT: the number a user wants after a
 * reply lands is how fast that reply came, and blanking it the instant the turn
 * ends means it can never be read.
 */
export function advanceTokenRate(state: TokenRateState, { busy, now, output }: TokenRateInput): TokenRateState {
  // Counters only grow within a session; a drop means we're looking at a
  // different session (or a reset), so nothing measured so far applies.
  if (output < state.startOutput) {
    return { rate: null, startOutput: output, startedAt: null }
  }

  if (!busy) {
    return { rate: state.rate, startOutput: output, startedAt: null }
  }

  const produced = output - state.startOutput

  if (state.startedAt == null) {
    // Arm on the first tick carrying output, and re-baseline to it: those
    // tokens arrived over an unknown span before this sample, so counting them
    // against a window that starts now would overstate the rate.
    return produced > 0 ? { rate: null, startOutput: output, startedAt: now } : { ...state, rate: null }
  }

  const elapsed = now - state.startedAt

  return {
    rate: elapsed >= MIN_WINDOW_MS ? (produced / elapsed) * 1000 : state.rate,
    startOutput: state.startOutput,
    startedAt: state.startedAt
  }
}
