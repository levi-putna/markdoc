import { cn } from '@renderer/lib/utils'

/**
 * Placeholder shimmer block for loading content.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-xs bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
