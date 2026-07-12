# Git-Aware Status

**Status:** Idea  
**Category:** Versioning and sharing  
**Related:** FR-5.10 (external file changes), [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md)

## Overview

Many MarkDoc users edit Markdown in **git** repositories. Git-aware UI shows modified/committed status, diffs against HEAD, and optional commit actions — without replacing Terminal or dedicated git clients.

## User stories

- As a developer, I want to see which docs have uncommitted changes in the file tree.
- As a writer, I want a diff view against last commit before I save.
- As a power user, I want to commit from MarkDoc with a message when my notes repo is ready.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-GIT-1.1 | When a document is inside a git repository, MarkDoc must show **git status** in the UI (e.g. dot/badge: modified, untracked, clean). |
| IDEA-GIT-1.2 | File tree (folder workspace) reflects git status per file where index is available. |
| IDEA-GIT-1.3 | **Compare with HEAD** command shows diff of current document vs last committed version. |
| IDEA-GIT-1.4 | Optional: **Commit…** dialog stages current file (or all changed docs in repo) and commits with user message — requires explicit enable in Preferences. |
| IDEA-GIT-1.5 | Git operations via bundled `git` CLI or libgit2; failures show stderr in alert (auth, hooks). |
| IDEA-GIT-1.6 | MarkDoc must not auto-commit; all git writes user-initiated. |
| IDEA-GIT-1.7 | If git not installed, feature hidden with link to install Xcode CLT / Homebrew git. |

## Non-functional considerations

- Status refresh on save, external change (FR-5.10), and optional periodic poll.
- Never embed credentials; use system SSH/agent and existing git config.

## Open questions

- Show branch name in title bar?
- Support partial stage (hunk) or file-level only for v1?

## Out of scope

- Full git GUI (branch merge, rebase, conflict resolver).
- GitHub PR integration.
