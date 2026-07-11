import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'

const projectRoot = process.cwd()
const electronPath = join(projectRoot, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const mainEntry = join(projectRoot, 'out/main/index.js')

/**
 * Builds a Markdown document long enough that its rendered height comfortably
 * exceeds the editor viewport, so scroll-to-heading jumps of varying distance
 * can be exercised deterministically (independent of Mermaid/table rendering
 * quirks that make the perf fixtures unsuitable for this).
 */
function buildLongDocument(sectionCount: number): string {
  const parts: string[] = []
  for (let i = 1; i <= sectionCount; i++) {
    parts.push(`## Section ${i}`)
    parts.push('')
    parts.push(`Body paragraph for section ${i}. `.repeat(20))
    parts.push('')
  }
  return parts.join('\n')
}

/**
 * Regression coverage for the outline sidebar's "scroll to heading" feature:
 * clicking a heading in the outline tree must bring it into view in the
 * editor, consistently, regardless of how far away it is in the document or
 * whether the editor currently has focus.
 *
 * Prior bug: the scroll effect resolved the target DOM element with
 * `editor.view.domAtPos`, which is meant for cursor/text placement — at a
 * heading's position (a block boundary) it commonly resolved to an ancestor
 * container instead of the heading itself, so `scrollIntoView` converged on
 * the same spot regardless of which heading was clicked once the document
 * was long enough. It also called `editor.commands.focus()`, whose deferred,
 * un-`preventScroll`ed native focus call (outside Safari) could race and
 * override the manual scroll a frame later.
 */
test.describe('MarkDoc outline scroll-to-heading', () => {
  test('clicking headings at any depth scrolls each one into view', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'markdoc-outline-scroll-'))
    const tempFile = join(tempDir, 'long-doc.md')
    writeFileSync(tempFile, buildLongDocument(60), 'utf-8')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry, tempFile],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toBeVisible({ timeout: 15000 })

      const scrollBody = window.locator('.simple-editor-body')
      const outlineItems = window.locator('[role="treeitem"]')
      await expect(outlineItems).toHaveCount(60, { timeout: 15000 })

      const headingLocatorAll = editorPane.locator('h1, h2, h3, h4, h5, h6')

      // Exercise short and long jumps, forwards and backwards, across the
      // whole document — the bug above only manifested once a jump crossed
      // enough offscreen ("content-visibility: auto") sections.
      for (const index of [2, 10, 20, 30, 40, 50, 59, 45, 15, 5, 55]) {
        const item = outlineItems.nth(index)
        await item.click()

        const headingLocator = headingLocatorAll.nth(index)
        await expect(headingLocator).toBeVisible({ timeout: 5000 })

        await expect
          .poll(
            async () => {
              const box = await headingLocator.boundingBox()
              const viewportBox = await scrollBody.boundingBox()
              if (!box || !viewportBox) return false
              return box.y >= viewportBox.y - 5 && box.y <= viewportBox.y + viewportBox.height + 5
            },
            { timeout: 5000, message: `heading at outline index ${index} did not scroll into view` }
          )
          .toBe(true)
      }
    } finally {
      await app.close()
    }
  })

  test('clicking a heading scrolls into view even when the editor did not have focus', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'markdoc-outline-scroll-'))
    const tempFile = join(tempDir, 'long-doc.md')
    writeFileSync(tempFile, buildLongDocument(40), 'utf-8')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry, tempFile],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toBeVisible({ timeout: 15000 })

      // Move focus to a non-editor control (the sidebar toggle) so the
      // editor definitely does not have focus before the outline jump.
      await window.locator('[data-testid="sidebar-toggle"]').focus()
      await window.locator('[data-testid="sidebar-toggle"]').click() // hide
      await window.locator('[data-testid="sidebar-toggle"]').click() // show again

      const outlineItems = window.locator('[role="treeitem"]')
      await expect(outlineItems).toHaveCount(40, { timeout: 15000 })

      const targetIndex = 35
      const scrollBody = window.locator('.simple-editor-body')
      const headingLocator = editorPane.locator('h1, h2, h3, h4, h5, h6').nth(targetIndex)

      await outlineItems.nth(targetIndex).click()

      await expect
        .poll(
          async () => {
            const box = await headingLocator.boundingBox()
            const viewportBox = await scrollBody.boundingBox()
            if (!box || !viewportBox) return false
            return box.y >= viewportBox.y - 5 && box.y <= viewportBox.y + viewportBox.height + 5
          },
          { timeout: 5000 }
        )
        .toBe(true)
    } finally {
      await app.close()
    }
  })
})
