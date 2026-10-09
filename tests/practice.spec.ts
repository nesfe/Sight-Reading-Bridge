import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('srb-staff-intro-v1', 'seen')
    let fullscreen = false
    const listeners = new Set<(value: boolean) => void>()
    Object.assign(window, { sightReadingBridge: {
      getVersion: async () => 'test',
      getFullscreen: async () => fullscreen,
      setFullscreen: async (value: boolean) => {
        await new Promise(resolve => setTimeout(resolve, 30))
        fullscreen = value
        listeners.forEach(fn => fn(value))
        return value
      },
      onFullscreen: (fn: (value: boolean) => void) => { listeners.add(fn); return () => listeners.delete(fn) },
    } })
  })
})

test('practice fills the window, Escape pauses without reset, mobile language stays visible', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.locator('.sidebar')).toBeHidden()
  const score = await page.locator('.run-score svg').boundingBox()
  expect(score!.height).toBeGreaterThan(700)
  expect(score!.y + score!.height).toBeLessThan(1000)
  await page.keyboard.press('Escape')
  await expect(page.locator('.pause-overlay')).toBeVisible()
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await expect(page.locator('.sidebar')).toBeVisible()
  await page.getByRole('button', { name: 'Режим тренировки', exact: true }).click()
  await page.locator('.pause-overlay button').click()
  await expect(page.locator('.pause-overlay')).toHaveCount(0)
  await page.screenshot({ path: 'output/playwright/practice-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'English', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/practice-mobile.png', fullPage: true })
})

test('automatic fullscreen is remembered and released; manual fullscreen is not taken over', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Настройки экрана', { exact: true }).click()
  await page.getByRole('switch').check()
  await page.reload()
  await page.getByLabel('Настройки экрана', { exact: true }).click()
  await expect(page.getByRole('switch')).toBeChecked()
  await page.getByLabel('Настройки экрана', { exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.getByRole('button', { name: 'Выйти из полного экрана', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Выйти из режима тренировки', exact: true }).click()
  await expect(page.getByRole('button', { name: 'На весь экран', exact: true })).toBeEnabled()
  await expect(page.locator('.pause-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'К занятиям', exact: true }).click()
  await page.getByRole('button', { name: 'На весь экран', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Выйти из полного экрана', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await page.getByRole('button', { name: 'Выйти из режима тренировки', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Выйти из полного экрана', exact: true })).toBeEnabled()
})

test('fullscreen rejection is visible and practice still starts', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('srb-auto-fullscreen', 'true')
    window.sightReadingBridge!.setFullscreen = async () => { throw new Error('Rejected') }
  })
  await page.goto('/')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
  await expect(page.locator('.sidebar')).toBeHidden()
})

test('held and incorrect notes do not re-engrave a static trainer score', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: '2 Горизонтальные полосы' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  const svg = page.locator('.standard-score svg')
  await expect(svg).toBeVisible()
  await svg.evaluate(node => node.setAttribute('data-render-marker', 'original'))
  const key = page.locator('.run-score [data-midi="61"]')
  for (let i = 0; i < 8; i++) {
    await key.press('Enter')
  }
  await expect(svg).toHaveAttribute('data-render-marker', 'original')
  await expect(page.locator('.run-position')).toHaveText('0 / 115')
})
