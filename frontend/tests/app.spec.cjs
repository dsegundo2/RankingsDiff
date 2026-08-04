const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  // Team artwork is third-party and should never make UI behavior tests network-dependent.
  await page.route('https://a.espncdn.com/**', (route) => route.abort())
})

test('dashboard renders and exposes settings downloads', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'RankingsDiff' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Settings/ })).toBeVisible()
  await expect(page.locator('.team-badge').first()).toBeVisible()
  await expect(page.getByText(/Looking at/)).toBeVisible()
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('link', { name: 'CSV' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'XLSX' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Run refresh workflow' })).toBeVisible()
  await expect(page.getByLabel('Position colors')).toHaveCount(0)
  const sourceLinkRadius = await page.getByRole('link', { name: /ESPN 2026 PPR300 PDF/ }).evaluate((link) => getComputedStyle(link).borderRadius)
  expect(parseFloat(sourceLinkRadius)).toBeLessThanOrEqual(10)
})

test('season and source switching works with manifest data', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.locator('.settings-popover').getByLabel('Year').selectOption('2025')
  await page.locator('.settings-popover').getByLabel('Sheet').selectOption('espn')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByText('Value', { exact: true })).toBeVisible()
})

test('FantasyPros position view emphasizes source rank', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.locator('.settings-popover').getByLabel('Sheet').selectOption('fpros')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('checkbox', { name: 'By position' }).check()
  await expect(page.locator('.position-lane--rb .position-player__metric strong').first()).toHaveText('#3')
  await expect(page.locator('.position-lane--rb .position-lane__columns')).toContainText('FP')
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

  await page.keyboard.press(',')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByText("Ja'Marr Chase").first()).toBeVisible()
  await page.getByPlaceholder(/Ja'Marr/).fill('zzzz')
  await expect(page.getByText('No players match the current filters.')).toBeVisible()
})

test('mobile 390px uses cards and has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('./')
  await expect(page.locator('.table-wrap')).toBeHidden()
  await expect(page.locator('.cards-list')).toBeVisible()
  await expect(page.getByLabel('Mobile sort controls')).toBeVisible()
  await page.getByLabel('Sort by', { exact: true }).selectOption('player')
  await expect(page.locator('.cards-list .ranking-card').first()).toContainText('A.J. Brown')
  await page.getByRole('button', { name: 'Sort descending' }).click()
  await expect(page.locator('.cards-list .ranking-card').first()).toContainText('Zay Flowers')
  await expect(page.locator('.ranking-card').filter({ hasText: 'Jahmyr Gibbs' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Target Jahmyr Gibbs' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Target Jahmyr Gibbs' }).last().click()
  await expect(page.locator('.target-queue__details').last()).toContainText('$57 → $57')
  const queueBox = await page.getByLabel('Target queue', { exact: true }).evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, width: rect.width }
  })
  expect(queueBox.left).toBeLessThanOrEqual(1)
  expect(queueBox.right).toBeGreaterThanOrEqual(389)
  const allBox = await page.getByRole('button', { name: 'ALL', exact: true }).evaluate((node) => node.getBoundingClientRect().top)
  const teBox = await page.getByRole('button', { name: 'TE', exact: true }).evaluate((node) => node.getBoundingClientRect().top)
  expect(Math.abs(allBox - teBox)).toBeLessThanOrEqual(2)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
  await page.getByRole('checkbox', { name: 'By position' }).check()
  await expect(page.locator('.position-board')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Run refresh workflow' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})


test('mobile FantasyPros cards stretch and actions can be hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('./')
  await page.getByRole('button', { name: /Settings/ }).click()
  await page.locator('.settings-popover').getByLabel('Sheet').selectOption('fpros')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.locator('.cards-list')).toBeVisible()
  await expect(page.locator('.ranking-card').first()).toContainText('FPros rank')
  const cardBox = await page.locator('.ranking-card').first().evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, width: rect.width }
  })
  expect(cardBox.left).toBeLessThanOrEqual(1)
  expect(cardBox.right).toBeGreaterThanOrEqual(389)
  await page.getByRole('checkbox', { name: 'Show actions' }).uncheck()
  await expect(page.locator('.ranking-card__actions').first()).toBeHidden()
  await expect(page.getByRole('button', { name: /Mark drafted/ })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})

