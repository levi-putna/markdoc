export type CostTier = '$' | '$$' | '$$$'

export interface GatewayModelPricing {
  input: string
  output: string
}

export interface GatewayModelInfo {
  id: string
  name: string
  pricing?: GatewayModelPricing
}

/**
 * Parses per-token price string from gateway API to number.
 */
function parseTokenPrice({ price }: { price: string | undefined }): number {
  if (!price) return 0
  const n = Number(price)
  return Number.isFinite(n) ? n : 0
}

/**
 * Combined input + output cost per token for tier comparison.
 */
export function combinedTokenCost({ pricing }: { pricing?: GatewayModelPricing }): number {
  if (!pricing) return 0
  return parseTokenPrice({ price: pricing.input }) + parseTokenPrice({ price: pricing.output })
}

/**
 * Normalises models into relative cost tiers across the enabled set.
 */
export function tierModels({ models }: { models: GatewayModelInfo[] }): Map<string, CostTier> {
  const costs = models
    .map((model) => ({ id: model.id, cost: combinedTokenCost({ pricing: model.pricing }) }))
    .filter((entry) => entry.cost > 0)
    .sort((a, b) => a.cost - b.cost)

  const tiers = new Map<string, CostTier>()
  if (costs.length === 0) {
    for (const model of models) tiers.set(model.id, '$$')
    return tiers
  }

  const third = Math.max(1, Math.ceil(costs.length / 3))
  for (let i = 0; i < costs.length; i += 1) {
    const tier: CostTier = i < third ? '$' : i < third * 2 ? '$$' : '$$$'
    tiers.set(costs[i].id, tier)
  }

  for (const model of models) {
    if (!tiers.has(model.id)) tiers.set(model.id, '$$')
  }

  return tiers
}

/**
 * Formats approximate cost per 1M tokens for tooltips.
 */
export function formatCostTooltip({ pricing }: { pricing?: GatewayModelPricing }): string {
  if (!pricing) return 'Pricing unavailable'
  const input = parseTokenPrice({ price: pricing.input }) * 1_000_000
  const output = parseTokenPrice({ price: pricing.output }) * 1_000_000
  return `~$${input.toFixed(2)} / 1M input, ~$${output.toFixed(2)} / 1M output`
}
