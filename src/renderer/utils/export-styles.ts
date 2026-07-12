/**
 * Reads every stylesheet rule currently applied to this window (design
 * tokens, Tailwind utilities, and the `.preview-content` rules) as plain
 * CSS text. Embedding this verbatim into the offscreen PDF window (TR-10.1)
 * and the standalone HTML export (TR-10.6) is what guarantees exported
 * output visually matches the live Preview pane (FR-9.6) "by construction"
 * rather than by hand-duplicating a second stylesheet.
 */
export function collectPreviewCss(): string {
  const cssTexts: string[] = []

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules ?? [])
      cssTexts.push(rules.map((rule) => rule.cssText).join('\n'))
    } catch {
      // Cross-origin stylesheets can't be read via cssRules — none are
      // expected in this app, but skip rather than fail the export.
    }
  }

  return cssTexts.join('\n')
}

/** Whether the app's dark theme is currently active, so exports match it. */
export function isDarkThemeActive(): boolean {
  return document.documentElement.classList.contains('dark')
}
