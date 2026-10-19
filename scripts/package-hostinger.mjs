// Builds the two upload bundles for Hostinger Node.js hosting into ./deploy:
//   kidzlim-source.tar.gz  → hPanel → Node.js app → upload archive (Hostinger installs + builds it)
//   kidzlim-data.tar.gz    → extract into your persistent data folder (only if you ran seed:hostinger)
// Secrets (.env), local databases, uploads and build output are never included.
import { spawnSync } from 'child_process'
import fs from 'fs'

const EXCLUDE = [
  './node_modules', './.next', './data', './deploy', './media', './protected-media', './backups',
  './.git', './.env', './.env.local', './tsconfig.tsbuildinfo', './.claude', './test-results',
]

function tar(args) {
  // Windows ships bsdtar as tar.exe; Git Bash's GNU tar also works. Both understand these flags.
  const bin = process.platform === 'win32' ? 'C:/Windows/System32/tar.exe' : 'tar'
  const r = spawnSync(bin, args, { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`tar failed (${r.status}) ${r.error?.message ?? ''}`)
}

fs.mkdirSync('deploy', { recursive: true })
tar(['-czf', 'deploy/kidzlim-source.tar.gz', ...EXCLUDE.flatMap((e) => ['--exclude', e]), '.'])
console.log('✓ deploy/kidzlim-source.tar.gz')

if (fs.existsSync('deploy/data/kidzlim.db')) {
  tar(['-czf', 'deploy/kidzlim-data.tar.gz', '-C', 'deploy/data', '.'])
  console.log('✓ deploy/kidzlim-data.tar.gz (database + images + PDFs from seed:hostinger)')
} else {
  console.log('… no deploy/data yet — run `npm run seed:hostinger` first if you want to upload seeded content')
}
