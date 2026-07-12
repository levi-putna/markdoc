# Vim and Emacs Keybindings

**Status:** Idea  
**Category:** Power user and accessibility  
**Related:** FR-2.6 (keyboard shortcuts), [custom-keyboard-shortcuts](./custom-keyboard-shortcuts.md)

## Overview

Power users often expect **Vim** or **Emacs** editing modes in text-heavy apps. Tiptap/ProseMirror can integrate vim keymaps (e.g. `@tiptap/extension-vim` or codemirror vim in source mode) as an optional editing mode.

## User stories

- As a Vim user, I want normal/insert modes and `hjkl` navigation in the editor.
- As an Emacs user, I want C-n/C-p line movement and C-a/C-e line start/end.
- As a user, I want modal editing disabled by default and toggled in Preferences.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-VIM-1.1 | MarkDoc may offer optional **Vim mode** for WYSIWYG editor (normal/insert/visual); default off. |
| IDEA-VIM-1.2 | Essential Vim bindings: mode switching, motion, dd/yy/p, / search, v visual, text objects (paragraph, word) where ProseMirror allows. |
| IDEA-VIM-1.3 | Optional **Emacs mode** alternative keymap (mutually exclusive with Vim mode). |
| IDEA-VIM-1.4 | Mode indicator in status bar (e.g. `-- NORMAL --`). |
| IDEA-VIM-1.5 | Vim mode in **raw source mode** via CodeMirror Vim binding (may ship before WYSIWYG vim). |
| IDEA-VIM-1.6 | Mac-standard shortcuts (⌘C, ⌘V, ⌘Z) remain available in insert mode; ⌘ conflicts documented. |
| IDEA-VIM-1.7 | Escape from Vim normal mode must not conflict with closing modals — context-aware Esc routing. |

## Non-functional considerations

- Tiptap vim extension maturity and Markdown node edge cases (lists, tables) need thorough test matrix.
- Accessibility: Vim mode is pointer-optional but not VoiceOver-friendly — warn in Preferences.

## Open questions

- Which vim plugin/library for ProseMirror v2?
- Support `.vimrc` user overrides?

## Out of scope

- Full Vim ex-command line.

## Dependencies

- Partial overlap with [custom-keyboard-shortcuts](./custom-keyboard-shortcuts.md) for non-modal rebinding.