test('mobile 320px has no horizontal overflow in board, settings, and source checks', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('./')
  await expect(page.locator('.cards-list')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('heading', { name: 'Ranking change checks' })).toBeVisible()
  const sourceHeaderWidth = await page.locator('.source-checks__header').evaluate((node) => node.getBoundingClientRect().width)
  expect(sourceHeaderWidth).toBeLessThanOrEqual(288)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})

test('table headers stay compact across browser widths', async ({ page }) => {
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('./')
    await expect(page.locator('.rankings-table')).toBeVisible()
    await expect(page.locator('.rank-heading')).toContainText('Rank')
    await expect(page.locator('.rank-heading__sorts')).toContainText('SRC')
    await expect(page.locator('.rank-heading__sorts')).toContainText('ADJ')
    await expect(page.getByText('Value', { exact: true })).toBeVisible()
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      headerRight: document.querySelector('.rankings-table thead')?.getBoundingClientRect().right ?? 0,
      viewportRight: window.innerWidth
    }))
    expect(layout.overflow).toBe(false)
    expect(layout.headerRight).toBeLessThanOrEqual(layout.viewportRight + 1)
  }
})

test('desktop table stays inside the board column beside the target queue', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 900 })
  await page.goto('./')
  await expect(page.getByLabel('Target queue', { exact: true })).toBeVisible()
  const layout = await page.evaluate(() => {
    const table = document.querySelector('.table-wrap')?.getBoundingClientRect()
    const queue = document.querySelector('.target-queue')?.getBoundingClientRect()
    return { tableRight: table?.right ?? 0, queueLeft: queue?.left ?? 0, viewportRight: window.innerWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }
  })
  expect(layout.overflow).toBe(false)
  expect(layout.tableRight).toBeLessThanOrEqual(layout.queueLeft - 8)
  expect(layout.queueLeft).toBeLessThan(layout.viewportRight)
})


