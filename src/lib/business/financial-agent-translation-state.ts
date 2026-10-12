// @polsia:user-owned
// Transiciones puras de las propuestas de traducción jurídica.
import type { FinancialAgentTranslationStatus } from '@/lib/contracts/financial-agent-translations';

export class FinancialAgentTranslationTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialAgentTranslationTransitionError';
  }
}

export function approveFinancialAgentTranslation(
  status: FinancialAgentTranslationStatus,
  reviewerUserId: string,
  approvedAt: Date,
) {
  if (status !== 'pending') {
    throw new FinancialAgentTranslationTransitionError(
      'La propuesta ya cambió de estado. Recarga el expediente.',
    );
  }

  return {
    status: 'approved' as const,
    approvedByUserId: reviewerUserId,
    approvedAt,
  };
}
