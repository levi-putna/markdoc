import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AssistantPanel } from '../../src/renderer/components/AssistantPanel'
import { useDocumentStore } from '../../src/renderer/store/document-store'

const defaultSuggestionProps = {
  pendingSuggestionCount: 0,
  pendingSuggestionIds: [] as string[],
  suggestionResolutions: {},
  onAcceptSuggestion: () => {},
  onRejectSuggestion: () => {},
  onAcceptAllSuggestions: () => {},
  onRejectAllSuggestions: () => {},
  onFocusSuggestion: () => {},
}

describe('AssistantPanel', () => {
  it('shows disabled state when AI is off', () => {
    useDocumentStore.setState({
      preferences: { ...useDocumentStore.getState().preferences, aiEnabled: false },
    })

    render(
      <AssistantPanel
        sessionId="test-session"
        hasSelection={false}
        isDocumentEmpty
        onHeadingClick={() => {}}
        onOpenPreferences={() => {}}
        {...defaultSuggestionProps}
      />
    )

    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument()
    expect(screen.getByText(/AI is disabled/i)).toBeInTheDocument()
  })

  it('shows disclosure prompt when AI is on but not accepted', () => {
    useDocumentStore.setState({
      preferences: {
        ...useDocumentStore.getState().preferences,
        aiEnabled: true,
        aiDisclosureAccepted: false,
      },
    })

    render(
      <AssistantPanel
        sessionId="test-session"
        hasSelection={false}
        isDocumentEmpty={false}
        onHeadingClick={() => {}}
        onOpenPreferences={() => {}}
        {...defaultSuggestionProps}
      />
    )

    expect(screen.getByText(/Accept the AI disclosure/i)).toBeInTheDocument()
  })

  it('shows Chat and History tabs when AI is ready', () => {
    useDocumentStore.setState({
      preferences: {
        ...useDocumentStore.getState().preferences,
        aiEnabled: true,
        aiDisclosureAccepted: true,
      },
    })

    render(
      <AssistantPanel
        sessionId="test-session"
        hasSelection={false}
        isDocumentEmpty={false}
        onHeadingClick={() => {}}
        onOpenPreferences={() => {}}
        {...defaultSuggestionProps}
      />
    )

    expect(screen.getByTestId('assistant-tab-chat')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-tab-history')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-new-chat')).toBeInTheDocument()
  })

  it('loads a selected conversation into chat from history', async () => {
    const olderConversation = {
      id: 'conversation-old',
      title: 'Summarise the intro',
      updatedAt: Date.now() - 60_000,
      isActive: false,
      hasMessages: true,
    }
    const activeConversation = {
      id: 'conversation-active',
      title: 'Rewrite the conclusion',
      updatedAt: Date.now(),
      isActive: true,
      hasMessages: true,
    }

    Object.assign(window.markdoc, {
      getConversation: async () => ({
        conversationId: activeConversation.id,
        title: activeConversation.title,
        messages: [],
      }),
      listConversations: async () => ({
        conversations: [activeConversation, olderConversation],
      }),
      loadConversation: vi.fn(async ({ conversationId }: { conversationId: string }) => ({
        conversationId,
        title: olderConversation.title,
        messages: [
          {
            id: 'message-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Summarise the intro' }],
          },
        ],
      })),
    })

    useDocumentStore.setState({
      preferences: {
        ...useDocumentStore.getState().preferences,
        aiEnabled: true,
        aiDisclosureAccepted: true,
      },
    })

    render(
      <AssistantPanel
        sessionId="test-session"
        hasSelection={false}
        isDocumentEmpty={false}
        onHeadingClick={() => {}}
        onOpenPreferences={() => {}}
        {...defaultSuggestionProps}
      />
    )

    await screen.findByTestId('assistant-tab-history')
    await screen.getByTestId('assistant-tab-history').click()

    expect(await screen.findByText('Select a conversation to load it into Chat.')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-history-item-conversation-old')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    await screen.getByTestId('assistant-history-item-conversation-old').click()

    await waitFor(() => {
      expect(window.markdoc.loadConversation).toHaveBeenCalledWith({
        filePath: null,
        sessionId: 'test-session',
        conversationId: 'conversation-old',
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('assistant-tab-chat')).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('composer action bar shows a single truncated model label and visible submit control', () => {
    useDocumentStore.setState({
      preferences: {
        ...useDocumentStore.getState().preferences,
        aiEnabled: true,
        aiDisclosureAccepted: true,
        enabledModelIds: ['anthropic/claude-3.5-haiku'],
        defaultAssistantModel: 'anthropic/claude-3.5-haiku',
      },
      aiModels: [{ id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' }],
    })

    render(
      <AssistantPanel
        sessionId="test-session"
        hasSelection={false}
        isDocumentEmpty={false}
        onHeadingClick={() => {}}
        onOpenPreferences={() => {}}
        {...defaultSuggestionProps}
      />
    )

    const actions = screen.getByTestId('assistant-composer-actions')
    const submit = screen.getByTestId('assistant-composer-submit')
    const controls = actions.querySelector('.assistant-composer-actions__controls')
    const modelCell = actions.querySelector('.assistant-composer-actions__model')

    const modelTrigger = modelCell?.querySelector('[role="combobox"]')

    expect(actions).toBeInTheDocument()
    expect(controls).toContainElement(submit)
    expect(modelTrigger?.textContent).toContain('Claude 3.5 Haiku')
    expect(modelTrigger?.textContent).not.toMatch(/Claude 3\.5 Haiku[\s\S]*Claude 3\.5 Haiku/)
    expect(modelTrigger?.textContent).not.toContain('$$')
  })
})
