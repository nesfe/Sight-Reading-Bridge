const { spawnSync } = require('node:child_process')

const env = { ...process.env }
// An empty CSC_LINK is interpreted as the current directory, not as absent.
for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
  if (env[key]?.trim() === '') delete env[key]
}
const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), ...process.argv.slice(2)], { env, stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
