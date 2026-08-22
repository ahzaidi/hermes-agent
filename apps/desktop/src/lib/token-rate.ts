// Output-token throughput ("tok/s") for the statusbar, derived from the usage
// numbers the gateway reports for a turn.
//
// The awkward part is that usage arrives in one of two very different shapes,
// and only the provider decides which:
//
//   - STREAMED: `session.usage` ticks land about once a second while the turn
//     runs (tui_gateway `_start_usage_ticker`). Here the honest measurement is
//     between ticks — it excludes prompt processing and tool time, so it
//     reports the rate the model actually generated at.
//   - ONE SHOT: the provider only reports usage when its request completes, so
//     the counters move exactly once — often after the turn is already marked
//     done (`message.complete` carries the authoritative usage, and some
//     runtimes never tick at all). A tick-to-tick window can never form.
//
// So this measures both ways and prefers the better one: the turn average
// (which includes latency, and therefore understates generation speed) is
// available from the FIRST observation, and each further tick refines the
// number to the tick-to-tick rate. That way a one-shot provider still shows a
// figure instead of showing nothing forever, which is what a tick-only
// implementation did.
//
// Counters are cumulative per session, so everything works on deltas and
// re-baselines when they move backwards (a session switch).

/** ms a window must cover before its rate is worth showing (tiny windows are noise). */
const MIN_WINDOW_MS = 400

export interface TokenRateState {
  /** The turn being measured, identified by its start timestamp. */
  turnStartedAt: null | number
  /** Cumulative output tokens when that turn began. */
  turnStartOutput: number
  /** When output was first seen growing during this turn. */
  firstTickAt: null | number
  /** Cumulative output tokens at that first sighting. */
  firstTickOutput: number
  /** Cumulative output tokens as of the previous observation. */
  lastOutput: number
  /** Tokens per second, or null when nothing measurable has happened yet. */
  rate: null | number
}

export const IDLE_TOKEN_RATE: TokenRateState = {
  firstTickAt: null,
  firstTickOutput: 0,
  lastOutput: 0,
  rate: null,
  turnStartedAt: null,
  turnStartOutput: 0
}

export interface TokenRateInput {
  busy: boolean
  /** Cumulative output tokens for the session (`$currentUsage.output`). */
  output: number
  /** Now, in ms. */
  now: number
  /** When the running turn started (`$turnStartedAt`), or null when idle. */
  turnStartedAt: null | number
}

/**
 * Fold one observation into the rate state. Pure, so the sampling rules are
 * testable without a running turn.
 *
 * While idle the last measured rate is KEPT, and the window stays open: the
 * final usage for a turn routinely lands after `busy` has already gone false,
 * and that late number is the only one a one-shot provider ever sends.
 */
export function advanceTokenRate(state: TokenRateState, { busy, now, output, turnStartedAt }: TokenRateInput): TokenRateState {
  // Counters only grow within a session; a drop means a different session (or a
  // reset), so nothing measured so far applies.
  if (output < state.lastOutput) {
    return { ...IDLE_TOKEN_RATE, lastOutput: output, turnStartOutput: output }
  }

  // A new turn: baseline against the tokens already spent, keep the previous
  // turn's rate on screen until this one produces something.
  if (busy && turnStartedAt != null && turnStartedAt !== state.turnStartedAt) {
    return {
      firstTickAt: null,
      firstTickOutput: output,
      lastOutput: output,
      rate: state.rate,
      turnStartedAt,
      turnStartOutput: output
    }
  }

  // Nothing new to measure. This guard is what keeps an idle re-render from
  // stretching the window: `busy` flipping false is itself an observation, and
  // dividing the same token count by an ever-growing elapsed time would walk
  // the displayed rate down towards zero after every turn.
  if (output === state.lastOutput) {
    return state
  }

  const produced = output - state.turnStartOutput

  if (produced <= 0 || state.turnStartedAt == null) {
    return state
  }

  // Second and later sightings: measure tick-to-tick, which is generation time
  // only. This is the number we want whenever the provider makes it available.
  if (state.firstTickAt != null) {
    const streamed = now - state.firstTickAt

    return streamed >= MIN_WINDOW_MS && output > state.firstTickOutput
      ? { ...state, lastOutput: output, rate: ((output - state.firstTickOutput) / streamed) * 1000 }
      : { ...state, lastOutput: output }
  }

  // First sighting: all we can measure is the turn average — it carries the
  // request's latency, so it reads low, but it is a real number and it is the
  // ONLY one available when usage is reported once per request.
  const turnElapsed = now - state.turnStartedAt

  return {
    ...state,
    firstTickAt: now,
    firstTickOutput: output,
    lastOutput: output,
    rate: turnElapsed >= MIN_WINDOW_MS ? (produced / turnElapsed) * 1000 : state.rate
  }
}
