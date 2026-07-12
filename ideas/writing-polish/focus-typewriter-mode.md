# Focus and Typewriter Mode

**Status:** Idea  
**Category:** Writing polish  
**Related:** [design-guide.md](../../design-guide.md), FR-2.x (Editing)

## Overview

Focus mode and typewriter mode reduce visual distraction while writing. Focus mode dims everything except the current paragraph or section; typewriter mode keeps the active line vertically centred as the user types, mimicking a physical typewriter carriage.

These modes target long-form writers who want a calm, distraction-free surface without leaving MarkDoc's WYSIWYG Markdown workflow.

## User stories

- As a writer, I want surrounding paragraphs dimmed so I can concentrate on the current thought.
- As a writer, I want the cursor to stay vertically centred so I am not always looking at the bottom of the screen.
- As a power user, I want to toggle focus/typewriter modes independently via menu, shortcut, and Preferences.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-FOCUS-1.1 | MarkDoc must offer an optional **Focus mode** that visually de-emphasises (dims or fades) all content except the paragraph or block containing the cursor. |
| IDEA-FOCUS-1.2 | Focus mode scope must be configurable: **paragraph**, **heading section** (current heading through next same-level heading), or **sentence** (future enhancement — paragraph is sufficient for v1 of this feature). |
| IDEA-FOCUS-1.3 | MarkDoc must offer an optional **Typewriter mode** that vertically scrolls the editor so the line containing the cursor remains near the vertical centre of the viewport. |
| IDEA-FOCUS-1.4 | Focus and typewriter modes must be independently toggled and combinable (both on, either on, both off). |
| IDEA-FOCUS-1.5 | Toggles must be available from the View menu, a toolbar control, and keyboard shortcuts (shortcuts user-configurable if [custom-keyboard-shortcuts.md](../power-user/custom-keyboard-shortcuts.md) ships). |
| IDEA-FOCUS-1.6 | Mode state must persist per user preference (default off) and restore on relaunch. |
| IDEA-FOCUS-1.7 | Focus/typewriter modes apply to the WYSIWYG editor only; Preview and raw source mode are unaffected. |
| IDEA-FOCUS-1.8 | Dimming must respect Light/Dark appearance and meet contrast accessibility minimums for the active block (WCAG AA for body text). |

## Non-functional considerations

- Scrolling in typewriter mode must not fight manual scroll — if the user scrolls manually, typewriter follow pauses until the next edit or explicit re-enable.
- Performance: dimming must not trigger full-document repaints on every keystroke; prefer CSS-based opacity on block wrappers.
- Large Document Mode (FR-2.12) must remain responsive with focus mode enabled.

## Open questions

- Should focus follow the nearest heading section when the cursor is inside a list or table cell?
- Should Preview support a read-only focus mode for proofreading?

## Out of scope

- Pomodoro timers, ambient sounds, or other "writing ritual" features.
- Hiding the outline sidebar automatically (could be a separate preference).
