import { createGateway } from '@ai-sdk/gateway'
import { replaceDeprecatedModelId } from '@shared/ai/migrate-model-ids'
import {
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_AUTOCOMPLETE_MODEL,
} from '@shared/ai/default-models'

/** Maximum tool-loop steps for the document assistant (read → edit → reply). */
export const ASSISTANT_MAX_STEPS = 10

const GATEWAY_FALLBACK_MODEL_IDS = [
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_AUTOCOMPLETE_MODEL,
  'anthropic/claude-haiku-4.5',
  'google/gemini-2.5-flash',
] as const

/**
 * Builds gateway model and routing options for AI SDK `streamText` / `generateText`.
 */
export function buildGatewayStreamOptions({
  apiKey,
  modelId,
}: {
  apiKey: string
  modelId: string
}) {
  const resolvedModelId = replaceDeprecatedModelId({ modelId })
  const gateway = createGateway({ apiKey })
  const fallbackModels = GATEWAY_FALLBACK_MODEL_IDS.filter((id) => id !== resolvedModelId)

  return {
    model: gateway(resolvedModelId),
    providerOptions: {
      gateway: {
        models: [...fallbackModels],
      },
    },
  }
}
