const { defineConfig, devices } = require('@playwright/test')
const basePath = process.env.GITHUB_ACTIONS ? '/RankingsDiff/' : '/'
const appUrl = `http://127.0.0.1:5173${basePath}`

module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: appUrl },
  timeout: 30000,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: appUrl,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
})
