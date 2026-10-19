// Production build that sizes itself to the machine it runs on.
//
// Shared build machines (Hostinger) report the host's CPUs and RAM, not the slice the build is
// allowed to use. Next then starts one worker per reported CPU with an 8 GB heap ceiling and the
// build thrashes until it hits the 15-minute limit. Here we read the container (cgroup) limits,
// cap the heap below the real memory and limit build workers accordingly.
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return null
  }
}

function memoryLimitBytes() {
  const v2 = read('/sys/fs/cgroup/memory.max') // cgroup v2: "max" or bytes
  const v1 = read('/sys/fs/cgroup/memory/memory.limit_in_bytes')
  const limits = [v2, v1].map(Number).filter((n) => Number.isFinite(n) && n > 0 && n < 2 ** 50)
  return Math.min(os.totalmem(), ...limits)
}

function cpuLimit() {
  const v2 = read('/sys/fs/cgroup/cpu.max') // "quota period" or "max period"
  if (v2 && !v2.startsWith('max')) {
    const [quota, period] = v2.split(/\s+/).map(Number)
    if (quota > 0 && period > 0) return Math.max(1, Math.floor(quota / period))
  }
  const q1 = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'))
  const p1 = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_period_us'))
  if (q1 > 0 && p1 > 0) return Math.max(1, Math.floor(q1 / p1))
  return os.availableParallelism?.() ?? os.cpus().length
}

const memMb = Math.floor(memoryLimitBytes() / 2 ** 20)
// A huge reported machine with no visible container limit is a shared host (Hostinger reported
// 64 CPUs / 500 GB): the real per-account limit is hidden, so assume a small slice.
const shared = os.cpus().length > 16 && memMb > 64 * 1024
const cpus = shared ? 1 : Math.max(1, Math.min(cpuLimit(), Number(process.env.BUILD_MAX_CPUS || 4)))
const heapMb =
  Number(process.env.BUILD_HEAP_MB) || (shared ? 2048 : Math.max(1024, Math.min(6144, Math.floor(memMb * 0.6))))
const workers = shared || memMb < 6000 ? 1 : Math.min(cpus, 2)
// Webpack by default: single-threaded JS whose memory the heap cap controls. Turbopack starts
// native threads for every reported CPU and stalled on Hostinger. BUILD_BUNDLER=turbopack to opt in.
const bundler = process.env.BUILD_BUNDLER === 'turbopack' ? 'turbopack' : 'webpack'
const threads = String(Math.max(1, Math.min(cpus, 2)))

console.log(
  `[build] machine: ${os.cpus().length} reported CPUs, limit ${cpuLimit()} · ${Math.round(os.totalmem() / 2 ** 20)} MB RAM, limit ${memMb} MB, free ${Math.round(os.freemem() / 2 ** 20)} MB`,
)
console.log(
  `[build] ${shared ? 'shared host detected — ' : ''}using ${bundler}, heap ${heapMb} MB, ${workers} worker(s), ${threads} native thread(s), Node ${process.version}`,
)

const started = Date.now()
const result = spawnSync('npx', ['next', 'build', `--${bundler}`], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: `--no-deprecation --max-old-space-size=${heapMb}`,
    NEXT_BUILD_WORKERS: String(workers),
    // Cap native thread pools (SWC/Turbopack use Rayon and Tokio; libuv for fs/zlib).
    RAYON_NUM_THREADS: threads,
    TOKIO_WORKER_THREADS: threads,
    UV_THREADPOOL_SIZE: '4',
    NEXT_TELEMETRY_DISABLED: '1',
  },
})
console.log(`[build] finished in ${Math.round((Date.now() - started) / 1000)}s with exit code ${result.status}`)
process.exit(result.status ?? 1)
