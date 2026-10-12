import { describe, expect, it } from 'vitest';
import { canReuseCohortCheckout, decideCohortPayment } from '@/lib/business/cohort-payment';

describe('decideCohortPayment', () => {
  it('keeps an unverified payment pending even when the amount matches', () => {
    expect(
      decideCohortPayment(
        { verified: false, payment: { amount_usd: 1800, gross_amount_usd: 1800 } },
        1800,
      ),
    ).toBe('pending');
  });

  it('does not confirm a verified session without a buyer-paid gross amount', () => {
    expect(decideCohortPayment({ verified: true, payment: { amount_usd: 1440 } }, 1800)).toBe(
      'unverifiable',
    );
  });

  it('rejects a buyer-paid amount that differs from the saved offer', () => {
    expect(
      decideCohortPayment(
        { verified: true, payment: { amount_usd: 1440, gross_amount_usd: 1800.01 } },
        1800,
      ),
    ).toBe('failed');
  });

  it('confirms only the exact verified buyer-paid total', () => {
    expect(
      decideCohortPayment(
        { verified: true, payment: { amount_usd: 1440, gross_amount_usd: 1800 } },
        1800,
      ),
    ).toBe('confirmed');
  });
});

describe('canReuseCohortCheckout', () => {
  it('reuses pending and unverifiable checkouts but never cancelled checkouts', () => {
    expect(canReuseCohortCheckout('PENDING')).toBe(true);
    expect(canReuseCohortCheckout('UNVERIFIABLE')).toBe(true);
    expect(canReuseCohortCheckout('CANCELLED')).toBe(false);
    expect(canReuseCohortCheckout('FAILED')).toBe(false);
  });
});
