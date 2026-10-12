// @polsia:user-owned
import type { CheckoutVerificationResult } from '@/lib/stripe-billing/schema';

export type CohortPaymentDecision = 'pending' | 'unverifiable' | 'failed' | 'confirmed';

export function decideCohortPayment(
  verification: CheckoutVerificationResult,
  expectedTotalUsd: number,
): CohortPaymentDecision {
  if (!verification.verified) return 'pending';

  const grossAmountUsd = verification.payment?.gross_amount_usd;
  if (grossAmountUsd === undefined || grossAmountUsd === null) return 'unverifiable';
  return grossAmountUsd === expectedTotalUsd ? 'confirmed' : 'failed';
}

export function canReuseCohortCheckout(status: string) {
  return status === 'PENDING' || status === 'UNVERIFIABLE';
}
