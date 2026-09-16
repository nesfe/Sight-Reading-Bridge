import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

async function mockMidi(page: Page) {
  await page.addInitScript(() => {
    let listener: ((event: { data: Uint8Array; timeStamp: number }) => void) | null = null
    const state = { bindings: 0, calls: 0 }
    const device = { id: 'usb-kawai', name: 'Kawai CA701 USB', state: 'connected', close: async () => {}, get onmidimessage() { return listener }, set onmidimessage(fn) { if (fn) state.bindings++; listener = fn } }
    const access = { inputs: new Map([[device.id, device]]), onstatechange: null as (() => void) | null }
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async () => { state.calls++; return access } })
    Object.assign(window, { testMidi: { state, send: (status: number, note: number, velocity = 100) => listener?.({ data: new Uint8Array([status, note, velocity]), timeStamp: performance.now() }), disconnect: () => { device.state = 'disconnected'; access.onstatechange?.() }, reconnect: () => { device.state = 'connected'; access.onstatechange?.() } } })
  })
}
async function send(page: Page, status: number, note: number) { await page.evaluate(({ status, note }) => { (window as unknown as { testMidi: { send: (status: number, note: number) => void } }).testMidi.send(status, note) }, { status, note }) }
async function expectedMidi(page: Page) {
  const step = Number(await page.locator('.run-score [data-note-step]').first().getAttribute('data-note-step'))
  const normalized = ((step % 7) + 7) % 7
  return (5 + Math.floor(step / 7)) * 12 + [0, 2, 4, 5, 7, 9, 11][normalized]
}
test('secure-context lesson flow: MIDI errors, pause, completion, persistence, one subscription', async ({ page }) => {
  test.setTimeout(90000)
  await mockMidi(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Начать занятие' })).toBeDisabled()
  expect(await page.evaluate(() => isSecureContext)).toBe(true)
  await page.screenshot({ path: 'output/playwright/course-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Подключить', exact: true }).click()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await page.waitForTimeout(500)
  await send(page, 0x90, 61); await send(page, 0x80, 61)
  await expect(page.getByRole('status')).toHaveText('Другая нота')
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  const first = await expectedMidi(page)
  await send(page, 0x90, first)
  await expect(page.locator(`[data-midi="${first}"].pressed`)).toBeVisible()
  await page.screenshot({ path: 'output/playwright/lesson-desktop.png' })
  await send(page, 0x80, first)
  await expect(page.locator('.run-position')).toHaveText('1 / 115')
  await page.getByRole('button', { name: 'Пауза', exact: true }).click()
  await send(page, 0x90, first); await send(page, 0x80, first)
  await expect(page.locator('.run-position')).toHaveText('1 / 115')
  await page.locator('.pause-overlay button').click()
  for (let i = 1; i < 115; i++) {
    if ([28, 52, 94].includes(i)) {
      await expect(page.locator('.block-break')).toBeVisible()
      await send(page, 0x90, 60); await send(page, 0x80, 60)
      await expect(page.locator('.run-position')).toHaveText(`${i} / 115`)
      if (i === 28) await page.screenshot({ path: 'output/playwright/recognition-block-break.png' })
      await page.getByRole('button', { name: 'Следующий блок', exact: true }).click()
    }
    await page.waitForTimeout(80)
    const note = await expectedMidi(page)
    await send(page, 0x90, note); await send(page, 0x80, note)
    await expect(page.locator('.run-position')).toHaveText(`${i + 1} / 115`)
  }
  await expect(page.getByRole('heading', { name: 'Занятие завершено' })).toBeVisible()
  await expect(page.locator('.pitch-results tbody tr')).toHaveCount(7)
  await expect(page.locator('.pitch-results tbody tr').first()).toContainText('14 / 15')
  await page.screenshot({ path: 'output/playwright/recognition-results.png', fullPage: true })
  expect(await page.evaluate(() => (window as unknown as { testMidi: { state: { bindings: number; calls: number } } }).testMidi.state)).toEqual({ bindings: 1, calls: 1 })
  await page.getByRole('button', { name: 'Прогресс', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('99%')
  await page.reload(); await page.getByRole('button', { name: 'Прогресс', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('Завершено')
  expect(errors).toEqual([])
})

test('horizontal notation, mobile layout, disconnect/reconnect', async ({ page }) => {
  await mockMidi(page); await page.goto('/')
  await page.getByRole('button', { name: 'Подключить', exact: true }).click()
  await page.getByRole('radio', { name: '2 Горизонтальные полосы' }).click()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.locator('.standard-score .vf-clef')).toHaveCount(2)
  await page.screenshot({ path: 'output/playwright/horizontal-desktop.png' })
  await page.evaluate(() => (window as unknown as { testMidi: { disconnect: () => void } }).testMidi.disconnect())
  await expect(page.locator('.pause-overlay')).toBeVisible()
  await page.evaluate(() => (window as unknown as { testMidi: { reconnect: () => void } }).testMidi.reconnect())
  await page.locator('.pause-overlay button').click()
  await expect(page.locator('.pause-overlay')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'output/playwright/horizontal-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('ahead reading curtain hides the note before onset, animation moves, skips count', async ({ page }) => {
  await page.goto('/')
  await page.locator('.lesson-row').filter({ hasText: 'На одну ноту вперёд' }).click()
  await page.locator('.setup-fields input[type=number]').fill('120')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  const note = page.locator('.run-score [data-note-index="0"]')
  const before = await note.getAttribute('transform')
  await page.waitForTimeout(600)
  expect(await note.getAttribute('transform')).not.toBe(before)
  await expect(note).toBeHidden({ timeout: 3000 })
  await expect(page.getByRole('heading', { name: 'Занятие завершено' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.stats')).toContainText('0 / 16')
})

test('MusicXML library preserves polyphony, spelling, ties and local MIDI following', async ({ page }) => {
  await mockMidi(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const external: string[] = []
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:')) external.push(request.url()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Библиотека', exact: true }).click()
  await page.getByLabel('Файл партитуры', { exact: true }).setInputFiles('tests/fixtures/piano.musicxml')
  await expect(page.locator('.imported-score svg')).toHaveCount(1)
  await expect(page.locator('.follow-position')).toHaveText('0 / 5')
  await expect(page.locator('.imported-score .vf-clef')).toHaveCount(2)
  await page.getByRole('button', { name: 'Подключить MIDI', exact: true }).click()
  await page.getByRole('button', { name: 'Начать чтение', exact: true }).click()
  await page.locator('.imported-score svg').evaluate(svg => svg.setAttribute('data-original-render', 'yes'))
  await send(page, 0x90, 61); await send(page, 0x80, 61)
  await expect(page.locator('.following-toolbar [role=status]')).toHaveText('Другая нота')
  await send(page, 0x90, 60); await send(page, 0x80, 60)
  await send(page, 0x90, 64); await send(page, 0x90, 48)
  await expect(page.locator('.follow-position')).toHaveText('0 / 5')
  await send(page, 0x90, 60)
  await expect(page.locator('.follow-position')).toHaveText('1 / 5')
  for (const pitch of [48, 60, 64]) await send(page, 0x80, pitch)
  for (const [index, pitch] of [66, 70, 43, 72].entries()) {
    await send(page, 0x90, pitch); await send(page, 0x80, pitch)
    await expect(page.locator('.follow-position')).toHaveText(`${index + 2} / 5`)
  }
  await expect(page.locator('.following-toolbar [role=status]')).toHaveText('Партитура пройдена')
  await expect(page.locator('.imported-score svg')).toHaveAttribute('data-original-render', 'yes')
  await expect(page.locator('.score-following .session-footer')).toContainText('Ошибки: 1')
  await page.getByRole('radio', { name: 'Полосы', exact: true }).click()
  await page.screenshot({ path: 'output/playwright/import-bands-desktop.png' })
  await page.getByRole('combobox', { name: 'Нотный стан', exact: true }).selectOption('1')
  await expect(page.locator('.follow-position')).toHaveText('0 / 4')
  await page.getByRole('button', { name: 'Начать чтение', exact: true }).click()
  await page.evaluate(() => (window as unknown as { testMidi: { disconnect: () => void } }).testMidi.disconnect())
  await expect(page.locator('.following-toolbar [role=status]')).toHaveText('Пауза')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'output/playwright/import-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload(); await page.getByRole('button', { name: 'Библиотека', exact: true }).click()
  await expect(page.locator('.score-list-row')).toHaveCount(1)
  await page.locator('.score-open').click()
  await expect(page.locator('.imported-score svg')).toHaveCount(1)
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('MXL manifest root, duplicate import, bad XML recovery and deletion', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Библиотека', exact: true }).click()
  const input = page.getByLabel('Файл партитуры', { exact: true })
  for (const xml of ['<broken>', '<html/>', '<score-timewise/>', '<!DOCTYPE score-partwise [<!ENTITY bomb "bad">]><score-partwise/>']) {
    await input.setInputFiles({ name: 'bad.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) })
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('.score-list-row')).toHaveCount(0)
  }
  const zip = zipSync({
    'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="Scores/main" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>'),
    'cover.xml': strToU8('<not-a-score/>'),
    'Scores/main': readFileSync('tests/fixtures/piano.musicxml'),
  })
  await input.setInputFiles({ name: 'piano.mxl', mimeType: 'application/vnd.recordare.musicxml', buffer: Buffer.from(zip) })
  await expect(page.locator('.imported-score svg')).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await input.setInputFiles('tests/fixtures/piano.musicxml')
  await page.getByRole('button', { name: 'К библиотеке', exact: true }).click()
  await expect(page.locator('.score-list-row')).toHaveCount(1)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Удалить Bridge - import study', exact: true }).click()
  await expect(page.locator('.score-list-row')).toHaveCount(0)
})

test('C4 has a local ledger and equal bands survive the horizontal transition', async ({ page }) => {
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto)
    Object.defineProperty(crypto, 'getRandomValues', { value: (array: Uint32Array) => array instanceof Uint32Array && array.length === 1 ? (array[0] = 12, array) : original(array) })
  })
  await page.goto('/')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  const ledger = page.locator('[data-ledger-step="0"]')
  await expect(ledger).toHaveCount(1)
  await expect(page.locator('.run-score [data-note-step="0"]')).toHaveCount(1)
  const geometry = await page.locator('.run-score svg').evaluate(svg => {
    const line = svg.querySelector('[data-staff-step="2"]')!, next = svg.querySelector('[data-staff-step="4"]')!
    const ledger = svg.querySelector('[data-ledger-step="0"]')!, note = svg.querySelector('[data-note-step="0"]')!, key = svg.querySelector('[data-midi="60"]')!
    const width = parseFloat(getComputedStyle(line).strokeWidth)
    return { width, gap: Number(next.getAttribute('x1')) - Number(line.getAttribute('x1')) - width, key: Number(key.getAttribute('width')), ledgerWidth: parseFloat(getComputedStyle(ledger).strokeWidth), aligned: ledger.getAttribute('x1') === note.getAttribute('cx'), below: Number(ledger.getAttribute('y1')) < -Number(note.getAttribute('ry')), above: Number(ledger.getAttribute('y2')) > Number(note.getAttribute('ry')) }
  })
  expect(geometry).toEqual({ width: 36, gap: 36, key: 36, ledgerWidth: 1.6, aligned: true, below: true, above: true })
  await page.screenshot({ path: 'output/playwright/middle-c-vertical.png' })
  await page.getByRole('button', { name: 'К занятиям', exact: true }).click()
  await page.getByRole('radio', { name: '2 Горизонтальные полосы' }).click()
  await expect(page.locator('.standard-score .vf-clef')).toHaveCount(2)
  await page.screenshot({ path: 'output/playwright/progression-horizontal.png' })
  await page.getByRole('radio', { name: '3 Обычный нотный стан' }).click()
  await expect(page.getByRole('radio', { name: '3 Обычный нотный стан' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.standard-score .vf-clef')).toHaveCount(2)
  await page.screenshot({ path: 'output/playwright/progression-standard.png' })
})
