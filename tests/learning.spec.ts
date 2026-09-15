import { expect, test, type Page } from '@playwright/test'

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
  await mockMidi(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Начать занятие' })).toBeDisabled()
  expect(await page.evaluate(() => isSecureContext)).toBe(true)
  await page.screenshot({ path: 'output/playwright/course-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Подключить', exact: true }).click()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.locator('.run-position')).toHaveText('0 / 12')
  await page.waitForTimeout(500)
  await send(page, 0x90, 61); await send(page, 0x80, 61)
  await expect(page.getByRole('status')).toHaveText('Другая нота')
  await expect(page.locator('.run-position')).toHaveText('0 / 12')
  const first = await expectedMidi(page)
  await send(page, 0x90, first)
  await expect(page.locator(`[data-midi="${first}"].pressed`)).toBeVisible()
  await page.screenshot({ path: 'output/playwright/lesson-desktop.png' })
  await send(page, 0x80, first)
  await expect(page.locator('.run-position')).toHaveText('1 / 12')
  await page.getByRole('button', { name: 'Пауза', exact: true }).click()
  await send(page, 0x90, first); await send(page, 0x80, first)
  await expect(page.locator('.run-position')).toHaveText('1 / 12')
  await page.locator('.pause-overlay button').click()
  for (let i = 1; i < 12; i++) {
    await page.waitForTimeout(80)
    const note = await expectedMidi(page)
    await send(page, 0x90, note); await send(page, 0x80, note)
    await expect(page.locator('.run-position')).toHaveText(`${i + 1} / 12`)
  }
  await expect(page.getByRole('heading', { name: 'Занятие завершено' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { testMidi: { state: { bindings: number; calls: number } } }).testMidi.state)).toEqual({ bindings: 1, calls: 1 })
  await page.getByRole('button', { name: 'Прогресс', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('92%')
  await page.reload(); await page.getByRole('button', { name: 'Прогресс', exact: true }).click()
  await expect(page.locator('tbody')).toContainText('Завершено')
  expect(errors).toEqual([])
})

test('horizontal notation, mobile layout, disconnect/reconnect', async ({ page }) => {
  await mockMidi(page); await page.goto('/')
  await page.getByRole('button', { name: 'Подключить', exact: true }).click()
  await page.locator('.setup-fields select').selectOption('0')
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
