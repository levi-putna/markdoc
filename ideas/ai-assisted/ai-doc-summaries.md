# AI Document Summaries

**Status:** Idea  
**Category:** AI-assisted writing  
**Related:** Section 5 (Outline), [ai-summarize-rewrite](./ai-summarize-rewrite.md), [git-aware-status](../versioning/git-aware-status.md)

## Overview

Beyond selection-level AI, **document-level summaries** help users quickly grasp long notes: auto-generated abstract in frontmatter, outline panel summary, or suggested git commit messages when publishing docs repos.

## User stories

- As a reader, I want a one-paragraph summary at the top of long meeting notes.
- As a developer, I want MarkDoc to suggest a commit message from my doc changes.
- As a user, I want the outline sidebar to show an AI-generated TL;DR (optional).

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-AIS-1.1 | **Summarise document** command generates abstract from full document (opt-in AI). |
| IDEA-AIS-1.2 | Option to insert summary as blockquote at top or write to frontmatter field `summary:`. |
| IDEA-AIS-1.3 | **Outline TL;DR** (optional): collapsible AI summary in sidebar above heading tree. |
| IDEA-AIS-1.4 | With [git-aware-status](../versioning/git-aware-status.md): **Suggest commit message** from diff + document titles in staged files. |
| IDEA-AIS-1.5 | Summaries cached locally with content hash; invalidate on edit. |
| IDEA-AIS-1.6 | User can regenerate or edit summary manually; AI never overwrites without confirmation. |

## Non-functional considerations

- Full-document summary may hit token limits — use outline + section summaries merge strategy for long docs.
- Cache in Application Support, not committed to git unless user inserts into file.

## Open questions

- Batch summarise entire folder for index page?
- Summary language follows frontmatter `lang`?

## Out of scope

- Automatic tagging/classification of vault without user action.

## Privacy

Same opt-in and provider rules as other AI features.
