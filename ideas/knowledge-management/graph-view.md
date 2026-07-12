# Graph View

**Status:** Idea  
**Category:** Knowledge management  
**Related:** [wikilinks](./wikilinks.md), [backlinks-panel](./backlinks-panel.md)

## Overview

A **graph view** visualises notes as nodes and links as edges — helpful for exploring structure in large vaults. Obsidian's graph is the reference UX; MarkDoc would offer a local, read-only visualisation without requiring cloud services.

## User stories

- As a researcher, I want to see how my notes connect and spot orphan notes.
- As a user, I want to click a node in the graph to open that document.
- As a writer, I want to filter the graph by tag or folder.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-GRAPH-1.1 | MarkDoc must provide a **Graph View** for the active folder workspace showing documents as nodes and wikilinks/local links as edges. |
| IDEA-GRAPH-1.2 | Clicking a node opens the corresponding document; hover shows title and link count. |
| IDEA-GRAPH-1.3 | Filters: by folder path, tag, hide orphans, local neighbourhood (N hops from current note). |
| IDEA-GRAPH-1.4 | Layout: force-directed default; pan/zoom; optional pin nodes (manual layout persistence optional v2). |
| IDEA-GRAPH-1.5 | Performance: usable with up to 500 nodes; beyond that show warning and offer filtered subgraph. |
| IDEA-GRAPH-1.6 | Graph opens in dedicated panel or window; does not block editing. |

## Non-functional considerations

- Render with Canvas/WebGL or lightweight SVG; lazy-load graph module.
- No document content leaves the device.

## Open questions

- 3D graph — out of scope for v1?
- Export graph as PNG/SVG?

## Dependencies

- [wikilinks](./wikilinks.md), [folder-workspace-sidebar](../organisation/folder-workspace-sidebar.md), link index from backlinks pipeline.

## Out of scope

- Real-time collaborative graph editing.
- AI-suggested link creation from graph analysis.
