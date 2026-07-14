import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from '@shared/tiptap-extensions'
import { findHexColors } from '@shared/find-hex-colors'
import { preprocessGfmExtensions } from '@shared/markdown-gfm'

const SAMPLE_MARKDOWN = `The palette is **monochrome-plus-one**.

**Roles**

- \`background\`: Warm paper neutral (\`#F7F7F4\`) for the canvas, pure white (\`#FFFFFF\`) for raised reading surfaces.
- \`primary\` **(indigo** \`#4F46E5\`**)**: Links and buttons.`

describe('findHexColors', () => {
  it('finds hex colour codes in parsed Markdown content', () => {
    const editor = new Editor({
      extensions: createTiptapExtensions(),
      content: preprocessGfmExtensions(SAMPLE_MARKDOWN),
    })

    const decorations = findHexColors({ doc: editor.state.doc }).find()
    expect(decorations).toHaveLength(3)

    editor.destroy()
  })

  it('parses pasted-style Markdown into bullet lists', () => {
    const editor = new Editor({
      extensions: createTiptapExtensions(),
      content: preprocessGfmExtensions(SAMPLE_MARKDOWN),
    })

    const topLevelTypes = editor.state.doc.content.content.map((node) => node.type.name)
    expect(topLevelTypes).toContain('bulletList')

    editor.destroy()
  })
})
