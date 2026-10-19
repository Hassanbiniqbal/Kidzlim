// Next's standalone server doesn't include `public/` or `.next/static/`; copy them in so the
// standalone build is complete on hosts that run it directly (Hostinger). Harmless in Docker.
import fs from 'fs'

const standalone = '.next/standalone'
if (fs.existsSync(standalone)) {
  fs.cpSync('public', `${standalone}/public`, { recursive: true })
  fs.cpSync('.next/static', `${standalone}/.next/static`, { recursive: true })
  console.log('[postbuild] copied public/ and .next/static into .next/standalone')
}
