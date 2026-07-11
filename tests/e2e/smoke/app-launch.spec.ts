import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

const projectRoot = process.cwd()
const electronPath = join(projectRoot, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')

test.describe('MarkDoc smoke tests', () => {
  test('TC-FILE.6 launches with blank document', async () => {
    const app = await electron.launch({
      executablePath: electronPath,
      args: [join(projectRoot, 'out/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    const window = await app.firstWindow({ timeout: 30000 })
    await window.waitForLoadState('domcontentloaded')

    const docWindow = window.locator('[data-testid="document-window"]')
    await expect(docWindow).toBeVisible({ timeout: 15000 })

    await app.close()
  })
})
