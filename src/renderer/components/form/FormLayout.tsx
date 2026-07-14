import type { ReactNode } from 'react'
import {
  formCalloutClassName,
  formChoiceCardClassName,
  formChoiceCardSelectedClassName,
  formExampleBadgeClassName,
  formExampleBlockClassName,
  formExampleTextClassName,
  formFieldDescriptionClassName,
  formFieldInnerStackClassName,
  formFieldLabelClassName,
  formSectionLegendClassName,
  formSectionTitleClassName,
  formToggleRowClassName,
} from '@renderer/lib/form-control-styles'

/**
 * Grouped form section with an accessible heading.
 */
export function FormSection({
  title,
  id,
  description,
  children,
  className = '',
}: {
  title: string
  id: string
  /** Optional helper copy under the title — clarifies the section’s job. */
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={className}>
      {/* Section heading */}
      <h2 id={id} className={description ? formSectionTitleClassName : `mb-2 ${formSectionTitleClassName}`}>
        {title}
      </h2>
      {description && (
        <p className={`mt-0.5 mb-2 ${formFieldDescriptionClassName}`}>{description}</p>
      )}
      {children}
    </section>
  )
}

/**
 * Stacked label-above-control field for narrow panels and dialogs.
 */
export function FormField({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string
  description?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className={formFieldInnerStackClassName}>
      <label htmlFor={htmlFor} className={formFieldLabelClassName}>
        {label}
      </label>
      {description && <p className={formFieldDescriptionClassName}>{description}</p>}
      {children}
    </div>
  )
}

/**
 * Bordered row pairing a label with a switch or compact control.
 */
export function FormToggleRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className={formToggleRowClassName}>
      <label htmlFor={htmlFor} className="text-sm text-content-text">
        {label}
      </label>
      {children}
    </div>
  )
}

/**
 * Fieldset wrapper for a group of selectable cards (radio/checkbox pattern).
 */
export function FormChoiceGroup({
  legend,
  description,
  hideLegend = false,
  children,
}: {
  legend: string
  /** Optional helper copy under the visible legend. */
  description?: string
  /**
   * Hide the visible legend when a parent FormSection title already names the group.
   * The legend remains available to assistive tech.
   */
  hideLegend?: boolean
  children: ReactNode
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? 'sr-only' : `mb-1.5 ${formSectionLegendClassName}`}>
        {legend}
      </legend>
      {description && (
        <p className={`mb-1.5 ${formFieldDescriptionClassName}`}>{description}</p>
      )}
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  )
}

/**
 * Single selectable card within a FormChoiceGroup — label left, radio right.
 */
export function FormChoiceCard({
  name,
  value,
  label,
  description,
  example,
  checked,
  onChange,
}: {
  name: string
  value: string
  label: string
  description?: string
  /** Illustrative sample shown in monospace beneath the description. */
  example?: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      className={`${formChoiceCardClassName} ${checked ? formChoiceCardSelectedClassName : ''}`}
    >
      {/* Option copy */}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-content-text">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-content-secondary">
            {description}
          </span>
        )}
        {example && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <span className={formExampleBadgeClassName}>e.g.</span>
            <span className={formExampleTextClassName}>{example}</span>
          </span>
        )}
      </span>

      {/* Selection control */}
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-3.5 shrink-0 accent-brand"
        aria-label={label}
      />
    </label>
  )
}

/**
 * Inline illustrative sample — monospace value with an optional prefix badge.
 */
export function FormExampleText({
  children,
  badge = 'e.g.',
}: {
  children: ReactNode
  badge?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {badge && <span className={formExampleBadgeClassName}>{badge}</span>}
      <span className={formExampleTextClassName}>{children}</span>
    </span>
  )
}

/**
 * Read-only illustrative block — dashed border and Example badge so it reads as a sample, not a control.
 */
export function FormExamplePreview({
  title = 'Sample output',
  children,
  testId,
}: {
  title?: string
  children: ReactNode
  testId?: string
}) {
  return (
    <div
      className={formExampleBlockClassName}
      data-testid={testId}
      aria-label={`${title} (example)`}
    >
      {/* Example header */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className={formExampleBadgeClassName}>Example</span>
        <span className="text-xs font-medium text-content-secondary">{title}</span>
      </div>
      {children}
    </div>
  )
}

/**
 * Read-only preview or informational callout block.
 */
export function FormCallout({
  title,
  children,
  testId,
}: {
  title?: string
  children: ReactNode
  testId?: string
}) {
  return (
    <div className={formCalloutClassName} data-testid={testId}>
      {title && <p className={`mb-1 ${formSectionLegendClassName}`}>{title}</p>}
      {children}
    </div>
  )
}
