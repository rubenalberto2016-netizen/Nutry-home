// @polsia:user-owned
// Transiciones y registros inmutables del flujo de revisión.
import type {
  FinancialAgentReviewAction,
  FinancialAgentReviewStatus,
} from '@/lib/contracts/financial-agent-review';

export class FinancialAgentReviewTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialAgentReviewTransitionError';
  }
}

export function transitionFinancialAgentReview(
  currentStatus: FinancialAgentReviewStatus,
  action: FinancialAgentReviewAction,
): { previousStatus: FinancialAgentReviewStatus; newStatus: FinancialAgentReviewStatus } {
  if (action === 'saved') {
    return { previousStatus: currentStatus, newStatus: 'in_review' };
  }
  if (currentStatus === 'in_review') {
    return { previousStatus: currentStatus, newStatus: 'approved' };
  }
  throw new FinancialAgentReviewTransitionError(
    'Guarda el resultado antes de aprobar la evaluación.',
  );
}

export function buildFinancialAgentReviewEvent(input: {
  submissionId: string;
  reviewerUserId: string;
  action: FinancialAgentReviewAction;
  previousStatus: FinancialAgentReviewStatus;
  newStatus: FinancialAgentReviewStatus;
  resultSnapshot: string;
}) {
  return {
    submissionId: input.submissionId,
    reviewerUserId: input.reviewerUserId,
    action: input.action,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    resultSnapshot: input.resultSnapshot,
  };
}
