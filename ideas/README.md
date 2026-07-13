# MarkDoc — Feature Ideas

This folder captures **proposed features** that are not yet part of the shipped product requirements. Each document follows a lightweight version of the format used in [`functional-requirements.md`](../functional-requirements.md).

These are brainstorming artefacts — not committed scope. Use them to evaluate, prioritise, and eventually promote ideas into the main requirements documents.

## Status legend

| Status | Meaning |
|--------|---------|
| **Idea** | Not started; requirements draft only |
| **Partial** | Some overlap with existing FR/TR coverage |
| **Promoted** | Merged into main requirements (update this README when that happens) |

## Index

### Writing polish

| Document | Summary | Status |
|----------|---------|--------|
| [focus-typewriter-mode.md](./writing-polish/focus-typewriter-mode.md) | Dim surrounding content; optional typewriter scrolling | Idea |
| [word-count-reading-stats.md](./writing-polish/word-count-reading-stats.md) | Status-bar stats, selection counts, reading time | Partial |
| [find-and-replace.md](./writing-polish/find-and-replace.md) | In-document find/replace with regex option | Partial |
| [auto-table-of-contents.md](./writing-polish/auto-table-of-contents.md) | Live TOC block synced to headings | Idea |
| [footnotes-and-inline-math.md](./writing-polish/footnotes-and-inline-math.md) | Footnotes and KaTeX/LaTeX math in editor and preview | Idea |
| [smart-typography.md](./writing-polish/smart-typography.md) | Smart quotes, dashes, list continuation beyond system defaults | Idea |
| [snippets-and-templates.md](./writing-polish/snippets-and-templates.md) | Reusable document and frontmatter templates | Idea |
| [spellcheck-and-grammar.md](./writing-polish/spellcheck-and-grammar.md) | Spellcheck polish and optional grammar checking | Partial |

### Organisation and navigation

| Document | Summary | Status |
|----------|---------|--------|
| [multi-doc-tabs-and-split.md](./organisation/multi-doc-tabs-and-split.md) | Tabs within a window and split editing panes | Idea |
| [folder-workspace-sidebar.md](./organisation/folder-workspace-sidebar.md) | Browse and open files from a folder tree | Idea |
| [recent-files-and-favourites.md](./organisation/recent-files-and-favourites.md) | Recent files list and pinned favourites | Idea |
| [global-folder-search.md](./organisation/global-folder-search.md) | Full-text search across a folder of Markdown files | Idea |

### Knowledge management

| Document | Summary | Status |
|----------|---------|--------|
| [wikilinks.md](./knowledge-management/wikilinks.md) | `[[wikilink]]` cross-document linking with autocomplete | Idea |
| [backlinks-panel.md](./knowledge-management/backlinks-panel.md) | Panel showing documents that link to the current note | Idea |
| [tags-and-tag-browser.md](./knowledge-management/tags-and-tag-browser.md) | Tags in frontmatter/body with browse and filter | Idea |
| [graph-view.md](./knowledge-management/graph-view.md) | Visual graph of linked notes | Idea |

### Versioning and sharing

| Document | Summary | Status |
|----------|---------|--------|
| [local-version-history.md](./versioning/local-version-history.md) | Snapshots, diff view, and restore without cloud sync | Idea |
| [git-aware-status.md](./versioning/git-aware-status.md) | Git status indicators and optional commit from the app | Idea |
| [share-as-html-export.md](./versioning/share-as-html-export.md) | Quick shareable HTML export distinct from full export | Idea |

### Publishing

| Document | Summary | Status |
|----------|---------|--------|
| [presentation-slide-mode.md](./publishing/presentation-slide-mode.md) | Render documents as slideshows (Marp-style) | Idea |
| [custom-css-themes.md](./publishing/custom-css-themes.md) | Global and per-document CSS theme library | Partial |
| [static-site-publish.md](./publishing/static-site-publish.md) | Publish to GitHub Pages, Netlify, or similar | Idea |

### AI-assisted writing

| Document | Summary | Status |
|----------|---------|--------|
| [ai-inline-autocomplete.md](./ai-assisted/ai-inline-autocomplete.md) | Ghost-text continue-writing suggestions | **Promoted** → FR-14.41–FR-14.46 |
| [ai-document-assistant.md](./ai-assisted/ai-document-assistant.md) | Side assistant: chat, Q&A, selection edits, read/write tools, suggestion vs auto | **Promoted** → Section 18 (`functional-requirements.md`) |

### Power user and accessibility

| Document | Summary | Status |
|----------|---------|--------|
| [vim-emacs-keybindings.md](./power-user/vim-emacs-keybindings.md) | Optional Vim or Emacs editing mode | Idea |
| [custom-keyboard-shortcuts.md](./power-user/custom-keyboard-shortcuts.md) | User-remappable keyboard shortcuts | Idea |
| [multiple-cursors.md](./power-user/multiple-cursors.md) | Multiple cursors and block selection | Idea |
| [voiceover-keyboard-accessibility.md](./power-user/voiceover-keyboard-accessibility.md) | Full VoiceOver and keyboard-only operability | Idea |

## Promoting an idea

When an idea is approved for implementation:

1. Merge its requirements into `functional-requirements.md` (and `technical-requirements.md` / `testing-requirements.md` as needed).
2. Update the idea's status to **Promoted** in this README.
3. Optionally archive or link the idea doc from the main requirements section.
