import { create } from 'zustand'
import type { ViewMode, AppPreferences, RightPanel } from '@shared/ipc'
import type { OutlineNode, DocumentSizeTier } from '@shared/types'
import type { GatewayModelInfo } from '@shared/ai/model-pricing'
import { DEFAULT_PREFERENCES } from '@shared/ipc'
import {
  DEFAULT_NUMBERING_CONFIG,
  type HeadingNumberingOverride,
  type NumberingConfig,
} from '@shared/heading-numbering'

interface DocumentState {
  filePath: string | null
  markdown: string
  frontMatter: Record<string, unknown>
  isDirty: boolean
  viewMode: ViewMode
  sidebarVisible: boolean
  sidebarWidth: number
  outline: OutlineNode[]
  activeHeadingId: string | null
  collapsedOutlineIds: Set<string>
  wordCount: number
  charCount: number
  readingTimeMinutes: number
  documentTier: DocumentSizeTier
  largeDocModeDismissed: boolean
  preferences: AppPreferences
  searchOpen: boolean
  findReplaceOpen: boolean
  stylePanelOpen: boolean
  showSource: boolean
  styleOverrides: Record<string, string>
  brokenImages: Array<{ src: string; line: number }>
  highlightRange: { from: number; to: number } | null
  /** Mutually exclusive right dock: assistant or document options. */
  rightPanel: RightPanel
  rightPanelWidth: number
  pendingSuggestionCount: number
  pendingSuggestionIds: string[]
  suggestionResolutions: Record<string, 'accepted' | 'rejected'>
  aiModels: GatewayModelInfo[]
  documentSessionId: string
  numberingConfig: NumberingConfig
  numberingOverrides: Record<string, HeadingNumberingOverride>
  /** Computed display labels keyed by headingId (derived, not persisted). */
  headingNumbers: Record<string, string>
}

interface DocumentActions {
  setFilePath: (path: string | null) => void
  setMarkdown: (markdown: string) => void
  setFrontMatter: (fm: Record<string, unknown>) => void
  setDirty: (dirty: boolean) => void
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setOutline: (outline: OutlineNode[]) => void
  setActiveHeadingId: (id: string | null) => void
  toggleOutlineCollapse: (id: string) => void
  expandAllOutline: () => void
  collapseAllOutline: () => void
  setWordCount: (count: number) => void
  setCharCount: (count: number) => void
  setReadingTimeMinutes: (minutes: number) => void
  setDocumentTier: (tier: DocumentSizeTier) => void
  dismissLargeDocMode: () => void
  setPreferences: (prefs: Partial<AppPreferences>) => void
  setSearchOpen: (open: boolean) => void
  setFindReplaceOpen: (open: boolean) => void
  setStylePanelOpen: (open: boolean) => void
  setShowSource: (show: boolean) => void
  setStyleOverrides: (overrides: Record<string, string>) => void
  setBrokenImages: (images: Array<{ src: string; line: number }>) => void
  setHighlightRange: (range: { from: number; to: number } | null) => void
  openRightPanel: (panel: Exclude<RightPanel, null>) => void
  toggleRightPanel: (panel: Exclude<RightPanel, null>) => void
  closeRightPanel: () => void
  setRightPanelWidth: (width: number) => void
  /** @deprecated Prefer openRightPanel('assistant') — kept for call-site migration. */
  setAssistantVisible: (visible: boolean) => void
  setPendingSuggestionCount: (count: number) => void
  setPendingSuggestionIds: (ids: string[]) => void
  setSuggestionResolution: ({
    suggestionId,
    status,
  }: {
    suggestionId: string
    status: 'accepted' | 'rejected'
  }) => void
  recordSuggestionResolutions: ({
    suggestionIds,
    status,
  }: {
    suggestionIds: string[]
    status: 'accepted' | 'rejected'
  }) => void
  clearSuggestionResolutions: () => void
  setAiModels: (models: GatewayModelInfo[]) => void
  setNumberingConfig: (config: NumberingConfig) => void
  setNumberingOverrides: (overrides: Record<string, HeadingNumberingOverride>) => void
  setHeadingNumberingOverride: ({
    headingId,
    override,
  }: {
    headingId: string
    override: HeadingNumberingOverride | null
  }) => void
  setHeadingNumbers: (numbers: Record<string, string>) => void
  reset: () => void
}

