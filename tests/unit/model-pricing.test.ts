import { describe, expect, it } from 'vitest'
import {
  combinedTokenCost,
  formatCostTooltip,
  tierModels,
  type GatewayModelInfo,
} from '../../src/shared/ai/model-pricing'

describe('model-pricing', () => {
  const models: GatewayModelInfo[] = [
    { id: 'cheap', name: 'Cheap', pricing: { input: '0.000001', output: '0.000001' } },
    { id: 'mid', name: 'Mid', pricing: { input: '0.00001', output: '0.00001' } },
    { id: 'dear', name: 'Dear', pricing: { input: '0.0001', output: '0.0001' } },
  ]

  it('computes combined token cost', () => {
    expect(combinedTokenCost({ pricing: models[0].pricing })).toBeGreaterThan(0)
  })

  it('assigns relative tiers across models', () => {
    const tiers = tierModels({ models })
    expect(tiers.get('cheap')).toBe('$')
    expect(tiers.get('dear')).toBe('$$$')
  })

  it('formats cost tooltip', () => {
    const tooltip = formatCostTooltip({ pricing: models[1].pricing })
    expect(tooltip).toContain('1M input')
    expect(tooltip).toContain('1M output')
  })

  it('defaults unknown models to mid tier', () => {
    const tiers = tierModels({ models: [{ id: 'unknown', name: 'Unknown' }] })
    expect(tiers.get('unknown')).toBe('$$')
  })
})
