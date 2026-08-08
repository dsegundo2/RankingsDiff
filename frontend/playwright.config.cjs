const { defineConfig, devices } = require('@playwright/test')
const port = process.env.PLAYWRIGHT_PORT || '5173'
const appUrl = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}/`

module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: appUrl },
  timeout: 30000,
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: appUrl,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
})
