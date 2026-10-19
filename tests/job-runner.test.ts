import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { runFulfilmentJobs } from '@/lib/job-runner'

describe('fulfilment job runner', () => {
  it('never runs two job passes at once; extra requests become one follow-up pass', async () => {
    let active = 0
    let maxActive = 0
    let passes = 0
    const payload = {
      jobs: {
        run: async () => {
          active++
          passes++
          maxActive = Math.max(maxActive, active)
          await new Promise((r) => setTimeout(r, 20))
          active--
          return { noJobsRemaining: true }
        },
      },
      logger: { error: () => undefined },
    } as unknown as Payload

    // Four admin clicks / webhooks arriving together (the bug: four parallel runs, four emails).
    await Promise.all([runFulfilmentJobs(payload), runFulfilmentJobs(payload), runFulfilmentJobs(payload), runFulfilmentJobs(payload)])
    expect(maxActive).toBe(1)
    expect(passes).toBe(2)

    // Idle again: the next request starts a fresh pass.
    await runFulfilmentJobs(payload)
    expect(passes).toBe(3)
  })
})

describe('fulfilment job runner draining', () => {
  it('keeps passing while jobs remain (one job per order per pass), then stops', async () => {
    let queued = 3 // e.g. three re-sends queued for the same order
    let passes = 0
    const payload = {
      jobs: {
        run: async () => {
          passes++
          if (queued === 0) return { noJobsRemaining: true }
          queued--
          return { remainingJobsFromQueried: 0 }
        },
      },
      logger: { error: () => undefined },
    } as unknown as Payload
    await runFulfilmentJobs(payload)
    expect(queued).toBe(0)
    expect(passes).toBe(4)
  })
})
