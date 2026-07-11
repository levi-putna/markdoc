import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'

const projectRoot = process.cwd()
const electronPath = join(projectRoot, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const mainEntry = join(projectRoot, 'out/main/index.js')

/**
 * Marks every window clean before closing. A window with unsaved changes
 * triggers a native "Save changes?" confirmation on close that Playwright
 * cannot interact with, which would otherwise hang the test.
 */
async function clearDirtyState(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().forEach((win) => win.setDocumentEdited(false))
  })
}

/**
 * Regression coverage for TC-FILE.1/TC-FILE.3: opening a Markdown file (via a
 * launch argument, standing in for Finder/CLI, and via the File > Open menu)
 * must load its content into the editor, and Save must write edits back to
 * disk. These exercise the real Electron main process (menu, IPC, file I/O),
 * not mocks — the underlying bug (File > Open discarding the picked path)
 * only reproduces at this level.
 */
test.describe('MarkDoc file open/save (TC-FILE)', () => {
  test('TC-FILE.3 launching with a file path argument opens that file', async () => {
    const fixturePath = join(projectRoot, 'tests/fixtures/headings-only.md')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry, fixturePath],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toBeVisible({ timeout: 15000 })
      await expect(editorPane).toContainText('Chapter One', { timeout: 15000 })
      await expect(editorPane).toContainText('Introductory content for chapter one.')
    } finally {
      await app.close()
    }
  })

  test('TC-FILE.1 File > Open menu loads the selected file into the editor', async () => {
    const fixturePath = join(projectRoot, 'tests/fixtures/with-frontmatter.md')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')
      await expect(window.locator('[data-testid="document-window"]')).toBeVisible({ timeout: 15000 })

      // Playwright cannot drive the native "choose a file" dialog directly, so
      // stand in for the user's selection the same way the real dialog would
      // resolve, then trigger the exact menu item a user would click.
      await app.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog
      }, fixturePath)

      await app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()?.getMenuItemById('menu-file-open')?.click()
      })

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toContainText('Document With Front Matter', { timeout: 15000 })
      await expect(editorPane).toContainText('Body content after front matter.')
    } finally {
      await app.close()
    }
  })

  test('TC-FILE.1b File > Open still loads the file when a non-document window has OS focus', async () => {
    // Regression test: `getTargetWindow()` used to trust `getFocusedWindow()`
    // unconditionally. If any non-document window (e.g. Preferences) had OS
    // focus when File > Open fired, the picked path was sent to that window
    // instead of a document window. That window's renderer never listens for
    // `file:open-path`, so the path vanished into an unread buffer and the
    // document silently never loaded — with no error surfaced anywhere.
    const fixturePath = join(projectRoot, 'tests/fixtures/with-frontmatter.md')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')
      await expect(window.locator('[data-testid="document-window"]')).toBeVisible({ timeout: 15000 })

      // Simulate a non-document window (stands in for Preferences) grabbing
      // OS focus right before the user chooses File > Open.
      await app.evaluate(({ BrowserWindow }) => {
        const utilityWindow = new BrowserWindow({ width: 400, height: 300, show: true })
        utilityWindow.loadURL('about:blank')
        utilityWindow.focus()
      })
      await window.waitForTimeout(300)

      await app.evaluate(({ dialog }, path) => {
        dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog
      }, fixturePath)

      await app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()?.getMenuItemById('menu-file-open')?.click()
      })

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toContainText('Document With Front Matter', { timeout: 15000 })
      await expect(editorPane).toContainText('Body content after front matter.')
    } finally {
      await app.close()
    }
  })

  test('TC-FILE.1 Save writes the edited document back to disk', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'markdoc-e2e-'))
    const tempFile = join(tempDir, 'save-test.md')
    writeFileSync(tempFile, '# Original Heading\n\nOriginal body text.\n', 'utf-8')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry, tempFile],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toContainText('Original Heading', { timeout: 15000 })

      // Place the caret at the end of the body paragraph and append new text.
      await editorPane.getByText('Original body text.').click()
      await window.keyboard.press('End')
      await window.keyboard.type(' Appended by test.')

      await app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()?.getMenuItemById('menu-file-save')?.click()
      })

      await expect
        .poll(() => readFileSync(tempFile, 'utf-8'), { timeout: 15000 })
        .toContain('Appended by test.')

      const savedContent = readFileSync(tempFile, 'utf-8')
      expect(savedContent).toContain('# Original Heading')
      expect(savedContent).toContain('Original body text. Appended by test.')
    } finally {
      await clearDirtyState(app)
      await app.close()
    }
  })

  test('TC-FILE round-trip: saved content re-opens with the same edits', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'markdoc-e2e-'))
    const tempFile = join(tempDir, 'round-trip.md')
    writeFileSync(tempFile, '# Round Trip\n\nFirst line.\n', 'utf-8')

    const app = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry, tempFile],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await app.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toContainText('First line.', { timeout: 15000 })

      await editorPane.getByText('First line.').click()
      await window.keyboard.press('End')
      await window.keyboard.type(' plus a second sentence.')

      await app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()?.getMenuItemById('menu-file-save')?.click()
      })

      await expect
        .poll(() => readFileSync(tempFile, 'utf-8'), { timeout: 15000 })
        .toContain('plus a second sentence.')
    } finally {
      await clearDirtyState(app)
      await app.close()
    }

    // Re-open the same file in a fresh app instance and confirm the saved
    // edit is really on disk and loads back in, closing the save -> load loop.
    const reopened = await electron.launch({
      executablePath: electronPath,
      args: [mainEntry, tempFile],
      env: { ...process.env, NODE_ENV: 'test', MARKDOC_TEST: '1' },
    })

    try {
      const window = await reopened.firstWindow({ timeout: 30000 })
      await window.waitForLoadState('domcontentloaded')

      const editorPane = window.locator('[data-testid="editor-pane"]')
      await expect(editorPane).toContainText('Round Trip', { timeout: 15000 })
      await expect(editorPane).toContainText('plus a second sentence.')
    } finally {
      await reopened.close()
    }
  })
})
