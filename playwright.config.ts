import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', timeout: 40000, workers: 1,
  outputDir: 'output/playwright/results',
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
})
