/**
 * Runs once when the Next.js server starts. Initialises Payload and starts the fulfilment job
 * scheduler so retries run even before the first request arrives.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.JOBS_AUTORUN === '0') return
  try {
    const [{ getPayload }, { default: config }, { startJobScheduler }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
      import('@/lib/job-runner'),
    ])
    startJobScheduler(await getPayload({ config }))
  } catch (err) {
    // Don't crash the web server if the DB isn't reachable yet; the first request retries init.
    console.error('[instrumentation] Payload init with job runner failed', err)
  }
}
