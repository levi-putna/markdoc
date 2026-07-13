import { app, shell, type WebContents } from 'electron'
import log from 'electron-log'

/**
 * Returns true when `url` is a safe http(s) link for the system browser.
 */
function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Opens `url` in the user's default web browser.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isHttpUrl(url)) {
    throw new Error(`Refusing to open non-http(s) URL: ${url}`)
  }

  await shell.openExternal(url, { activate: true })
}

/**
 * Routes external http(s) navigations to the system browser instead of the
 * Electron window (CSP blocks in-app loads for third-party origins).
 */
function attachExternalLinkHandlers(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      void openExternalUrl(url).catch((error) => {
        log.error('Failed to open external link from window.open', error)
      })
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    let currentOrigin = ''
    try {
      currentOrigin = new URL(contents.getURL()).origin
    } catch {
      // Ignore invalid current URL during initial load.
    }

    let targetOrigin = ''
    try {
      targetOrigin = new URL(url).origin
    } catch {
      return
    }

    if (targetOrigin !== currentOrigin && isHttpUrl(url)) {
      event.preventDefault()
      void openExternalUrl(url).catch((error) => {
        log.error('Failed to open external link from navigation', error)
      })
    }
  })
}

/**
 * Registers global handlers so external links always open in the system browser.
 */
export function registerExternalLinkHandlers(): void {
  app.on('web-contents-created', (_, contents) => {
    attachExternalLinkHandlers(contents)
  })
}
