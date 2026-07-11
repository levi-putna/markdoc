# MarkDoc

A native macOS Markdown editor built with Electron, React, and Tiptap. Edit Markdown in a Typora-style WYSIWYG surface, preview rendered output, navigate via an outline tree, and export to PDF, DOCX, or HTML.

## Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js** 20+ (LTS recommended)
- **Yarn** 1.22+

## Installation

```bash
yarn install
```

## Development

Start the app in development mode with hot module replacement for the renderer:

```bash
yarn dev
```

This launches Electron with `electron-vite dev`. The main process restarts automatically on changes; the renderer updates via HMR.

> **Note:** Run `yarn dev` in your own terminal — the project convention is not to start the dev server from automated tooling.

## Testing

### Unit and component tests

```bash
yarn test
```

Watch mode:

```bash
yarn test:watch
```

### End-to-end tests (Playwright + Electron)

Build the app first, then run E2E tests:

```bash
yarn build
yarn test:e2e
```

Smoke suite only:

```bash
yarn test:smoke
```

Usability session (captures screenshots to `test-results/`):

```bash
yarn test:e2e tests/e2e/usability
```

### Lint and typecheck

```bash
yarn lint
yarn typecheck
```

## Building and packaging

### Production build

Compiles main, preload, and renderer to `out/`:

```bash
yarn build
```

### Package for macOS

Creates a signed `.app` bundle and `.dmg` in `release/` (requires code-signing certificates for distribution):

```bash
yarn package
```

Alias:

```bash
yarn dist
```

## CLI helper

Install the `markdoc` command-line tool from **Preferences → Install markdoc CLI**, or manually symlink:

```bash
sudo ln -sf "$(pwd)/cli/markdoc" /usr/local/bin/markdoc
```

Usage:

```bash
markdoc notes.md              # Open a file
markdoc doc1.md doc2.md       # Open multiple files
markdoc                       # Activate app / new blank document
markdoc --new-window file.md  # Force new window
```

## Project structure

```
src/
  main/           Electron main process (windows, menus, file I/O, IPC)
  preload/        Secure bridge (window.markdoc API)
  renderer/       React UI (editor, preview, sidebar, toolbar)
  shared/         Types, Markdown utils, export, document index
cli/              markdoc shell helper
tests/
  unit/           Vitest unit tests
  component/      React Testing Library component tests
  e2e/            Playwright Electron integration tests
  fixtures/       Test documents and performance corpus
build/            macOS entitlements and packaging resources
```

## Documentation

| Document | Description |
|----------|-------------|
| [functional-requirements.md](./functional-requirements.md) | What the app must do (FR-x.y) |
| [technical-requirements.md](./technical-requirements.md) | Architecture and implementation (TR-x.y) |
| [testing-requirements.md](./testing-requirements.md) | Test strategy and cases (TC-x.y) |
| [design-guide.md](./design-guide.md) | Visual and interaction design language |

## Key technologies

- **Electron** — native macOS shell, file associations, CLI single-instance hand-off
- **Tiptap / ProseMirror** — WYSIWYG Markdown editor with round-trip serialization
- **Tailwind CSS** — app chrome and content theming via CSS custom properties
- **@dnd-kit** — outline tree drag-and-drop reordering
- **minisearch** — document search with ranked results
- **mermaid** — inline diagram rendering
- **docx** — Word export
- **Vitest + Playwright** — unit/component and E2E testing

## License

MIT