test('target queue is controlled from settings and works in both views', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: "Target Ja'Marr Chase" }).first().click()
  await expect(page.getByLabel('Target queue', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Target queue', { exact: true })).toContainText('Shortlist')
  await expect(page.getByLabel('Target queue', { exact: true })).toContainText('WR')

  await page.getByRole('checkbox', { name: 'By position' }).check()
  await expect(page.getByLabel('Target queue', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('checkbox', { name: 'Show target queue' }).uncheck()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByLabel('Target queue', { exact: true })).toHaveCount(0)
  await expect(page.locator('.draft-board-layout')).toHaveClass(/draft-board-layout--queue-hidden/)

  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByRole('checkbox', { name: 'Show target queue' }).check()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByLabel('Target queue', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 900 })
  await expect(page.getByLabel('Target queue', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
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


test('click selection supports arrows and enter drafting in board and position views', async ({ page }) => {
  await page.goto('./')
  const firstBoardRow = page.locator('.rankings-table tbody tr').first()
  await firstBoardRow.click()
  await expect(firstBoardRow).toHaveClass(/is-selected/)
  await page.keyboard.press('f')
  await expect(page.getByRole('button', { name: 'Remove target Jahmyr Gibbs' }).first()).toBeVisible()
  await expect(page.getByLabel('Target queue', { exact: true })).toContainText('Jahmyr Gibbs')
  await page.keyboard.press('f')
  await expect(page.getByRole('button', { name: 'Target Jahmyr Gibbs' }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(firstBoardRow).not.toHaveClass(/is-selected/)
  await firstBoardRow.click()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Undo drafted Jahmyr Gibbs' }).first()).toBeVisible()

  await page.keyboard.press('ArrowDown')
  const secondBoardRow = page.locator('.rankings-table tbody tr').nth(1)
  await expect(secondBoardRow).toHaveClass(/is-selected/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Undo drafted Bijan Robinson' }).first()).toBeVisible()

  await page.getByRole('checkbox', { name: 'By position' }).check()
  const firstRunningBack = page.locator('.position-lane--rb .position-player').first()
  await firstRunningBack.click()
  await expect(firstRunningBack).toHaveClass(/is-selected/)
  await page.keyboard.press('f')
  await expect(page.getByRole('button', { name: 'Remove target Jahmyr Gibbs' }).first()).toBeVisible()
  await page.keyboard.press('ArrowRight')
  const firstWideReceiver = page.locator('.position-lane--wr .position-player').first()
  await expect(firstWideReceiver).toHaveClass(/is-selected/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Undo drafted Puka Nacua' }).first()).toBeVisible()

  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.position-lane--rb .position-player').first()).toHaveClass(/is-selected/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.position-player.is-selected')).toHaveCount(0)
})

test('position overview shows all lanes without collisions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('./')
  await page.getByRole('checkbox', { name: 'By position' }).check()
  for (const heading of ['Running backs', 'Wide receivers', 'Quarterbacks', 'Tight ends']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
  await expect(page.locator('.position-player .team-badge').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  expect(await page.locator('.position-board').evaluate((board) => getComputedStyle(board).gridTemplateColumns.split(' ').length)).toBe(2)
  const overlaps = await page.locator('.position-player').evaluateAll((rows) => rows.some((row) => {
    const cells = [...row.children].filter((cell) => getComputedStyle(cell).display !== 'none').map((cell) => cell.getBoundingClientRect())
    return cells.some((cell, index) => index > 0 && cell.left < cells[index - 1].right - 1)
  }))
  expect(overlaps).toBe(false)
  const firstMetric = page.locator('.position-lane--rb .position-player__metric strong').first()
  await expect(firstMetric).toHaveText('$57')
  await expect(page.locator('.position-lane--rb .position-lane__columns')).toContainText('ESPN')
  await expect(page.locator('.position-lane--rb .position-player__difference').first()).toHaveText('$0')
  expect(await page.locator('.position-lane--rb .position-player').first().evaluate((row) => row.style.getPropertyValue('--diff-alpha'))).toBe('')
  expect(await page.locator('.position-lane--wr .position-player').filter({ hasText: 'Drake London' }).evaluate((row) => Number(row.style.getPropertyValue('--diff-alpha')))).toBeGreaterThan(0)
  const runningBacks = page.getByLabel('RB players, scroll to see all')
  await expect(runningBacks.locator('.position-player')).not.toHaveCount(6)
  expect(await runningBacks.locator('.position-player').count()).toBeGreaterThan(6)
  const scrollMetrics = await runningBacks.evaluate((list) => ({ clientHeight: list.clientHeight, scrollHeight: list.scrollHeight, overflowY: getComputedStyle(list).overflowY }))
  expect(scrollMetrics.overflowY).toBe('auto')
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
  await runningBacks.focus()
  await runningBacks.evaluate((list) => { list.scrollTop = list.scrollHeight })
  await expect(runningBacks.locator('.position-player').last()).toBeVisible()

  await page.getByRole('button', { name: 'QB' }).click()
  expect(await page.locator('.position-board').getAttribute('data-count')).toBe('3')
  expect(await page.locator('.position-board').evaluate((board) => getComputedStyle(board).gridTemplateColumns.split(' ').length)).toBe(3)
  await page.getByRole('button', { name: 'TE', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Quarterbacks' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Tight ends' })).toHaveCount(0)
  await expect(page.locator('.position-board')).toHaveAttribute('data-count', '2')
})

test('team logos are centered inside badges', async ({ page }) => {
  await page.goto('./')
  expect(await page.locator('.player-cell').first().evaluate((cell) => parseFloat(getComputedStyle(cell).columnGap))).toBeGreaterThanOrEqual(10)
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

test('double-clicking a position isolates that lane', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('checkbox', { name: 'By position' }).check()
  await page.getByRole('button', { name: 'WR', exact: true }).dblclick()
  await expect(page.getByRole('heading', { name: 'Wide receivers' })).toBeVisible()
  await expect(page.locator('.position-board')).toHaveAttribute('data-count', '1')
  await expect(page.getByRole('heading', { name: 'Running backs' })).toHaveCount(0)
})

test('draft board position filters can combine positions', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'QB', exact: true }).click()
  await page.getByRole('button', { name: 'WR', exact: true }).click()
  await expect(page.getByRole('button', { name: 'QB', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('button', { name: 'WR', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('button', { name: 'RB', exact: true })).not.toHaveClass(/active/)
  await expect(page.getByRole('button', { name: 'ALL', exact: true })).not.toHaveClass(/active/)
})

test('table headings stick while draft rows scroll', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.rankings-table th').first()).toHaveCSS('position', 'sticky')
  await page.locator('.rankings-table tbody tr').nth(30).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const top = await page.locator('.rankings-table th').first().evaluate((heading) => heading.getBoundingClientRect().top)
  expect(top).toBeGreaterThanOrEqual(-1)
  expect(top).toBeLessThanOrEqual(1)
})

test('draft JSON can be saved, cleared, and restored by player key', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: "Target Ja'Marr Chase" }).first().click()
  await page.getByRole('button', { name: "Mark drafted Ja'Marr Chase" }).first().click()

  await page.getByRole('button', { name: /Settings/ }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save draft' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('rankingsdiff-2026-espn-draft.json')
  const stream = await download.createReadStream()
  let contents = ''
  for await (const chunk of stream) contents += chunk.toString()
  const saved = JSON.parse(contents)
  expect(saved.players.drafted).toContain("ja'marr chase|cin")
  expect(saved).not.toHaveProperty('rows')

  await page.getByRole('button', { name: 'Clear draft' }).click()
  await expect(page.getByRole('heading', { name: 'Clear this draft?' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear without saving' }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('button', { name: "Mark drafted Ja'Marr Chase" }).first()).toBeVisible()

  await page.getByRole('button', { name: /Settings/ }).click()
  await page.getByLabel('Upload draft JSON').setInputFiles({
    name: 'saved-draft.json',
    mimeType: 'application/json',
    buffer: Buffer.from(contents)
  })
  await expect(page.getByRole('button', { name: "Undo drafted Ja'Marr Chase" }).first()).toBeVisible()
  await expect(page.getByText('Draft restored.')).toBeVisible()
})

test('recent picks show newest first with total and suggested values', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: "Mark drafted Jahmyr Gibbs" }).first().click()
  await page.getByRole('button', { name: "Mark drafted Bijan Robinson" }).first().click()
  const log = page.getByLabel('Recent draft picks')
  await expect(log).toContainText('Recent picks')
  await expect(log.locator('li').first()).toContainText('Bijan Robinson')
  await expect(log.locator('li').nth(1)).toContainText('Jahmyr Gibbs')
  await expect(log.locator('li').first()).toContainText('$55')
  await expect(log.locator('li').first()).toContainText('suggested')
})

test('draft view and filters survive refresh', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('checkbox', { name: 'By position' }).check()
  await page.getByRole('button', { name: 'WR', exact: true }).dblclick()
  await page.getByPlaceholder(/Ja'Marr/).fill('London')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'By position' })).toBeChecked()
  await expect(page.getByRole('button', { name: 'WR', exact: true })).toHaveClass(/active/)
  await expect(page.getByPlaceholder(/Ja'Marr/)).toHaveValue('London')
  await expect(page.getByRole('heading', { name: 'Wide receivers' })).toBeVisible()
})

test('spacing options preview renders layout ideas', async ({ page }) => {
  await page.goto('./spacing-options.html')
  await expect(page.getByRole('heading', { name: 'Full-name layouts for rankings' })).toBeVisible()
  await expect(page.locator('.option')).toHaveCount(6)
  await expect(page.getByText('Option B: Stacked price + soft edge')).toBeVisible()
  await expect(page.getByText('Option D: Value cards with labeled pills')).toBeVisible()
  await expect(page.getByText('Kenneth Walker III').first()).toBeVisible()
  await expect(page.getByText('Amon-Ra St. Brown').first()).toBeVisible()
  expect(await page.locator('.name strong, .gradient-card h4, .mobile-card h4, .mobile-row strong, .lane-row strong').allTextContents()).not.toContain('…')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})
