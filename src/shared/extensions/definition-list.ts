import { Node } from '@tiptap/core'

/**
 * Definition list container.
 */
export const DefinitionList = Node.create({
  name: 'definitionList',
  group: 'block',
  content: 'definitionItem+',

  parseHTML() {
    return [{ tag: 'dl.definition-list' }]
  },

  renderHTML() {
    return ['dl', { class: 'definition-list' }, 0]
  },
})

/**
 * Single definition list entry (term + definition paragraphs).
 */
export const DefinitionItem = Node.create({
  name: 'definitionItem',
  group: 'block',
  content: 'definitionTerm definitionDescription',

  parseHTML() {
    return [{ tag: 'div[data-definition-item]' }]
  },

  renderHTML() {
    return ['div', { 'data-definition-item': '' }, 0]
  },
})

/**
 * Definition term line inside a definition item.
 */
export const DefinitionTerm = Node.create({
  name: 'definitionTerm',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'dt' }]
  },

  renderHTML() {
    return ['dt', 0]
  },
})

/**
 * Definition description line inside a definition item.
 */
export const DefinitionDescription = Node.create({
  name: 'definitionDescription',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'dd' }]
  },

  renderHTML() {
    return ['dd', 0]
  },
})
