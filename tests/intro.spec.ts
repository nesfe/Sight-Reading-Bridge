import { expect, test } from '@playwright/test'

test.use({ locale: 'en-US' })

test('first-lesson introduction connects notes to keys and starts an untouched lesson', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'One pitch, two directions' })).toBeVisible()
  await expect(page.locator('.run-position')).toHaveCount(0)
  await page.screenshot({ path: 'output/playwright/intro-horizontal.png' })
  await page.getByRole('button', { name: 'Turn the staff', exact: true }).click()
  await expect.poll(() => page.locator('[data-intro-staff]').evaluate((group: SVGGElement) => Math.abs(group.getCTM()!.b))).toBeLessThan(0.001)
  for (const note of [60, 62, 64]) await page.getByRole('button', { name: `MIDI key ${note}`, exact: true }).click()
  await expect(page.locator('.intro-targets .complete')).toHaveCount(3)
  await expect(page.locator('[data-intro-note]')).toHaveAttribute('data-intro-note', '2')
  const alignment = await page.locator('.intro-diagram').evaluate((svg: SVGSVGElement) => {
    const note = svg.querySelector('[data-intro-note]') as SVGEllipseElement
    const key = svg.querySelector('[data-midi="64"]') as SVGRectElement
    const line = svg.querySelector('[data-intro-line="2"]') as SVGLineElement
    const notePoint = new DOMPoint(note.cx.baseVal.value, note.cy.baseVal.value).matrixTransform(note.getScreenCTM()!)
    const keyPoint = new DOMPoint(key.x.baseVal.value + key.width.baseVal.value / 2, key.y.baseVal.value).matrixTransform(key.getScreenCTM()!)
    return { delta: Math.abs(notePoint.x - keyPoint.x), band: parseFloat(getComputedStyle(line).strokeWidth), key: key.width.baseVal.value * 2 / 3 }
  })
  expect(alignment.delta).toBeLessThan(0.5)
  expect(alignment.band).toBe(alignment.key)
  await page.screenshot({ path: 'output/playwright/intro-vertical.png' })
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Поворот связывает ноту с клавишей' })).toBeVisible()
  await expect(page.locator('.intro-targets .complete')).toHaveCount(3)
  await page.getByRole('button', { name: 'К обычной записи', exact: true }).click()
  await page.getByRole('radio', { name: '3. Обычный нотный стан', exact: true }).click()
  await expect(page.locator('[data-intro-note]')).toHaveAttribute('data-intro-note', '2')
  await page.getByRole('button', { name: 'К первому занятию', exact: true }).click()
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await expect(page.getByRole('status')).toHaveText('Ожидание нажатия')
  await page.reload()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие', exact: true }).click()
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await expect(page.locator('.staff-intro')).toHaveCount(0)
})

test('introduction can be explored without MIDI, skipped, and reopened on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Why is the staff turned?', exact: true }).click()
  await page.getByRole('button', { name: 'Turn the staff', exact: true }).click()
  expect(await page.locator('[data-intro-staff]').evaluate(group => getComputedStyle(group).transitionDuration)).toBe('0s')
  await page.screenshot({ path: 'output/playwright/intro-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('group', { name: 'Language / Язык' })).toBeInViewport()
  await page.getByRole('button', { name: 'Skip introduction', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start lesson', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No completed lessons yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Lessons', exact: true }).click()
  await page.getByRole('button', { name: 'Why is the staff turned?', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'One pitch, two directions' })).toBeVisible()
})

test('USB MIDI works in the introduction without leaking notes into the lesson', async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((event: { data: Uint8Array; timeStamp: number }) => void) | null = null
    let bindings = 0
    const device = { id: 'intro-piano', name: 'USB Piano', state: 'connected', close: async () => {}, get onmidimessage() { return listener }, set onmidimessage(fn) { if (fn) bindings++; listener = fn } }
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: async () => ({ inputs: new Map([[device.id, device]]), onstatechange: null }) })
    Object.assign(window, { introMidi: { send: (status: number) => listener?.({ data: new Uint8Array([status, 60, 100]), timeStamp: performance.now() }), bindings: () => bindings } })
  })
  const send = (status: number) => page.evaluate(status => (window as unknown as { introMidi: { send: (status: number) => void } }).introMidi.send(status), status)
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByRole('button', { name: 'Start lesson', exact: true }).click()
  await page.getByRole('button', { name: 'Turn the staff', exact: true }).click()
  await send(0x90)
  await expect(page.locator('.intro-targets .complete')).toHaveCount(1)
  await expect(page.locator('[data-midi="60"].pressed')).toBeVisible()
  await page.getByRole('button', { name: 'Skip introduction', exact: true }).click()
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await send(0x80)
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await page.waitForTimeout(100)
  await send(0x90); await send(0x80)
  await expect(page.locator('.run-position')).toHaveText('1 / 115')
  expect(await page.evaluate(() => (window as unknown as { introMidi: { bindings: () => number } }).introMidi.bindings())).toBe(1)
})
