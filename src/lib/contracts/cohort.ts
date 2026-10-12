// @polsia:user-owned
import { z } from 'zod';
import {
  COHORT_DURATION_WEEKS,
  COHORT_MAX_PRICE_USD,
  COHORT_MIN_PRICE_USD,
} from '@/lib/business/cohort-offer';

export const CohortOffer = z.object({
  totalUsd: z.number().int().min(COHORT_MIN_PRICE_USD).max(COHORT_MAX_PRICE_USD),
  durationWeeks: z.literal(COHORT_DURATION_WEEKS),
  minimumUsd: z.literal(COHORT_MIN_PRICE_USD),
  maximumUsd: z.literal(COHORT_MAX_PRICE_USD),
});

export const CohortPriceUpdate = z.object({
  totalUsd: z.number().int().min(COHORT_MIN_PRICE_USD).max(COHORT_MAX_PRICE_USD),
});

export const CohortCheckoutRequest = z.object({
  displayedTotalUsd: z.number().int().min(COHORT_MIN_PRICE_USD).max(COHORT_MAX_PRICE_USD),
});

export const CohortPaymentStatus = z.enum([
  'not_started',
  'pending',
  'unverifiable',
  'failed',
  'cancelled',
  'confirmed',
]);

export const CohortAccessStatus = z.enum(['closed', 'enabled', 'expired']);

export const CohortEnrollmentState = z.object({
  requestStatus: z.enum(['not_started', 'received']),
  paymentStatus: CohortPaymentStatus,
  accessStatus: CohortAccessStatus,
  message: z.string(),
});

export const CohortPaymentConfirmation = z.object({
  sessionId: z.string().min(1).max(255),
});

export const CohortCheckoutCancellation = z.object({
  requestId: z.string().uuid(),
});

export type CohortOffer = z.infer<typeof CohortOffer>;
export type CohortEnrollmentState = z.infer<typeof CohortEnrollmentState>;
