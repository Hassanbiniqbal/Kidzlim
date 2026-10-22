// PM2 process file for a VPS (CloudPanel Node.js site). Runs Next's standalone server built by
// `npm run build`. Secrets come from an env file OUTSIDE the project folder (default
// ~/kidzlim.env, override with KIDZLIM_ENV_FILE). See VPS.md.
const path = require('path')
const os = require('os')

const envFile = process.env.KIDZLIM_ENV_FILE || path.join(os.homedir(), 'kidzlim.env')

module.exports = {
  apps: [
    {
      name: 'kidzlim',
      cwd: path.join(__dirname, '.next', 'standalone'),
      script: 'server.js',
      // Node 20.6+ loads the env file itself; values set below take precedence.
      node_args: `--env-file=${envFile}`,
      env: {
        NODE_ENV: 'production',
        // Must match the "App Port" of the CloudPanel Node.js site.
        PORT: process.env.APP_PORT || '3000',
        // Only Nginx on this machine may reach the app.
        HOSTNAME: '127.0.0.1',
      },
      // Exactly one process: order writes and the job runner are coordinated in-process.
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      time: true,
    },
  ],
}
