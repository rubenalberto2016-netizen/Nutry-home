// @polsia:user-owned
import { describe, expect, it } from 'vitest';
import {
  isPayPalCheckoutAllowed,
  matchesConfiguredMonthlyPlan,
  PAYPAL_LIVE_CHECKOUT_ENABLED,
  type PayPalPlanData,
} from '@/lib/business/paypal-plan-policy';

const standardCycle = {
  tenure_type: 'REGULAR',
  total_cycles: 0,
  frequency: { interval_unit: 'MONTH', interval_count: 1 },
  pricing_scheme: { fixed_price: { value: '47.00', currency_code: 'USD' } },
} satisfies PayPalPlanData['billing_cycles'][number];

function plan(overrides: Partial<PayPalPlanData> = {}): PayPalPlanData {
  return {
    id: 'P-team-monthly-sample',
    status: 'ACTIVE',
    billing_cycles: [standardCycle],
    ...overrides,
  };
}

describe('contrato del plan mensual de PayPal', () => {
  it('acepta un plan activo de US$47 USD con renovación mensual indefinida y sin cargos extra', () => {
    expect(matchesConfiguredMonthlyPlan(plan(), 'P-team-monthly-sample')).toBe(true);
    expect(
      matchesConfiguredMonthlyPlan(
        plan({
          payment_preferences: {
            setup_fee: { value: '0.00', currency_code: 'USD' },
          },
        }),
        'P-team-monthly-sample',
      ),
    ).toBe(true);
  });

  it.each([
    ['plan inactivo', plan({ status: 'INACTIVE' })],
    [
      'importe distinto',
      plan({
        billing_cycles: [
          { ...standardCycle, pricing_scheme: { fixed_price: { value: '46.99', currency_code: 'USD' } } },
        ],
      }),
    ],
    [
      'moneda distinta',
      plan({
        billing_cycles: [
          { ...standardCycle, pricing_scheme: { fixed_price: { value: '47.00', currency_code: 'EUR' } } },
        ],
      }),
    ],
    [
      'intervalo distinto',
      plan({
        billing_cycles: [
          { ...standardCycle, frequency: { interval_unit: 'WEEK', interval_count: 1 } },
        ],
      }),
    ],
    [
      'frecuencia distinta',
      plan({
        billing_cycles: [
          { ...standardCycle, frequency: { interval_unit: 'MONTH', interval_count: 2 } },
        ],
      }),
    ],
    [
      'ciclo finito',
      plan({ billing_cycles: [{ ...standardCycle, total_cycles: 12 }] }),
    ],
    [
      'prueba gratuita o ciclo adicional',
      plan({ billing_cycles: [standardCycle, { ...standardCycle, tenure_type: 'TRIAL' }] }),
    ],
    [
      'tarifa de alta',
      plan({ payment_preferences: { setup_fee: { value: '1.00', currency_code: 'USD' } } }),
    ],
    [
      'moneda de tarifa de alta distinta',
      plan({ payment_preferences: { setup_fee: { value: '0.00', currency_code: 'EUR' } } }),
    ],
    ['identificador remoto distinto', plan({ id: 'P-other-sample' })],
  ])('rechaza %s', (_caseName, candidate) => {
    expect(matchesConfiguredMonthlyPlan(candidate, 'P-team-monthly-sample')).toBe(false);
  });

  it('mantiene cerrado el checkout Live por defecto y conserva Sandbox', () => {
    expect(PAYPAL_LIVE_CHECKOUT_ENABLED).toBe(false);
    expect(isPayPalCheckoutAllowed('live')).toBe(false);
    expect(isPayPalCheckoutAllowed('sandbox')).toBe(true);
  });
});
