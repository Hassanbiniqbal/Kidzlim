import type { Payload } from 'payload'

import { FULFILMENT_QUEUE } from '../jobs/fulfilment'

/**
 * The only way fulfilment jobs are run. Payload claims jobs with a find-then-update that isn't
 * atomic, so two overlapping `payload.jobs.run` calls can pick up the same job — in testing,
 * four admin clicks sent the buyer four download emails. Here at most one run is in flight per
 * process; a request that arrives meanwhile schedules one more pass instead of a parallel run.
 * (Single app process — see order-write.ts.)
 */
type RunnerState = { running: Promise<void> | null; again: boolean; timer: ReturnType<typeof setInterval> | null }

// On globalThis so dev hot-reloads don't create a second runner.
const state: RunnerState = ((globalThis as { __kidzlimJobRunner?: RunnerState }).__kidzlimJobRunner ??= {
  running: null,
  again: false,
  timer: null,
})

// Payload runs one job per order per pass, so several queued jobs for one order need several passes.
const MAX_PASSES = 10

export function runFulfilmentJobs(payload: Payload): Promise<void> {
  if (state.running) {
    state.again = true
    return state.running
  }
  state.running = (async () => {
    try {
      let passes = 0
      let more: boolean
      do {
        state.again = false
        const result = await payload.jobs.run({ queue: FULFILMENT_QUEUE, limit: 20 })
        // Keep going while passes still find runnable jobs (failed ones wait for their backoff).
        more = state.again || result?.noJobsRemaining !== true
      } while (more && ++passes < MAX_PASSES)
    } catch (err) {
      payload.logger.error({ err, msg: '[jobs] fulfilment run failed' })
    } finally {
      state.running = null
    }
  })()
  return state.running
}

/** Every minute: retries with backoff and anything a request didn't finish. Idempotent. */
export function startJobScheduler(payload: Payload): void {
  if (state.timer || process.env.JOBS_AUTORUN === '0') return
  state.timer = setInterval(() => void runFulfilmentJobs(payload), 60_000)
  state.timer.unref?.()
  void runFulfilmentJobs(payload) // pick up anything left over from before a restart
}
