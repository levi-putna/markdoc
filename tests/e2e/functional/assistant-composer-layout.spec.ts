import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

const projectRoot = process.cwd()
const electronPath = join(projectRoot, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')

test.describe('Assistant composer layout', () => {
  test('submit button fits within the composer action bar', async () => {
    const app = await electron.launch({
      executablePath: electronPath,
      args: [join(projectRoot, 'out/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    const page = await app.firstWindow({ timeout: 30000 })
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('[data-testid="document-window"]')).toBeVisible({ timeout: 15000 })

    await page.evaluate(async () => {
      await window.markdoc.setPreferences({
        aiEnabled: true,
        aiDisclosureAccepted: true,
        enabledModelIds: ['anthropic/claude-3.5-haiku'],
        defaultAssistantModel: 'anthropic/claude-3.5-haiku',
      })
    })

    await page.click('[data-testid="assistant-toggle"]')
    await expect(page.locator('[data-testid="assistant-composer-actions"]')).toBeVisible({
      timeout: 10000,
    })

    const layout = await page.evaluate(() => {
      const actions = document.querySelector('[data-testid="assistant-composer-actions"]')
      const submit = document.querySelector('[data-testid="assistant-composer-submit"]')
      const inputGroup = document.querySelector('.assistant-prompt-input [data-slot="input-group"]')

      if (!actions || !submit || !inputGroup) {
        return null
      }

      const actionsRect = actions.getBoundingClientRect()
      const submitRect = submit.getBoundingClientRect()
      const inputGroupRect = inputGroup.getBoundingClientRect()

      return {
        actionsWidth: actionsRect.width,
        submitRight: submitRect.right,
        actionsRight: actionsRect.right,
        inputGroupRight: inputGroupRect.right,
        submitLeft: submitRect.left,
        submitWidth: submitRect.width,
      }
    })

    expect(layout).not.toBeNull()
    expect(layout!.submitWidth).toBeGreaterThan(20)
    expect(layout!.submitRight).toBeLessThanOrEqual(layout!.actionsRight + 1)
    expect(layout!.submitRight).toBeLessThanOrEqual(layout!.inputGroupRight + 1)
    expect(layout!.submitLeft).toBeGreaterThanOrEqual(layout!.actionsRight - layout!.submitWidth - 80)

    await app.close()
  })
})
