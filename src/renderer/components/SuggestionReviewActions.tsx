import { Check, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

type SuggestionReviewLayout = 'inline' | 'bar' | 'assistant'
type SuggestionReviewStatus = 'pending' | 'accepted' | 'rejected' | 'applied'

interface SuggestionReviewActionsProps {
  layout?: SuggestionReviewLayout
  status?: SuggestionReviewStatus
  onAccept: () => void
  onReject: () => void
  onAcceptAll?: () => void
  onRejectAll?: () => void
  showBatchActions?: boolean
  disabled?: boolean
  acceptLabel?: string
  rejectLabel?: string
}

/**
 * Shared accept / reject controls for AI track-change review.
 */
export function SuggestionReviewActions({
  layout = 'assistant',
  status = 'pending',
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  showBatchActions = false,
  disabled = false,
  acceptLabel = 'Accept',
  rejectLabel = 'Reject',
}: SuggestionReviewActionsProps) {
  if (status === 'accepted') {
    return (
      <span className="suggestion-review-status suggestion-review-status--accepted" data-testid="suggestion-review-status">
        Accepted
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <span className="suggestion-review-status suggestion-review-status--rejected" data-testid="suggestion-review-status">
        Rejected
      </span>
    )
  }

  if (status === 'applied') {
    return (
      <span className="suggestion-review-status suggestion-review-status--applied" data-testid="suggestion-review-status">
        Applied
      </span>
    )
  }

  return (
    <div
      className={cn('suggestion-review-actions', `suggestion-review-actions--${layout}`)}
      data-testid="suggestion-review-actions"
    >
      {/* Primary accept / reject group */}
      <div className="suggestion-review-actions__group" role="group" aria-label="Review change">
        <button
          type="button"
          className="suggestion-review-actions__btn suggestion-review-actions__btn--reject"
          onClick={onReject}
          disabled={disabled}
          data-testid="suggestion-review-reject"
        >
          <X className="size-3 shrink-0" aria-hidden />
          <span>{rejectLabel}</span>
        </button>
        <button
          type="button"
          className="suggestion-review-actions__btn suggestion-review-actions__btn--accept"
          onClick={onAccept}
          disabled={disabled}
          data-testid="suggestion-review-accept"
        >
          <Check className="size-3 shrink-0" aria-hidden />
          <span>{acceptLabel}</span>
        </button>
      </div>

      {/* Batch actions */}
      {showBatchActions && onRejectAll && onAcceptAll ? (
        <div className="suggestion-review-actions__batch">
          <button
            type="button"
            className="suggestion-review-actions__batch-btn"
            onClick={onRejectAll}
            disabled={disabled}
            data-testid="suggestion-review-reject-all"
          >
            Reject all
          </button>
          <button
            type="button"
            className="suggestion-review-actions__batch-btn suggestion-review-actions__batch-btn--accent"
            onClick={onAcceptAll}
            disabled={disabled}
            data-testid="suggestion-review-accept-all"
          >
            Accept all
          </button>
        </div>
      ) : null}
    </div>
  )
}
