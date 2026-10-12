import { describe, expect, it } from 'vitest';
import {
  approveFinancialAgentTranslation,
  FinancialAgentTranslationTransitionError,
} from '@/lib/business/financial-agent-translation-state';

describe('aprobación de traducciones jurídicas', () => {
  it('aprueba una propuesta pendiente y registra a la persona revisora y la fecha', () => {
    const approvedAt = new Date('2026-10-02T12:00:00.000Z');
    expect(approveFinancialAgentTranslation('pending', 'admin-user', approvedAt)).toEqual({
      status: 'approved',
      approvedByUserId: 'admin-user',
      approvedAt,
    });
  });

  it('rechaza aprobar una propuesta cuyo estado ya cambió', () => {
    expect(() =>
      approveFinancialAgentTranslation('approved', 'other-admin', new Date()),
    ).toThrow(FinancialAgentTranslationTransitionError);
  });
});
