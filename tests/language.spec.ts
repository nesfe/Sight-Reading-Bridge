import { expect, test } from '@playwright/test'

test.use({ locale: 'en-US' })

test('English covers each view, score errors, and persisted language choice', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.lesson-detail')).toContainText('115 notes')
  await expect(page.locator('.note-label')).toHaveText('Do · C4')
  for (const view of ['Lessons', 'Progress', 'Instrument', 'Library']) {
    await page.getByRole('button', { name: view, exact: true }).click()
    await expect(page.getByRole('heading', { name: view, exact: true })).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/[А-Яа-яЁё]/)
  }
  await page.getByLabel('Score file', { exact: true }).setInputFiles({ name: 'bad.xml', mimeType: 'application/xml', buffer: Buffer.from('<broken>') })
  await expect(page.getByRole('alert')).toHaveText('Invalid XML. Check the export from your notation editor.')
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Повреждённый XML')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByRole('heading', { name: 'Занятия', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('language control remains visible while scrolling on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const control = page.getByRole('group', { name: 'Language / Язык' })
  await expect(control).toBeInViewport()
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(control).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Русский', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/language-mobile-scrolled.png' })
})

test('language switching preserves an imported score and its selected staff', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByLabel('Score file', { exact: true }).setInputFiles('tests/fixtures/piano.musicxml')
  await expect(page.locator('.imported-score svg')).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Staff', exact: true }).selectOption('1')
  await page.locator('.imported-score svg').evaluate(svg => svg.setAttribute('data-original-render', 'yes'))
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Нотный стан', exact: true })).toHaveValue('1')
  await expect(page.locator('.imported-score svg')).toHaveAttribute('data-original-render', 'yes')
  await expect(page.locator('.follow-position')).toHaveText('0 / 4')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('main')).not.toContainText(/[А-Яа-яЁё]/)
  await page.screenshot({ path: 'output/playwright/library-english.png' })
})

test('language choice works when local storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage blocked', 'SecurityError') }
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError') }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Lessons', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Занятия', exact: true })).toBeVisible()
})