const initialState: DocumentState = {
  filePath: null,
  markdown: '',
  frontMatter: {},
  isDirty: false,
  viewMode: 'edit',
  sidebarVisible: true,
  sidebarWidth: 240,
  outline: [],
  activeHeadingId: null,
  collapsedOutlineIds: new Set(),
  wordCount: 0,
  charCount: 0,
  readingTimeMinutes: 1,
  documentTier: 'standard',
  largeDocModeDismissed: false,
  preferences: DEFAULT_PREFERENCES,
  searchOpen: false,
  findReplaceOpen: false,
  stylePanelOpen: false,
  showSource: false,
  styleOverrides: {},
  brokenImages: [],
  highlightRange: null,
  rightPanel: null,
  rightPanelWidth: 320,
  pendingSuggestionCount: 0,
  pendingSuggestionIds: [],
  suggestionResolutions: {},
  aiModels: [],
  documentSessionId: crypto.randomUUID(),
  numberingConfig: { ...DEFAULT_NUMBERING_CONFIG },
  numberingOverrides: {},
  headingNumbers: {},
}

/**
 * Per-window document and UI state store.
 */
export const useDocumentStore = create<DocumentState & DocumentActions>((set) => ({
  ...initialState,

  setFilePath: (path) => set({ filePath: path }),
  setMarkdown: (markdown) => set({ markdown, isDirty: true }),
  setFrontMatter: (fm) => set({ frontMatter: fm }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setOutline: (outline) => set({ outline }),
  setActiveHeadingId: (id) => set({ activeHeadingId: id }),
  toggleOutlineCollapse: (id) =>
    set((s) => {
      const next = new Set(s.collapsedOutlineIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsedOutlineIds: next }
    }),
  expandAllOutline: () => set({ collapsedOutlineIds: new Set() }),
  collapseAllOutline: () =>
    set((s) => {
      const allIds = new Set<string>()
      const collect = (nodes: OutlineNode[]) => {
        for (const n of nodes) {
          if (n.children.length > 0) allIds.add(n.id)
          collect(n.children)
        }
      }
      collect(s.outline)
      return { collapsedOutlineIds: allIds }
    }),
  setWordCount: (count) => set({ wordCount: count }),
  setCharCount: (count) => set({ charCount: count }),
  setReadingTimeMinutes: (minutes) => set({ readingTimeMinutes: minutes }),
  setDocumentTier: (tier) => set({ documentTier: tier, largeDocModeDismissed: false }),
  dismissLargeDocMode: () => set({ largeDocModeDismissed: true }),
  setPreferences: (prefs) => set((s) => ({ preferences: { ...s.preferences, ...prefs } })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),
  setStylePanelOpen: (open) => set({ stylePanelOpen: open }),
  setShowSource: (show) => set({ showSource: show }),
  setStyleOverrides: (overrides) => set({ styleOverrides: overrides }),
  setBrokenImages: (images) => set({ brokenImages: images }),
  setHighlightRange: (range) => set({ highlightRange: range }),
  openRightPanel: (panel) => set({ rightPanel: panel }),
  toggleRightPanel: (panel) =>
    set((s) => ({ rightPanel: s.rightPanel === panel ? null : panel })),
  closeRightPanel: () => set({ rightPanel: null }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
  setAssistantVisible: (visible) => set({ rightPanel: visible ? 'assistant' : null }),
  setPendingSuggestionCount: (count) => set({ pendingSuggestionCount: count }),
  setPendingSuggestionIds: (ids) => set({ pendingSuggestionIds: ids }),
  setSuggestionResolution: ({ suggestionId, status }) =>
    set((state) => ({
      suggestionResolutions: { ...state.suggestionResolutions, [suggestionId]: status },
    })),
  recordSuggestionResolutions: ({ suggestionIds, status }) =>
    set((state) => ({
      suggestionResolutions: {
        ...state.suggestionResolutions,
        ...Object.fromEntries(suggestionIds.map((suggestionId) => [suggestionId, status])),
      },
    })),
  clearSuggestionResolutions: () => set({ suggestionResolutions: {} }),
  setAiModels: (models) => set({ aiModels: models }),
  setNumberingConfig: (config) => set({ numberingConfig: config }),
  setNumberingOverrides: (overrides) => set({ numberingOverrides: overrides }),
  setHeadingNumberingOverride: ({ headingId, override }) =>
    set((s) => {
      const next = { ...s.numberingOverrides }
      if (override === null) {
        delete next[headingId]
      } else {
        next[headingId] = override
      }
      return { numberingOverrides: next }
    }),
  setHeadingNumbers: (numbers) => set({ headingNumbers: numbers }),
  reset: () =>
    set({
      ...initialState,
      collapsedOutlineIds: new Set(),
      documentSessionId: crypto.randomUUID(),
      numberingConfig: { ...DEFAULT_NUMBERING_CONFIG },
      numberingOverrides: {},
      headingNumbers: {},
    }),
}))
