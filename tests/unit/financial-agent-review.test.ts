import { describe, expect, it } from 'vitest';
import {
  buildFinancialAgentReviewEvent,
  FinancialAgentReviewTransitionError,
  transitionFinancialAgentReview,
} from '@/lib/business/financial-agent-review';

describe('transiciones de revisión de evaluaciones', () => {
  it('inicia la revisión al guardar una entrega pendiente', () => {
    expect(transitionFinancialAgentReview('pending_review', 'saved')).toEqual({
      previousStatus: 'pending_review',
      newStatus: 'in_review',
    });
  });

  it('permite guardar otra vez mientras se revisa y volver a revisar una edición aprobada', () => {
    expect(transitionFinancialAgentReview('in_review', 'saved').newStatus).toBe('in_review');
    expect(transitionFinancialAgentReview('approved', 'saved')).toEqual({
      previousStatus: 'approved',
      newStatus: 'in_review',
    });
  });

  it('aprueba solo un expediente que ya está en revisión', () => {
    expect(transitionFinancialAgentReview('in_review', 'approved')).toEqual({
      previousStatus: 'in_review',
      newStatus: 'approved',
    });
    expect(() => transitionFinancialAgentReview('pending_review', 'approved')).toThrow(
      FinancialAgentReviewTransitionError,
    );
    expect(() => transitionFinancialAgentReview('approved', 'approved')).toThrow(
      FinancialAgentReviewTransitionError,
    );
  });

  it.each([
    {
      description: 'guardar una entrega pendiente',
      action: 'saved' as const,
      previousStatus: 'pending_review' as const,
      newStatus: 'in_review' as const,
    },
    {
      description: 'aprobar un resultado revisado',
      action: 'approved' as const,
      previousStatus: 'in_review' as const,
      newStatus: 'approved' as const,
    },
    {
      description: 'editar un resultado aprobado',
      action: 'saved' as const,
      previousStatus: 'approved' as const,
      newStatus: 'in_review' as const,
    },
  ])('construye un evento auditable al $description', ({ action, previousStatus, newStatus }) => {
    expect(
      buildFinancialAgentReviewEvent({
        submissionId: 'submission-1',
        reviewerUserId: 'reviewer-1',
        action,
        previousStatus,
        newStatus,
        resultSnapshot: 'Resultado de muestra',
      }),
    ).toEqual({
      submissionId: 'submission-1',
      reviewerUserId: 'reviewer-1',
      action,
      previousStatus,
      newStatus,
      resultSnapshot: 'Resultado de muestra',
    });
  });
});
