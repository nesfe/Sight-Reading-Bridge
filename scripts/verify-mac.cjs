const { execFileSync } = require('node:child_process')
const { mkdtempSync, readdirSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

if (process.platform !== 'darwin') throw new Error('macOS verification requires a Mac')
const run = (file, args, options = {}) => execFileSync(file, args, { encoding: 'utf8', stdio: 'pipe', ...options })
const directory = mkdtempSync(path.join(tmpdir(), 'srb-installed-'))
const mount = path.join(directory, 'volume')
const app = path.join(directory, 'Sight Reading Bridge.app')
const binary = path.join(app, 'Contents/MacOS/Sight Reading Bridge')
let mounted = false
try {
  const dmg = readdirSync('release').find(file => file.endsWith(`-mac-${process.arch}.dmg`))
  if (!dmg) throw new Error(`No native DMG for ${process.arch}`)
  run('hdiutil', ['verify', path.resolve('release', dmg)])
  run('hdiutil', ['attach', path.resolve('release', dmg), '-readonly', '-nobrowse', '-mountpoint', mount])
  mounted = true
  run('ditto', [path.join(mount, 'Sight Reading Bridge.app'), app])
  run('hdiutil', ['detach', mount]); mounted = false
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' })
  const architecture = run('lipo', ['-archs', binary]).trim()
  const expected = process.arch === 'arm64' ? 'arm64' : 'x86_64'
  if (architecture !== expected) throw new Error(`Expected ${expected}, found ${architecture}`)
  run(process.execPath, ['tests/electron-smoke.cjs'], {
    env: { ...process.env, SRB_PACKAGED_EXECUTABLE: binary, SRB_EXPECT_ARCH: process.arch }, stdio: 'inherit', timeout: 180000,
  })
  console.log(`Verified DMG, installed signature and native ${architecture} launch on macOS ${run('sw_vers', ['-productVersion']).trim()}`)
} finally {
  if (mounted) run('hdiutil', ['detach', mount])
  rmSync(directory, { recursive: true, force: true })
}
