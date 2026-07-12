import mermaid from 'mermaid'

let mermaidInitialised = false
let renderCounter = 0

export interface MermaidRenderResult {
  svg: string | null
  error: string | null
}

/**
 * Whether a fenced code block language tag represents a Mermaid diagram.
 */
export function isMermaidLanguage({ language }: { language: string | null | undefined }): boolean {
  return String(language ?? '').trim().toLowerCase() === 'mermaid'
}

/**
 * Configures the Mermaid renderer once per session with strict security
 * (TR-9.2) and a theme that matches the app's light/dark appearance.
 */
export function ensureMermaidInitialised({ isDark = false }: { isDark?: boolean } = {}): void {
  if (mermaidInitialised) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'default',
    })
    return
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: isDark ? 'dark' : 'default',
  })
  mermaidInitialised = true
}

/**
 * Renders a Mermaid diagram source string to an SVG fragment.
 * Errors are returned per-diagram rather than thrown (TR-9.3).
 */
export async function renderMermaidDiagram({
  source,
  isDark = false,
}: {
  source: string
  isDark?: boolean
}): Promise<MermaidRenderResult> {
  const trimmed = source.trim()
  if (!trimmed) {
    return { svg: null, error: 'Diagram source is empty.' }
  }

  ensureMermaidInitialised({ isDark })

  renderCounter += 1
  const id = `markdoc-mermaid-${renderCounter}`

  try {
    const { svg } = await mermaid.render(id, trimmed)
    return { svg, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to render diagram.'
    return { svg: null, error: message }
  }
}

/**
 * Converts a rendered Mermaid SVG string into a PNG data URL suitable for
 * embedding in DOCX exports (TR-9.5).
 */
export async function svgToPngDataUrl({ svg }: { svg: string }): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image()
    const encoded = encodeURIComponent(svg)
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`

    image.onload = () => {
      const width = Math.max(1, image.naturalWidth || 800)
      const height = Math.max(1, image.naturalHeight || 600)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (!context) {
        resolve(null)
        return
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }

    image.onerror = () => {
      resolve(null)
    }

    image.src = dataUrl
  })
}

/**
 * Finds Mermaid source elements inside a live DOM container and returns
 * the raw diagram text for each match.
 */
export function findMermaidSourceElements({ container }: { container: ParentNode }): HTMLElement[] {
  const fromEditorBlocks = Array.from(
    container.querySelectorAll<HTMLElement>('.code-block-node[data-language="mermaid"] pre code')
  )
  if (fromEditorBlocks.length > 0) return fromEditorBlocks

  return Array.from(container.querySelectorAll<HTMLElement>('pre code.language-mermaid'))
}

/**
 * Renders every Mermaid block inside a container, replacing each source
 * element with either an inline SVG preview or an error placeholder.
 */
export async function renderMermaidBlocksInContainer({
  container,
  isDark = false,
}: {
  container: ParentNode
  isDark?: boolean
}): Promise<string[]> {
  const warnings: string[] = []
  const sourceElements = findMermaidSourceElements({ container })

  await Promise.all(
    sourceElements.map(async (sourceElement) => {
      const source = sourceElement.textContent ?? ''
      const blockElement =
        sourceElement.closest<HTMLElement>('.code-block-node') ??
        sourceElement.closest<HTMLElement>('pre') ??
        sourceElement

      const { svg, error } = await renderMermaidDiagram({ source, isDark })
      const mount = document.createElement('div')
      mount.className = 'mermaid-diagram-mount'
      mount.setAttribute('data-testid', 'mermaid-diagram')

      if (svg) {
        mount.innerHTML = svg
      } else {
        warnings.push(error ?? 'A Mermaid diagram failed to render.')
        mount.classList.add('mermaid-diagram-mount--error')
        mount.innerHTML = `
          <p class="mermaid-diagram-error-title">Diagram error</p>
          <p class="mermaid-diagram-error-message">${escapeHtml(error ?? 'Failed to render diagram.')}</p>
          <pre class="mermaid-diagram-error-source"><code>${escapeHtml(source)}</code></pre>
        `
      }

      const toolbar = blockElement.querySelector('.code-block-toolbar')
      toolbar?.remove()

      const existingMount = blockElement.querySelector('.mermaid-diagram-mount')
      existingMount?.remove()

      if (blockElement.classList.contains('code-block-node')) {
        blockElement.classList.add('mermaid-block-node')
        blockElement.replaceChildren(mount)
        return
      }

      const sourceParent = sourceElement.closest('pre')
      if (sourceParent) {
        sourceParent.replaceWith(mount)
        return
      }

      blockElement.replaceWith(mount)
    })
  )

  return warnings
}

/**
 * Parses exported/preview HTML and inlines rendered Mermaid SVG for each
 * fenced `mermaid` block so PDF/HTML export matches the live preview.
 */
export async function renderMermaidBlocksInHtml({
  html,
  isDark = false,
}: {
  html: string
  isDark?: boolean
}): Promise<{ html: string; warnings: string[] }> {
  const parser = new DOMParser()
  const documentFragment = parser.parseFromString(`<div id="markdoc-mermaid-root">${html}</div>`, 'text/html')
  const root = documentFragment.getElementById('markdoc-mermaid-root')
  if (!root) return { html, warnings: [] }

  const warnings = await renderMermaidBlocksInContainer({ container: root, isDark })
  return { html: root.innerHTML, warnings }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
