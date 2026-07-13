import type { GatewayModelInfo } from '@shared/ai/model-pricing'
import { DEFAULT_ENABLED_MODEL_IDS } from '@shared/ai/default-models'

const MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

let cachedModels: GatewayModelInfo[] | null = null
let cachedAt: number | null = null

interface GatewayModelsResponse {
  data?: Array<{
    id: string
    name?: string
    pricing?: { input?: string; output?: string }
  }>
}

/**
 * Fetches available models from Vercel AI Gateway.
 */
export async function listGatewayModels({
  apiKey,
  forceRefresh = false,
}: {
  apiKey?: string | null
  forceRefresh?: boolean
}): Promise<{ models: GatewayModelInfo[]; cachedAt: number | null }> {
  const now = Date.now()
  if (!forceRefresh && cachedModels && cachedAt && now - cachedAt < CACHE_TTL_MS) {
    return { models: cachedModels, cachedAt }
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const response = await fetch(MODELS_URL, { headers })
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`)
    }

    const body = (await response.json()) as GatewayModelsResponse
    const models: GatewayModelInfo[] = (body.data ?? []).map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      pricing: model.pricing
        ? { input: model.pricing.input ?? '0', output: model.pricing.output ?? '0' }
        : undefined,
    }))

    if (models.length > 0) {
      cachedModels = models
      cachedAt = now
    }
  } catch {
    // Fall back to defaults when offline
    if (!cachedModels) {
      cachedModels = DEFAULT_ENABLED_MODEL_IDS.map((id) => ({
        id,
        name: id.split('/').pop() ?? id,
      }))
      cachedAt = now
    }
  }

  return { models: cachedModels ?? [], cachedAt }
}

/**
 * Tests the API key with a lightweight models request.
 */
export async function testApiKey({ apiKey }: { apiKey: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })
    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Invalid API key.' }
    }
    if (!response.ok) {
      return { success: false, error: `Gateway returned ${response.status}.` }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not reach the gateway.',
    }
  }
}
