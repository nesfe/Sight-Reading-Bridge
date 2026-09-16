const { _electron: electron, expect } = require('@playwright/test')
const { mkdtemp, rm, mkdir } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { version } = require('../package.json')

async function main() {
  const profile = await mkdtemp(path.join(tmpdir(), 'srb-smoke-'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  try {
    const executablePath = process.env.SRB_PACKAGED_EXECUTABLE
    app = await electron.launch({ executablePath, args: [...(executablePath ? [] : ['.']), `--user-data-dir=${profile}`], env })
    const page = await app.firstWindow()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await expect(page.getByRole('heading', { name: 'Занятия', exact: true })).toBeVisible()
    expect(page.url().startsWith('file://')).toBe(true)
    expect(await page.evaluate(() => typeof window.require)).toBe('undefined')
    expect(await page.evaluate(() => window.sightReadingBridge.getVersion())).toBe(version)
    expect(await page.evaluate(() => typeof navigator.requestMIDIAccess)).toBe('function')
    await page.getByRole('button', { name: 'Подключить', exact: true }).click()
    const access = await page.evaluate(async () => {
      const midi = await navigator.requestMIDIAccess({ sysex: false })
      return { sysex: midi.sysexEnabled, names: [...midi.inputs.values()].map(input => input.name) }
    })
    expect(access.sysex).toBe(false)
    if (access.names.length) await expect(page.getByRole('button', { name: 'Начать занятие' })).toBeEnabled()
    else await expect(page.locator('.connection-strip')).toContainText('USB-MIDI устройство не найдено')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Начать занятие' }).click()
    await expect(page.locator('.run-score [data-note-step]')).toHaveCount(1)
    await mkdir('output/playwright', { recursive: true })
    await page.screenshot({ path: 'output/playwright/electron.png' })
    await page.getByRole('button', { name: 'Библиотека', exact: true }).click()
    await page.getByLabel('Файл партитуры', { exact: true }).setInputFiles('tests/fixtures/piano.musicxml')
    await expect(page.locator('.imported-score svg')).toHaveCount(1)
    await expect(page.locator('.follow-position')).toHaveText('0 / 5')
    await page.screenshot({ path: 'output/playwright/electron-import.png' })
    expect(errors).toEqual([])
    console.log('Electron: file:// renderer, isolated preload, Web MIDI, static lesson and MusicXML import OK')
  } finally {
    await app?.close()
    await rm(profile, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
