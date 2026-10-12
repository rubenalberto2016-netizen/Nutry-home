// @polsia:user-owned
import 'server-only';
import { z } from 'zod';
import {
  matchesConfiguredMonthlyPlan,
  type PayPalPlanData,
} from '@/lib/business/paypal-plan-policy';
import type { PayPalPlanStatus } from '@/lib/contracts/paypal-plan-status';
import { env } from '@/lib/env';
import { TEAM_MONTHLY_PRICE } from '@/lib/pricing/content';

export {
  isPayPalCheckoutAllowed,
  PAYPAL_LIVE_CHECKOUT_ENABLED,
} from '@/lib/business/paypal-plan-policy';

export class PayPalNotConfiguredError extends Error {}
export class PayPalPlanMismatchError extends Error {}

const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });
const linkSchema = z.object({ rel: z.string(), href: z.string().url() });
const planSchema = z.object({
  id: z.string(),
  status: z.string(),
  billing_cycles: z.array(
    z.object({
      tenure_type: z.string(),
      total_cycles: z.number().int().nonnegative(),
      frequency: z.object({ interval_unit: z.string(), interval_count: z.number() }),
      pricing_scheme: z
        .object({
          fixed_price: z.object({ value: z.string(), currency_code: z.string() }).optional(),
        })
        .optional(),
    }),
  ),
  payment_preferences: z
    .object({
      setup_fee: z.object({ value: z.string(), currency_code: z.string() }).optional(),
    })
    .optional(),
});

const validatedPlanSchema: z.ZodType<PayPalPlanData> = planSchema;

const subscriptionSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    plan_id: z.string(),
    custom_id: z.string().optional(),
    billing_info: z
      .object({
        next_billing_time: z.string().optional(),
        last_payment: z.object({ time: z.string().optional() }).optional(),
      })
      .optional(),
    links: z.array(linkSchema).optional(),
  })
  .passthrough();

const signatureSchema = z.object({ verification_status: z.string() });

export type PayPalSubscription = z.infer<typeof subscriptionSchema>;
export type PayPalEventForVerification = {
  id: string;
  event_type: string;
  resource: unknown;
};

