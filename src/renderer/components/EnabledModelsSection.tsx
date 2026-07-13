import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CostTier, GatewayModelInfo } from '@shared/ai/model-pricing'
import { formatCostTooltip } from '@shared/ai/model-pricing'
import { Button } from '@renderer/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'

/**
 * Resolves catalogue entries for the user's enabled model IDs, including orphans.
 */
function resolveEnabledModels({
  enabledModelIds,
  catalogueModels,
}: {
  enabledModelIds: string[]
  catalogueModels: GatewayModelInfo[]
}): GatewayModelInfo[] {
  return enabledModelIds.map((id) => {
    const model = catalogueModels.find((entry) => entry.id === id)
    return model ?? { id, name: id.split('/').pop() ?? id }
  })
}

/**
 * Table of enabled AI models with add/remove controls and a searchable picker.
 */
export function EnabledModelsSection({
  enabledModelIds,
  catalogueModels,
  costTiers,
  onAddModel,
  onRemoveModel,
}: {
  enabledModelIds: string[]
  catalogueModels: GatewayModelInfo[]
  costTiers: Map<string, CostTier>
  onAddModel: ({ modelId }: { modelId: string }) => void
  onRemoveModel: ({ modelId }: { modelId: string }) => void
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const enabledModels = useMemo(
    () => resolveEnabledModels({ enabledModelIds, catalogueModels }),
    [enabledModelIds, catalogueModels]
  )

  const availableModels = useMemo(
    () => catalogueModels.filter((model) => !enabledModelIds.includes(model.id)),
    [catalogueModels, enabledModelIds]
  )

  const handleAddModel = ({ modelId }: { modelId: string }) => {
    onAddModel({ modelId })
    setAddDialogOpen(false)
  }

  return (
    <div
      className="border-t border-border-subtle pt-4"
      data-testid="pref-ai-enabled-models"
    >
      {/* Section header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Enabled models</h3>
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">
            Models available in the assistant and autocomplete pickers.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Add model"
          disabled={availableModels.length === 0}
          onClick={() => setAddDialogOpen(true)}
          data-testid="pref-ai-add-model"
        >
          <Plus aria-hidden />
        </Button>
      </div>

      {/* Enabled models table */}
      <div className="overflow-hidden rounded-xs border border-border-subtle">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-[color-mix(in_srgb,var(--surface-sidebar)_35%,var(--surface-primary))]">
            <tr>
              <th className="px-3 py-2 font-medium text-content-secondary">Model</th>
              <th className="hidden px-3 py-2 font-medium text-content-secondary sm:table-cell">
                Provider
              </th>
              <th className="px-3 py-2 font-medium text-content-secondary">Cost</th>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {enabledModels.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-xs text-content-secondary"
                >
                  No models enabled. Add a model to use the assistant.
                </td>
              </tr>
            ) : (
              enabledModels.map((model) => {
                const tier = costTiers.get(model.id) ?? '$$'
                const provider = model.id.split('/')[0] ?? model.id

                return (
                  <tr
                    key={model.id}
                    className="border-b border-border-subtle last:border-b-0"
                    data-testid={`pref-ai-model-row-${model.id}`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{model.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-content-secondary sm:hidden">
                        {model.id}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-content-secondary sm:table-cell">
                      {provider}
                    </td>
                    <td
                      className="px-3 py-2 tabular-nums text-content-secondary"
                      title={formatCostTooltip({ pricing: model.pricing })}
                    >
                      {tier}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-content-secondary hover:text-red-600"
                        aria-label={`Remove ${model.name}`}
                        disabled={enabledModelIds.length <= 1}
                        onClick={() => onRemoveModel({ modelId: model.id })}
                        data-testid={`pref-ai-remove-model-${model.id}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Searchable add-model dialog */}
      <CommandDialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <CommandInput placeholder="Search models…" />
        <CommandList>
          <CommandEmpty>No models found.</CommandEmpty>
          <CommandGroup heading="Available models">
            {availableModels.map((model) => {
              const tier = costTiers.get(model.id) ?? '$$'

              return (
                <CommandItem
                  key={model.id}
                  value={`${model.name} ${model.id}`}
                  onSelect={() => handleAddModel({ modelId: model.id })}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{model.name}</span>
                    <span className="truncate font-mono text-xs text-content-secondary">
                      {model.id}
                    </span>
                  </span>
                  <span
                    className="shrink-0 tabular-nums text-content-secondary"
                    title={formatCostTooltip({ pricing: model.pricing })}
                  >
                    {tier}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}
