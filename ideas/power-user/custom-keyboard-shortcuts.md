# Custom Keyboard Shortcuts

**Status:** Idea  
**Category:** Power user and accessibility  
**Related:** FR-2.6, design-guide keyboard conventions

## Overview

Users expect to **remap keyboard shortcuts** for common commands (bold, save, toggle preview, focus mode). macOS apps often expose this in Preferences; MarkDoc should allow customisation without conflicting with system-reserved shortcuts.

## User stories

- As a power user, I want ⌘⇧B for bold instead of the default.
- As a migrator from Typora, I want to import a shortcut preset.
- As a user, I want to reset all shortcuts to defaults.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-KEYS-1.1 | MarkDoc must provide **Keyboard Shortcuts** in Preferences listing actionable commands with current binding. |
| IDEA-KEYS-1.2 | User can click a shortcut and record new key combination; conflicts show warning with override or cancel. |
| IDEA-KEYS-1.3 | **Reset to defaults** per command or globally. |
| IDEA-KEYS-1.4 | Shortcuts apply to main window commands; editor-specific bindings (e.g. bold) routed to focused editor. |
| IDEA-KEYS-1.5 | Menu items display current shortcut dynamically from binding registry. |
| IDEA-KEYS-1.5a | Optional **import/export** shortcuts JSON for backup or Typora-like presets. |
| IDEA-KEYS-1.6 | Reserved shortcuts (⌘Q, ⌘W, ⌘Tab) cannot be remapped. |

## Non-functional considerations

- Persist bindings in user preferences; sync not required.
- Electron accelerator registration on change without app restart if possible.

## Open questions

- Chord sequences (e.g. ⌘K then ⌘B) support?
- Per-profile shortcuts for Vim vs default mode?

## Out of scope

- Mouse gesture customisation.
