# Static Site Publish

**Status:** Idea  
**Category:** Publishing  
**Related:** Section 12 (Export), [custom-css-themes](./custom-css-themes.md), [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md)

## Overview

Authors who maintain blogs or documentation sites often publish Markdown to **static site generators** (Hugo, Jekyll, Eleventy) or platforms (GitHub Pages, Netlify). MarkDoc can offer a guided **Publish** workflow: export folder to HTML site or push to a configured remote.

## User stories

- As a blogger, I want to export my notes folder as a static HTML site with navigation.
- As a developer, I want to run `Publish to GitHub Pages` after editing docs in MarkDoc.
- As a user, I want publish config stored in the project (e.g. `markdoc.publish.json`).

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-PUB-1.1 | MarkDoc must support **Publish Site…** for an open folder workspace. |
| IDEA-PUB-1.2 | Built-in **static HTML export**: index page, per-file pages, nav from folder structure, applied theme CSS. |
| IDEA-PUB-1.3 | Optional **integrations** (explicit opt-in): GitHub Pages push via `git`, Netlify deploy hook URL, or run user-defined script (`npm run build`). |
| IDEA-PUB-1.4 | Publish config file in workspace root documents output dir, base URL, include/exclude globs, theme. |
| IDEA-PUB-1.5 | Preview publish output locally (Open in Browser) before upload. |
| IDEA-PUB-1.6 | Incremental publish: only changed files rebuilt (hash mtime/content). |
| IDEA-PUB-1.7 | Publish log panel shows success/failure per step; no silent failures. |

## Non-functional considerations

- Credentials via macOS Keychain or git credential helper — never store tokens in plain config.
- Large sites: background job with cancel support.

## Open questions

- First-party Hugo/Jekyll project detection vs generic HTML export only?
- Include wikilink resolution in exported site navigation?

## Out of scope

- MarkDoc-hosted CMS or subscription publishing platform.
- WordPress REST API sync (could be future integration).
