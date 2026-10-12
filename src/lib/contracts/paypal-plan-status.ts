// @polsia:user-owned
// Shared, client-safe contract for the sanitized PayPal plan check.
import { z } from 'zod';

export const PayPalPlanStatusResponse = z.object({
  mode: z.enum(['live', 'sandbox']),
  status: z.enum(['matched', 'mismatch', 'unverifiable']),
  expected: z.object({
    amount: z.number(),
    currency: z.literal('USD'),
    intervalUnit: z.literal('MONTH'),
    intervalCount: z.literal(1),
  }),
  observed: z
    .object({
      planStatus: z.string(),
      amount: z.string().nullable(),
      currency: z.string().nullable(),
      intervalUnit: z.string().nullable(),
      intervalCount: z.number().nullable(),
      billingCycleCount: z.number(),
      totalCycles: z.number().nullable(),
      trialPresent: z.boolean(),
      setupFeeAmount: z.string().nullable(),
      setupFeeCurrency: z.string().nullable(),
    })
    .nullable(),
  webhookIdConfigured: z.boolean(),
  checkedAt: z.string().datetime(),
  message: z.string(),
});

export type PayPalPlanStatus = z.infer<typeof PayPalPlanStatusResponse>;
