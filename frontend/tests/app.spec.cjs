const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  // Team artwork is third-party and should never make UI behavior tests network-dependent.
  await page.route('https://a.espncdn.com/**', (route) => route.abort())
})

test('dashboard renders and exposes downloads', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'RankingsDiff' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CSV' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'XLSX' })).toBeVisible()
  await expect(page.locator('.team-badge').first()).toBeVisible()
  await expect(page.getByText(/Looking at/)).toBeVisible()
  await page.getByRole('button', { name: /Switch sheet/ }).click()
  await expect(page.getByRole('link', { name: 'Run refresh workflow' })).toBeVisible()
  await expect(page.getByLabel('Position colors')).toHaveCount(0)
  const sourceLinkRadius = await page.getByRole('link', { name: /ESPN 2026 PPR300 PDF/ }).evaluate((link) => getComputedStyle(link).borderRadius)
  expect(parseFloat(sourceLinkRadius)).toBeLessThanOrEqual(10)
})

test('season and source switching works with manifest data', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Switch sheet/ }).click()
  await page.locator('.settings-popover').getByLabel('Year').selectOption('2025')
  await page.locator('.settings-popover').getByLabel('Sheet').selectOption('espn')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByText('ESPN $')).toBeVisible()
})

test('command-k focuses search and position filters rows', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByPlaceholder(/Ja'Marr/)).toBeVisible()
  await page.waitForTimeout(100)
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })))
  await expect(page.getByPlaceholder(/Ja'Marr/)).toBeFocused()
  await page.getByPlaceholder(/Ja'Marr/).fill('Ja')
  await expect(page.getByText("Ja'Marr Chase").first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByPlaceholder(/Ja'Marr/)).not.toBeFocused()
  await page.keyboard.press('KeyW')
  await expect(page.getByRole('button', { name: 'WR' })).toHaveClass(/active/)
  await expect(page.getByLabel(/Keyboard shortcuts/)).toBeVisible()
  await expect(page.getByText("Ja'Marr Chase").first()).toBeVisible()
  await page.getByPlaceholder(/Ja'Marr/).fill('zzzz')
  await expect(page.getByText('No players match the current filters.')).toBeVisible()
})

test('mobile 390px has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('./')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('mobile 320px has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('./')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('targets and drafted state persist per sheet', async ({ page }) => {
  await page.goto('./')
  const target = page.getByRole('button', { name: "Target Ja'Marr Chase" }).first()
  await target.click()
  await expect(page.getByRole('button', { name: "Remove target Ja'Marr Chase" }).first()).toBeVisible()
  await page.getByRole('button', { name: "Mark drafted Ja'Marr Chase" }).first().click()
  await expect(page.getByRole('button', { name: "Undo drafted Ja'Marr Chase" }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: "Undo drafted Ja'Marr Chase" }).first()).toBeVisible()
})

test('position overview shows all lanes without collisions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  await page.getByRole('button', { name: 'Top by position' }).click()
  for (const heading of ['Running backs', 'Wide receivers', 'Quarterbacks', 'Tight ends']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
  const overlaps = await page.locator('.position-player').evaluateAll((rows) => rows.some((row) => {
    const cells = [...row.children].filter((cell) => getComputedStyle(cell).display !== 'none').map((cell) => cell.getBoundingClientRect())
    return cells.some((cell, index) => index > 0 && cell.left < cells[index - 1].right - 1)
  }))
  expect(overlaps).toBe(false)
  const runningBacks = page.getByLabel('RB players, scroll to see all')
  await expect(runningBacks.locator('.position-player')).not.toHaveCount(6)
  expect(await runningBacks.locator('.position-player').count()).toBeGreaterThan(6)
  const scrollMetrics = await runningBacks.evaluate((list) => ({ clientHeight: list.clientHeight, scrollHeight: list.scrollHeight, overflowY: getComputedStyle(list).overflowY }))
  expect(scrollMetrics.overflowY).toBe('auto')
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
  await runningBacks.focus()
  await runningBacks.evaluate((list) => { list.scrollTop = list.scrollHeight })
  await expect(runningBacks.locator('.position-player').last()).toBeVisible()
})

test('team logos are centered inside badges', async ({ page }) => {
  await page.goto('./')
  const offset = await page.locator('.team-badge:has(img)').first().evaluate((badge) => {
    const image = badge.querySelector('img')
    const badgeBox = badge.getBoundingClientRect()
    const imageBox = image.getBoundingClientRect()
    return {
      x: Math.abs((badgeBox.left + badgeBox.width / 2) - (imageBox.left + imageBox.width / 2)),
      y: Math.abs((badgeBox.top + badgeBox.height / 2) - (imageBox.top + imageBox.height / 2))
    }
  })
  expect(offset.x).toBeLessThanOrEqual(1)
  expect(offset.y).toBeLessThanOrEqual(1)
})
