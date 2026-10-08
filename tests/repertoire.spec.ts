import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((event: { data: Uint8Array; timeStamp: number }) => void) | null = null
    const device = { id: 'course-usb', name: 'USB piano', state: 'connected', close: async () => {}, get onmidimessage() { return listener }, set onmidimessage(fn) { listener = fn } }
    const access = { inputs: new Map([[device.id, device]]), onstatechange: null as (() => void) | null }
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async () => access })
    Object.assign(window, { courseMidi: {
      send: (status: number, note: number) => listener?.({ data: new Uint8Array([status, note, 100]), timeStamp: performance.now() }),
      disconnect: () => { device.state = 'disconnected'; access.onstatechange?.() },
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced course', exact: true }).click()
})

async function send(page: Page, status: number, note: number) {
  await page.evaluate(({ status, note }) => (window as unknown as { courseMidi: { send: (status: number, note: number) => void } }).courseMidi.send(status, note), { status, note })
}

test('all 31 bundled pieces render in all three views, with a readable mobile catalogue', async ({ page }) => {
  test.setTimeout(180000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await expect(page.locator('.course-piece-row')).toHaveCount(31)
  await page.screenshot({ path: 'output/playwright/advanced-catalogue.png', fullPage: true })
  await page.getByLabel('Find a piece', { exact: true }).fill('Chopin')
  await expect(page.locator('.course-piece-row')).toHaveCount(1)
  await page.getByLabel('Find a piece', { exact: true }).fill('')
  await page.locator('.course-piece-row').first().click()
  for (let i = 0; i < 31; i++) {
    await expect(page.locator('.repertoire-vertical .vf-notehead').first()).toBeVisible()
    expect(await page.locator('.follow-position').textContent()).toMatch(/^0 \/ [1-9]\d*$/)
    await expect(page.locator('[role=alert]')).toHaveCount(0)
    if (i < 8) await expect(page.getByRole('radio', { name: 'Left hand', exact: true })).toBeDisabled()
    else {
      for (const hand of ['Left hand', 'Right hand', 'Both hands']) {
        await page.getByRole('radio', { name: hand, exact: true }).click()
        expect(await page.locator('.follow-position').textContent()).toMatch(/^0 \/ [1-9]\d*$/)
      }
    }
    await page.getByRole('radio', { name: 'Bands', exact: true }).click()
    await expect(page.locator('.imported-score svg').first()).toBeVisible()
    await page.getByRole('radio', { name: 'Staff', exact: true }).click()
    await expect(page.locator('.imported-score .vf-clef').first()).toBeVisible()
    if (i === 24) await page.screenshot({ path: 'output/playwright/advanced-standard.png' })
    if (i < 30) await page.getByRole('button', { name: 'Next piece', exact: true }).click()
  }
  await expect(page.getByRole('button', { name: 'Next piece', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Back to course', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/advanced-mobile.png', fullPage: true })
  await page.locator('.course-piece-row').first().click()
  await expect(page.locator('.repertoire-vertical .vf-notehead').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/advanced-piece-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})

test('actual glyphs align with keys; MIDI result survives view, language and app restart', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.locator('.course-piece-row').first().click()
  await expect(page.locator('.repertoire-vertical .vf-notehead').first()).toBeVisible()
  const geometry = await page.locator('.repertoire-vertical').evaluate(svg => {
    const head = svg.querySelector('.vf-notehead')!.getBoundingClientRect()
    const key = svg.querySelector('[data-midi="67"]')!.getBoundingClientRect()
    const a = svg.querySelector('[data-course-band="2"]')!, b = svg.querySelector('[data-course-band="4"]')!
    const width = Number(a.getAttribute('stroke-width'))
    return { alignment: Math.abs(head.x + head.width / 2 - key.x - key.width / 2), width, gap: Number(b.getAttribute('x1')) - Number(a.getAttribute('x1')) - width }
  })
  expect(geometry.alignment).toBeLessThan(0.5)
  expect(geometry.width).toBe(geometry.gap)
  await page.getByRole('button', { name: 'Connect MIDI', exact: true }).click()
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  await send(page, 0x90, 61); await send(page, 0x80, 61)
  await expect(page.locator('.follow-position')).toHaveText('0 / 42')
  await send(page, 0x90, 67)
  await expect(page.locator('.follow-position')).toHaveText('1 / 42')
  await expect(page.locator('.repertoire-vertical [data-midi="67"]')).toHaveClass(/pressed/)
  await page.getByRole('radio', { name: 'Staff', exact: true }).click()
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.locator('.follow-position')).toHaveText('1 / 42')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('radio', { name: 'Vertical bands', exact: true }).click()
  await expect(page.locator('.repertoire-vertical [data-midi="67"]')).toHaveClass(/pressed/)
  await send(page, 0x80, 67)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await send(page, 0x90, 67); await send(page, 0x80, 67)
  await expect(page.locator('.follow-position')).toHaveText('1 / 42')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  const xml = readFileSync('packages/repertoire/scores/trad-twinkle-twinkle.musicxml', 'utf8')
  const notes = await page.evaluate(xml => [...new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('note > pitch')].map(pitch =>
    12 * (Number(pitch.querySelector('octave')!.textContent) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[pitch.querySelector('step')!.textContent as 'C']) + Number(pitch.querySelector('alter')?.textContent ?? 0)), xml)
  expect(notes).toHaveLength(42)
  for (const note of notes.slice(1)) { await send(page, 0x90, note); await send(page, 0x80, note) }
  await expect(page.locator('.follow-position')).toHaveText('42 / 42')
  await expect(page.locator('.course-result')).toContainText('98%')
  await page.getByRole('button', { name: 'Back to course', exact: true }).click()
  await expect(page.locator('.course-total strong')).toHaveText('1 / 31')
  await page.reload(); await page.getByRole('button', { name: 'Advanced course', exact: true }).click()
  await expect(page.locator('.course-total strong')).toHaveText('1 / 31')
  expect(errors).toEqual([])
})

test('two-hand chords require both attacks; demo completion never earns MIDI credit', async ({ page }) => {
  await page.locator('.course-piece-row').nth(8).click()
  await expect(page.getByRole('radio', { name: 'Both hands', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Connect MIDI', exact: true }).click()
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  await send(page, 0x90, 72)
  await expect(page.locator('.follow-position')).toHaveText(/^0 \//)
  await send(page, 0x90, 60)
  await expect(page.locator('.follow-position')).toHaveText(/^1 \//)
  await page.getByRole('radio', { name: 'Left hand', exact: true }).click()
  await expect(page.locator('.follow-position')).toHaveText(/^0 \//)
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  await page.evaluate(() => (window as unknown as { courseMidi: { disconnect: () => void } }).courseMidi.disconnect())
  await expect(page.locator('.following-toolbar [role=status]')).toHaveText('Paused')
  await page.getByRole('button', { name: 'Back to course', exact: true }).click()
  await page.locator('.course-piece-row').first().click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  for (let i = 0; i < 42; i++) {
    const midi = await page.locator('.repertoire-vertical [data-pitches]').first().getAttribute('data-pitches')
    await page.locator(`.repertoire-vertical [data-midi="${midi}"]`).press('Enter')
    await expect(page.locator('.follow-position')).toHaveText(`${i + 1} / 42`)
  }
  await expect(page.locator('.course-result')).toContainText('Demo mode')
  await page.getByRole('radio', { name: 'Staff', exact: true }).click()
  await expect(page.locator('.repertoire-vertical')).toHaveAttribute('aria-label', 'On-screen keyboard')
  await page.getByRole('button', { name: 'Back to course', exact: true }).click()
  await expect(page.locator('.course-total strong')).toHaveText('0 / 31')
})
