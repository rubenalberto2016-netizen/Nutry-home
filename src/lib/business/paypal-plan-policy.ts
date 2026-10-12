// @polsia:user-owned
import { TEAM_MONTHLY_PRICE } from '@/lib/pricing/content';

// Enable only after the owner verifies the merchant's Live account and plan.
export const PAYPAL_LIVE_CHECKOUT_ENABLED = false;

export interface PayPalPlanData {
  id: string;
  status: string;
  billing_cycles: Array<{
    tenure_type: string;
    total_cycles: number;
    frequency: { interval_unit: string; interval_count: number };
    pricing_scheme?: {
      fixed_price?: { value: string; currency_code: string };
    };
  }>;
  payment_preferences?: {
    setup_fee?: { value: string; currency_code: string };
  };
}

function hasExactWholeDollarValue(value: string | undefined, expected: number) {
  if (!value) return false;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return false;
  const [, whole, fraction = ''] = match;
  return Number(whole) === expected && /^0*$/.test(fraction);
}

export function matchesConfiguredMonthlyPlan(plan: PayPalPlanData, expectedPlanId: string) {
  const [cycle] = plan.billing_cycles;
  const fixedPrice = cycle?.pricing_scheme?.fixed_price;
  const setupFee = plan.payment_preferences?.setup_fee;

  return (
    plan.id === expectedPlanId &&
    plan.status === 'ACTIVE' &&
    plan.billing_cycles.length === 1 &&
    cycle?.tenure_type === 'REGULAR' &&
    cycle.total_cycles === 0 &&
    cycle.frequency.interval_unit === 'MONTH' &&
    cycle.frequency.interval_count === 1 &&
    fixedPrice?.currency_code === 'USD' &&
    hasExactWholeDollarValue(fixedPrice.value, TEAM_MONTHLY_PRICE) &&
    (!setupFee || (setupFee.currency_code === 'USD' && hasExactWholeDollarValue(setupFee.value, 0)))
  );
}

export function isPayPalCheckoutAllowed(environment: 'live' | 'sandbox') {
  return environment === 'sandbox' || PAYPAL_LIVE_CHECKOUT_ENABLED;
}
