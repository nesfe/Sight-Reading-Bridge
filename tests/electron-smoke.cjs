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
    if (process.env.SRB_EXPECT_ARCH) {
      expect(await app.evaluate(() => process.arch)).toBe(process.env.SRB_EXPECT_ARCH)
      expect(await app.evaluate(({ app }) => app.runningUnderARM64Translation)).not.toBe(true)
    }
    await page.getByRole('button', { name: 'Русский', exact: true }).click()
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
    if (process.platform === 'darwin') {
      await page.getByLabel('Настройки экрана', { exact: true }).click()
      await page.getByRole('switch').check()
      await page.getByLabel('Настройки экрана', { exact: true }).click()
    }
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Начать занятие' }).click()
    await expect(page.getByRole('heading', { name: 'Один звук, два направления' })).toBeVisible()
    await page.getByRole('button', { name: 'Пропустить вступление' }).click()
    await expect(page.locator('.run-score [data-note-step]')).toHaveCount(1)
    await mkdir('output/playwright', { recursive: true })
    await page.screenshot({ path: 'output/playwright/electron.png' })
    if (process.platform === 'darwin') {
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true)
      await expect(page.getByRole('button', { name: 'Выйти из полного экрана', exact: true })).toBeEnabled()
      await expect(page.locator('.pause-overlay')).toHaveCount(0)
      await page.getByRole('button', { name: 'Выйти из режима тренировки', exact: true }).click()
      await expect(page.getByRole('button', { name: 'На весь экран', exact: true })).toBeEnabled()
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false)
      await page.getByRole('button', { name: 'На весь экран', exact: true }).click()
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true)
      await expect(page.getByRole('button', { name: 'Выйти из полного экрана', exact: true })).toBeEnabled()
      await page.getByRole('button', { name: 'Выйти из полного экрана', exact: true }).click()
      await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false)
    } else {
      await page.getByRole('button', { name: 'Выйти из режима тренировки', exact: true }).click()
    }
    await expect(page.locator('.pause-overlay')).toBeVisible()
    await page.getByRole('button', { name: 'Библиотека', exact: true }).click()
    await page.getByLabel('Файл партитуры', { exact: true }).setInputFiles('tests/fixtures/piano.musicxml')
    await expect(page.locator('.imported-score svg')).toHaveCount(1)
    await expect(page.locator('.follow-position')).toHaveText('0 / 5')
    await page.screenshot({ path: 'output/playwright/electron-import.png' })
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('button', { name: 'Advanced course', exact: true }).click()
    await expect(page.locator('.course-piece-row')).toHaveCount(31)
    await page.locator('.course-piece-row').nth(8).click()
    await expect(page.locator('.repertoire-vertical .vf-notehead').first()).toBeVisible()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Start reading', exact: true }).click()
    // The click returns before macOS finishes its asynchronous fullscreen transition.
    await expect(page.locator('.following-toolbar [role=status]')).toHaveText('Waiting for a note')
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await page.locator('.repertoire-vertical [data-midi="72"]').focus()
    await page.keyboard.down('Enter')
    await page.locator('.repertoire-vertical [data-midi="60"]').press('Space')
    await page.locator('.repertoire-vertical [data-midi="72"]').focus()
    await page.keyboard.up('Enter')
    await expect(page.locator('.follow-position')).toHaveText(/^1 \//)
    await page.getByRole('radio', { name: 'Staff', exact: true }).click()
    await expect(page.locator('.imported-score svg').first()).toBeVisible()
    await page.screenshot({ path: 'output/playwright/electron-repertoire.png' })
    expect(errors).toEqual([])
    console.log('Electron: file://, isolation, Web MIDI, lesson, MusicXML and bundled Advanced course OK')
  } catch (error) {
    const page = app?.windows()[0]
    if (page && !page.isClosed()) {
      await mkdir('output/playwright', { recursive: true })
      await page.screenshot({ path: 'output/playwright/electron-failure.png' }).catch(() => {})
      console.error(await page.locator('body').innerText().catch(() => 'Unable to read renderer state'))
    }
    throw error
  } finally {
    await app?.close()
    await rm(profile, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
