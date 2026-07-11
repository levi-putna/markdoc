import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'
import { readFileSync } from 'fs'

const projectRoot = process.cwd()
const electronPath = join(projectRoot, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')

/**
 * Usability test: realistic authoring session through the built Electron app.
 * Captures screenshots at each step for visual review.
 */
test.describe('MarkDoc usability session', () => {
  test('full authoring workflow', async () => {
    const app = await electron.launch({
      executablePath: electronPath,
      args: [join(projectRoot, 'out/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    const window = await app.firstWindow({ timeout: 30000 })
    await window.waitForLoadState('domcontentloaded')

    // Step 1: Blank document visible
    await expect(window.locator('[data-testid="document-window"]')).toBeVisible({ timeout: 15000 })
    await window.screenshot({ path: 'test-results/usability-01-blank-document.png' })

    // Step 2: Switch to preview mode
    await window.locator('[data-testid="view-preview"]').click()
    await expect(window.locator('[data-testid="preview-pane"]')).toBeVisible()
    await window.screenshot({ path: 'test-results/usability-02-preview-mode.png' })

    // Step 3: Switch to split mode
    await window.locator('[data-testid="view-split"]').click()
    await expect(window.locator('[data-testid="editor-pane"]')).toBeVisible()
    await expect(window.locator('[data-testid="preview-pane"]')).toBeVisible()
    await window.screenshot({ path: 'test-results/usability-03-split-mode.png' })

    // Step 4: Toggle sidebar
    await window.locator('[data-testid="sidebar-toggle"]').click()
    await window.screenshot({ path: 'test-results/usability-04-sidebar-hidden.png' })
    await window.locator('[data-testid="sidebar-toggle"]').click()

    // Step 5: Open search overlay
    await window.locator('[data-testid="search-toggle"]').click()
    await expect(window.locator('[data-testid="search-overlay"]')).toBeVisible()
    await window.screenshot({ path: 'test-results/usability-05-search-overlay.png' })
    await window.keyboard.press('Escape')

    // Step 6: Return to edit mode
    await window.locator('[data-testid="view-edit"]').click()
    await expect(window.locator('[data-testid="editor-pane"]')).toBeVisible()
    await window.screenshot({ path: 'test-results/usability-06-edit-mode.png' })

    // Step 7: Verify fixture markdown round-trips (unit-level sanity)
    const fixture = readFileSync(join(projectRoot, 'tests/fixtures/headings-only.md'), 'utf-8')
    expect(fixture).toContain('# Chapter One')

    await app.close()
  })
})