function apiOrigin() {
  return env.PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function hasCredentials() {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

function requireCredentials() {
  if (!hasCredentials()) throw new PayPalNotConfiguredError('PayPal no está configurado.');
  return {
    clientId: env.PAYPAL_CLIENT_ID as string,
    clientSecret: env.PAYPAL_CLIENT_SECRET as string,
  };
}

export function requirePayPalPlanId() {
  if (!env.PAYPAL_PLAN_ID_TEAM_MONTHLY) {
    throw new PayPalNotConfiguredError('Falta configurar el plan mensual de PayPal.');
  }
  return env.PAYPAL_PLAN_ID_TEAM_MONTHLY;
}

function planSummary(plan: PayPalPlanData) {
  const [cycle] = plan.billing_cycles;
  const fixedPrice = cycle?.pricing_scheme?.fixed_price;
  const setupFee = plan.payment_preferences?.setup_fee;
  return {
    planStatus: plan.status,
    amount: fixedPrice?.value ?? null,
    currency: fixedPrice?.currency_code ?? null,
    intervalUnit: cycle?.frequency.interval_unit ?? null,
    intervalCount: cycle?.frequency.interval_count ?? null,
    billingCycleCount: plan.billing_cycles.length,
    totalCycles: cycle?.total_cycles ?? null,
    trialPresent: plan.billing_cycles.some((item) => item.tenure_type === 'TRIAL'),
    setupFeeAmount: setupFee?.value ?? null,
    setupFeeCurrency: setupFee?.currency_code ?? null,
  };
}

async function readConfiguredPlan() {
  const planId = requirePayPalPlanId();
  const token = await accessToken();
  const payload = await paypalRequest<unknown>(
    `/v1/billing/plans/${encodeURIComponent(planId)}`,
    token,
  );
  return { planId, parsedPlan: validatedPlanSchema.safeParse(payload) };
}

export async function getPayPalPlanStatus(): Promise<PayPalPlanStatus> {
  const base = {
    mode: env.PAYPAL_ENVIRONMENT,
    expected: {
      amount: TEAM_MONTHLY_PRICE,
      currency: 'USD' as const,
      intervalUnit: 'MONTH' as const,
      intervalCount: 1 as const,
    },
    webhookIdConfigured: Boolean(env.PAYPAL_WEBHOOK_ID),
  };

  if (!hasCredentials() || !env.PAYPAL_PLAN_ID_TEAM_MONTHLY) {
    return {
      ...base,
      status: 'unverifiable',
      observed: null,
      checkedAt: new Date().toISOString(),
      message: 'Falta configuración para consultar la cuenta y el plan de PayPal.',
    };
  }

  try {
    const { planId, parsedPlan } = await readConfiguredPlan();
    if (!parsedPlan.success) {
      return {
        ...base,
        status: 'unverifiable',
        observed: null,
        checkedAt: new Date().toISOString(),
        message: 'PayPal respondió con datos de plan que no se pudieron validar.',
      };
    }

    const observed = planSummary(parsedPlan.data);
    const matches = matchesConfiguredMonthlyPlan(parsedPlan.data, planId);
    return {
      ...base,
      status: matches ? 'matched' : 'mismatch',
      observed,
      checkedAt: new Date().toISOString(),
      message: matches
        ? `El plan activo coincide con US$${TEAM_MONTHLY_PRICE} USD por mes, con renovación mensual y sin prueba ni tarifa de alta.`
        : `La API respondió, pero el plan no coincide con todas las condiciones de US$${TEAM_MONTHLY_PRICE} USD mensuales.`,
    };
  } catch {
    return {
      ...base,
      status: 'unverifiable',
      observed: null,
      checkedAt: new Date().toISOString(),
      message: 'No fue posible verificar la conexión y el plan con la configuración actual.',
    };
  }
}

async function accessToken() {
  const { clientId, clientSecret } = requireCredentials();
  const response = await fetch(`${apiOrigin()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  const parsed = tokenSchema.safeParse(payload);
  if (!response.ok || !parsed.success) throw new Error('PayPal no respondió correctamente.');
  return parsed.data.access_token;
}

async function paypalRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiOrigin()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error('La solicitud a PayPal no se pudo completar.');
  return payload as T;
}

export async function validateConfiguredMonthlyPlan(planId: string) {
  const { parsedPlan } = await readConfiguredPlan();
  if (!parsedPlan.success || !matchesConfiguredMonthlyPlan(parsedPlan.data, planId)) {
    throw new PayPalPlanMismatchError(
      `El plan PayPal debe estar activo y coincidir con US$${TEAM_MONTHLY_PRICE} USD al mes, sin prueba ni tarifa de alta.`,
    );
  }
}

export async function createPayPalSubscription(input: {
  planId: string;
  requestId: string;
  workspaceId: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const token = await accessToken();
  const payload = await paypalRequest<unknown>('/v1/billing/subscriptions', token, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': input.requestId },
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: input.workspaceId,
      subscriber: { email_address: input.email },
      application_context: {
        brand_name: 'Vardelume',
        locale: 'es-AR',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });
  const subscription = subscriptionSchema.safeParse(payload);
  if (!subscription.success || subscription.data.plan_id !== input.planId) {
    throw new Error('PayPal no devolvió una suscripción válida.');
  }
  return subscription.data;
}

export async function getPayPalSubscription(subscriptionId: string) {
  const token = await accessToken();
  const payload = await paypalRequest<unknown>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    token,
  );
  const subscription = subscriptionSchema.safeParse(payload);
  if (!subscription.success) throw new Error('PayPal devolvió una suscripción no válida.');
  return subscription.data;
}

export async function cancelPayPalSubscription(subscriptionId: string) {
  const token = await accessToken();
  await paypalRequest<unknown>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    token,
    { method: 'POST', body: JSON.stringify({ reason: 'Cancelada por la persona propietaria' }) },
  );
}

export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  event: PayPalEventForVerification,
) {
  const webhookId = env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !hasCredentials()) {
    throw new PayPalNotConfiguredError('Falta configurar el webhook de PayPal.');
  }
  const token = await accessToken();
  const payload = await paypalRequest<unknown>(
    '/v1/notifications/verify-webhook-signature',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: event,
      }),
    },
  );
  const result = signatureSchema.safeParse(payload);
  return result.success && result.data.verification_status === 'SUCCESS';
}
