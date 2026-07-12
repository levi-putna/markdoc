# VoiceOver and Keyboard Accessibility

**Status:** Idea — flagged in functional-requirements Section 17  
**Category:** Power user and accessibility  
**Related:** FR-2.4, design-guide Section 13, testing-requirements QR-5.2

## Overview

MarkDoc should be fully operable with **keyboard alone** and usable with **VoiceOver** — macOS's screen reader. Tiptap/contenteditable apps often struggle here; this feature tracks a formal accessibility commitment beyond ad-hoc testing.

## User stories

- As a VoiceOver user, I want to navigate headings, lists, and links in the editor with rotor controls.
- As a keyboard-only user, I want every toolbar action reachable without a pointer.
- As an organisation, we need WCAG 2.1 AA alignment for editor chrome and preview.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-A11Y-1.1 | All menu commands and toolbar buttons must have keyboard access paths (mnemonics or shortcuts) and visible focus rings. |
| IDEA-A11Y-1.2 | Outline sidebar tree must support arrow-key navigation, expand/collapse, and activate with Enter (FR-4.9 partial). |
| IDEA-A11Y-1.3 | Editor must expose **semantic structure** to accessibility APIs: headings, lists, links, tables with correct roles and labels. |
| IDEA-A11Y-1.4 | VoiceOver must announce formatting changes (e.g. "Heading 2", "Bold on"). |
| IDEA-A11Y-1.5 | Preview pane marked as document landmark; decorative UI hidden from accessibility tree. |
| IDEA-A11Y-1.6 | Preferences, find bar, and modals trap focus appropriately and restore on close. |
| IDEA-A11Y-1.7 | Documented **accessibility statement** listing known limitations (e.g. Vim mode, graph view). |
| IDEA-A11Y-1.8 | Automated a11y checks in CI (axe-core) for renderer components; manual VoiceOver test checklist in testing-requirements. |

## Non-functional considerations

- ProseMirror accessibility plugin or custom NodeView ARIA attributes.
- High contrast and reduced motion respect system settings.

## Open questions

- Formal WCAG conformance target and VPAT?
- Dedicated "Accessibility" Preferences pane for font scaling beyond editor prefs?

## Existing coverage

Section 17 open question on keyboard operability; testing-requirements QR-5.2 VoiceOver testing. Promote IDEA-A11Y items when committing to accessibility as a product pillar.

## Out of scope

- Windows/Linux accessibility (macOS-only app per FR-1.x).
