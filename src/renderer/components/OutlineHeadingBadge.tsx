interface OutlineHeadingBadgeProps {
  level: number
}

/**
 * Compact heading-level badge shown on every outline tree row (H1–H6).
 */
export function OutlineHeadingBadge({ level }: OutlineHeadingBadgeProps) {
  const clampedLevel = Math.min(Math.max(level, 1), 6)

  return (
    <span
      className={`outline-heading-badge outline-heading-badge--h${clampedLevel}`}
      aria-hidden
      title={`Heading ${clampedLevel}`}
    >
      H{clampedLevel}
    </span>
  )
}
