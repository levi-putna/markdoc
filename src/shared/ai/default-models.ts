/**
 * Curated default Vercel AI Gateway models (FR-14.5).
 * Validate against live catalogue at runtime.
 */
export const DEFAULT_ENABLED_MODEL_IDS = [
  'anthropic/claude-opus-4.6',
  'openai/gpt-5',
  'openai/o3',
  'google/gemini-2.5-pro',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-4o-mini',
  'google/gemini-2.5-flash',
] as const

export const DEFAULT_ASSISTANT_MODEL = 'anthropic/claude-sonnet-4.5'

export const DEFAULT_AUTOCOMPLETE_MODEL = 'google/gemini-2.5-flash'
