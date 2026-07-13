import { describe, expect, it } from 'vitest'
import { migrateAiModelPreferences, replaceDeprecatedModelId } from '../../src/shared/ai/migrate-model-ids'
import { DEFAULT_PREFERENCES } from '../../src/shared/ipc'

describe('migrate-model-ids', () => {
  it('replaces retired Claude 3.5 Haiku with Claude Haiku 4.5', () => {
    expect(replaceDeprecatedModelId({ modelId: 'anthropic/claude-3.5-haiku' })).toBe(
      'anthropic/claude-haiku-4.5'
    )
  })

  it('migrates default assistant model and enabled list', () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      enabledModelIds: [
        'anthropic/claude-sonnet-4.5',
        'anthropic/claude-3.5-haiku',
      ],
      defaultAssistantModel: 'anthropic/claude-3.5-haiku',
      defaultAutocompleteModel: 'anthropic/claude-3.5-haiku',
    }

    const migrated = migrateAiModelPreferences({ preferences })

    expect(migrated.enabledModelIds).toEqual([
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-haiku-4.5',
    ])
    expect(migrated.defaultAssistantModel).toBe('anthropic/claude-haiku-4.5')
    expect(migrated.defaultAutocompleteModel).toBe('anthropic/claude-haiku-4.5')
  })

  it('returns the same object when no migration is needed', () => {
    const migrated = migrateAiModelPreferences({ preferences: DEFAULT_PREFERENCES })
    expect(migrated).toBe(DEFAULT_PREFERENCES)
  })
})
