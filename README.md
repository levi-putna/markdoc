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

Creates a signed `.app` bundle and `.dmg` in `release/` (requires code-signing certificates for distribution). The packaged app includes a Quick Look extension so Finder can render Markdown previews when you press Space.

```bash
yarn package
```

Alias:

```bash
yarn dist
```

### Quick Look preview (Finder Spacebar)

MarkDoc embeds a native Quick Look extension that renders `.md`, `.markdown`, `.mdown`, and `.mkd` files as formatted HTML in Finder.

**Build prerequisites**

- Full **Xcode** (not Command Line Tools alone) — `xcodebuild` is required
- **XcodeGen** — install with `brew install xcodegen` (the build script can also download a prebuilt binary automatically)

`yarn package` builds the extension automatically via `yarn build:quicklook` and embeds it into `MarkDoc.app/Contents/PlugIns/`.

**After installing the packaged app**

1. Move `MarkDoc.app` to `/Applications` and launch it once.
2. Register the extension (usually only needed once per install):

   ```bash
   pluginkit -a /Applications/MarkDoc.app/Contents/PlugIns/MarkDocQuickLook.appex
   qlmanage -r && qlmanage -r cache
   killall Finder
   ```

3. Select a Markdown file in Finder and press **Space** to preview.

**Troubleshooting**

- Preview still shows raw text: run `pluginkit -m -p com.apple.quicklook.preview | grep markdoc` to confirm registration; re-run the `pluginkit -a` commands above.
- Fast local test without Finder: `qlmanage -p /path/to/file.md`
- Build only the extension: `yarn build:quicklook`

### Releasing an update

MarkDoc auto-updates itself (see `src/main/auto-updater.ts`) using [`electron-updater`](https://www.electron.build/auto-update), fed from this repository's [GitHub Releases](https://github.com/levi-putna/markdoc/releases) — no separate update server is needed. Every packaged, running copy of the app periodically checks the latest GitHub Release, downloads it in the background if it's newer, and prompts the user to restart once it's ready (never while a document has unsaved changes — see `TR-14.3`).

To cut a release:

1. Bump `"version"` in `package.json` (auto-update compares against this).
2. Create a [GitHub personal access token](https://github.com/settings/tokens) with `repo` scope and export it as `GH_TOKEN`.
3. Export signing/notarization credentials: `CSC_LINK` (path to your Developer ID Application `.p12`), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — read automatically by `electron-builder`/`@electron/notarize`. **Also export `QUICKLOOK_SIGN_IDENTITY`** (e.g. `"Developer ID Application: Your Name (TEAMID)"`) **and `QUICKLOOK_TEAM_ID`** — consumed separately by `macos/scripts/build-quicklook.sh`. Without these two, the Quick Look extension silently falls back to ad-hoc signing, which passes locally but **fails notarization** (no Developer ID cert, no secure timestamp, retains the `get-task-allow` debug entitlement) — this only surfaces at the very end of the build, after Apple's notarization round-trip.
4. Build, sign/notarize, and publish in one step:

   ```bash
   GH_TOKEN=ghp_xxx yarn release
   ```

   This runs `electron-builder --mac --publish always`, which uploads the `.dmg`, `.zip`, and the `latest-mac.yml` update manifest to a new (initially draft) GitHub Release tagged `vX.Y.Z`.
5. Publish the draft release on GitHub once you're happy with it. Existing installs will pick it up on their next background check (or immediately via **MarkDoc → Check for Updates…**).

Auto-update requires the app to be properly code-signed and notarized (`TR-6.3`/`TR-6.4`) — an unsigned build can't verify a signed update (and vice versa), so mixing signed and ad-hoc builds across versions will break updating for anyone on the ad-hoc build.

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
macos/            Quick Look preview extension (Swift)
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

Free and open source under the [MIT License](LICENSE).
