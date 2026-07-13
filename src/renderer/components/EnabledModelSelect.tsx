import type { CostTier, GatewayModelInfo } from '@shared/ai/model-pricing'
import { formatCostTooltip } from '@shared/ai/model-pricing'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { formControlWidthClassName } from '@renderer/lib/form-control-styles'

/**
 * Resolves display label for a model ID from the gateway catalogue.
 */
function modelLabel({
  modelId,
  catalogueModels,
  costTiers,
  showCostTier,
}: {
  modelId: string
  catalogueModels: GatewayModelInfo[]
  costTiers: Map<string, CostTier>
  showCostTier: boolean
}): string {
  const model = catalogueModels.find((entry) => entry.id === modelId)
  const name = model?.name ?? modelId.split('/').pop() ?? modelId

  if (!showCostTier) return name

  const tier = costTiers.get(modelId) ?? '$$'
  return `${name} ${tier}`
}

/**
 * Model picker limited to the user's enabled model IDs.
 */
export function EnabledModelSelect({
  id,
  value,
  enabledModelIds,
  catalogueModels,
  costTiers,
  showCostTier = false,
  onValueChange,
  testId,
}: {
  id: string
  value: string
  enabledModelIds: string[]
  catalogueModels: GatewayModelInfo[]
  costTiers: Map<string, CostTier>
  showCostTier?: boolean
  onValueChange: ({ modelId }: { modelId: string }) => void
  testId?: string
}) {
  const selectedLabel = modelLabel({
    modelId: value,
    catalogueModels,
    costTiers,
    showCostTier,
  })

  return (
    <Select
      key={enabledModelIds.join('|')}
      value={value}
      onValueChange={(modelId) => onValueChange({ modelId })}
    >
      <SelectTrigger
        id={id}
        className={formControlWidthClassName}
        data-testid={testId}
      >
        <SelectValue placeholder="Select a model">{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {enabledModelIds.map((modelId) => {
          const model = catalogueModels.find((entry) => entry.id === modelId)
          const label = modelLabel({
            modelId,
            catalogueModels,
            costTiers,
            showCostTier,
          })

          return (
            <SelectItem
              key={modelId}
              value={modelId}
              title={formatCostTooltip({ pricing: model?.pricing })}
            >
              {label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
