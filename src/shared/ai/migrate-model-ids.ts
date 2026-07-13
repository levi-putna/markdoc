import {
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_AUTOCOMPLETE_MODEL,
  DEFAULT_ENABLED_MODEL_IDS,
} from './default-models'
import type { AppPreferences } from '../ipc'

/**
 * Known deprecated gateway model IDs mapped to supported replacements.
 */
const DEPRECATED_MODEL_REPLACEMENTS: Record<string, string> = {
  'anthropic/claude-3.5-haiku': 'anthropic/claude-haiku-4.5',
  'anthropic/claude-3-5-haiku': 'anthropic/claude-haiku-4.5',
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-sonnet-4.5',
  'anthropic/claude-3-5-sonnet': 'anthropic/claude-sonnet-4.5',
}

/**
 * Replaces a deprecated model ID with its supported successor, if known.
 */
export function replaceDeprecatedModelId({ modelId }: { modelId: string }): string {
  return DEPRECATED_MODEL_REPLACEMENTS[modelId] ?? modelId
}

/**
 * Migrates AI model preferences after gateway catalogue changes or model retirements.
 */
export function migrateAiModelPreferences({
  preferences,
}: {
  preferences: AppPreferences
}): AppPreferences {
  const enabledModelIds = [
    ...new Set(preferences.enabledModelIds.map((id) => replaceDeprecatedModelId({ modelId: id }))),
  ]

  let defaultAssistantModel = replaceDeprecatedModelId({
    modelId: preferences.defaultAssistantModel,
  })
  let defaultAutocompleteModel = replaceDeprecatedModelId({
    modelId: preferences.defaultAutocompleteModel,
  })

  if (!enabledModelIds.includes(defaultAssistantModel)) {
    defaultAssistantModel =
      enabledModelIds.find((id) => id === DEFAULT_ASSISTANT_MODEL) ??
      enabledModelIds[0] ??
      DEFAULT_ASSISTANT_MODEL
  }

  if (!enabledModelIds.includes(defaultAutocompleteModel)) {
    defaultAutocompleteModel =
      enabledModelIds.find((id) => id === DEFAULT_AUTOCOMPLETE_MODEL) ??
      enabledModelIds[0] ??
      DEFAULT_AUTOCOMPLETE_MODEL
  }

  if (enabledModelIds.length === 0) {
    enabledModelIds.push(...DEFAULT_ENABLED_MODEL_IDS)
  }

  const next: AppPreferences = {
    ...preferences,
    enabledModelIds,
    defaultAssistantModel,
    defaultAutocompleteModel,
  }

  const changed =
    next.enabledModelIds.length !== preferences.enabledModelIds.length ||
    next.enabledModelIds.some((id, index) => id !== preferences.enabledModelIds[index]) ||
    next.defaultAssistantModel !== preferences.defaultAssistantModel ||
    next.defaultAutocompleteModel !== preferences.defaultAutocompleteModel

  return changed ? next : preferences
}
