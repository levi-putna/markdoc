import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from 'tiptap-markdown'
import type { Extensions, NodeViewRenderer } from '@tiptap/core'
import type { SuggestionOptions } from '@tiptap/suggestion'
import { lowlight } from './code-languages'
import { FootnoteReference, FootnoteDefinition } from './extensions/footnote'
import {
  DefinitionList,
  DefinitionItem,
  DefinitionTerm,
  DefinitionDescription,
} from './extensions/definition-list'
import { HeadingWithId } from './extensions/heading-id'
import {
  createHeadingMentionExtension,
  type HeadingMentionItem,
} from './extensions/heading-mention'

interface CreateTiptapExtensionsOptions {
  /**
   * Attaches the interactive React NodeView (language picker, copy button)
   * to the code-block extension. Only meaningful in the live browser editor —
   * the headless editor used for Markdown round-trip conversion (`shared/markdown.ts`)
   * never mounts a real view, so it opts out to avoid pulling in React rendering.
   */
  codeBlockNodeView?: () => NodeViewRenderer
  /** Override the default Image extension (live editor passes MarkdocImage). */
  imageExtension?: Extensions[number]
  /**
   * Attaches the React NodeView for heading mentions (live label + broken state).
   * Headless parsers omit this.
   */
  headingMentionNodeView?: () => NodeViewRenderer
  /** Live-editor suggestion popup hooks for `@` heading mentions. */
  headingMentionSuggestion?: Partial<SuggestionOptions<HeadingMentionItem>>
}

/**
 * Shared Tiptap extension set used by the live editor and headless parsers.
 * Keeping this identical (bar the optional NodeView) prevents outline/preview
 * drift from extension mismatch.
 */
export function createTiptapExtensions({
  codeBlockNodeView,
  imageExtension,
  headingMentionNodeView,
  headingMentionSuggestion,
}: CreateTiptapExtensionsOptions = {}): Extensions {
  let codeBlock = CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: { class: 'code-block' },
  })

  if (codeBlockNodeView) {
    codeBlock = codeBlock.extend({ addNodeView: codeBlockNodeView })
  }

  let headingMention = createHeadingMentionExtension({
    suggestion: headingMentionSuggestion,
  })

  if (headingMentionNodeView) {
    headingMention = headingMention.extend({ addNodeView: headingMentionNodeView })
  }

  return [
    StarterKit.configure({ codeBlock: false, heading: false }),
    HeadingWithId,
    codeBlock,
    Underline,
    Link.configure({
      openOnClick: false,
      // Leave heading:// links for the headingMention node parser.
      HTMLAttributes: {},
    }),
    imageExtension ?? Image,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    FootnoteReference,
    FootnoteDefinition,
    DefinitionList,
    DefinitionItem,
    DefinitionTerm,
    DefinitionDescription,
    headingMention,
    Markdown.configure({
      html: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ]
}
