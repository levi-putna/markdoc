# Spellcheck and Grammar

**Status:** Partial — FR-2.11 requires native macOS spellcheck  
**Category:** Writing polish  
**Related:** FR-2.11, Section 14 (Preferences)

## Overview

Spellcheck is table stakes for a writing app. FR-2.11 already requires macOS native spellcheck. This document extends the idea with grammar checking, custom dictionaries, and language selection — features users expect from Typora, Bear, and Word.

## User stories

- As a writer, I want misspelled words underlined with right-click corrections.
- As a bilingual user, I want to set document or app language for spellcheck.
- As a power user, I want to add project terms to a local dictionary so "MarkDoc" is not flagged.

## Functional requirements

| ID | Requirement |
|----|-------------|
| IDEA-SPELL-1.1 | MarkDoc must use **native macOS spellcheck** (red underline, contextual menu suggestions) in the WYSIWYG editor — **required by FR-2.11**. |
| IDEA-SPELL-1.2 | Spellcheck must be toggleable in Preferences (FR-2.11). |
| IDEA-SPELL-1.3 | Extend: **Learn Spelling** / **Ignore Spelling** must add words to the user dictionary (macOS dictionary integration). |
| IDEA-SPELL-1.4 | Extend: per-document **language** override via frontmatter (`lang: en-AU`) or Edit → Spelling and Grammar → language. |
| IDEA-SPELL-1.5 | Optional **grammar checking** via macOS Grammar & Substitutions (if available) or third-party API (explicit opt-in, privacy disclosure). |
| IDEA-SPELL-1.6 | Spellcheck must be disabled in code blocks and inline code by default. |
| IDEA-SPELL-1.7 | Raw source mode must support spellcheck when editable (CodeMirror/SimpleMDE spellcheck attribute). |

## Non-functional considerations

- No document content sent to cloud grammar services without explicit user consent.
- Performance: spellcheck must not block typing on large documents.

## Open questions

- Integrate LanguageTool or similar as optional local/server grammar backend?
- Project-level `.markdoc-dict` word list committed to git repos?

## Existing coverage

FR-2.11 covers core spellcheck and macOS substitutions. Promote IDEA-SPELL-1.3–1.7 when implementing extended spelling features.
