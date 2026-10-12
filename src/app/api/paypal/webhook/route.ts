// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getPayPalSubscription,
  PayPalNotConfiguredError,
  verifyPayPalWebhook,
} from '@/lib/business/paypal';
import { transitionSubscriptionEvent } from '@/lib/business/workspace-access';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const supportedEvents = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'PAYMENT.SALE.COMPLETED',
]);

const eventSchema = z
  .object({
    id: z.string().min(1),
    event_type: z.string().min(1),
    create_time: z.string().optional(),
    resource: z.record(z.string(), z.unknown()),
  })
  .passthrough();

function stringField(value: unknown, key: string) {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : undefined;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDuplicate(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

async function recordEvent(eventId: string, eventType: string, resourceId: string | null) {
  try {
    await prisma.processedPayPalEvent.create({ data: { eventId, eventType, resourceId } });
  } catch (error) {
    if (!isDuplicate(error)) throw error;
  }
}

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Evento de PayPal no válido.' }, { status: 400 });
  const event = parsed.data;

  const signatureHeaders = {
    'paypal-auth-algo': request.headers.get('paypal-auth-algo') ?? '',
    'paypal-cert-url': request.headers.get('paypal-cert-url') ?? '',
    'paypal-transmission-id': request.headers.get('paypal-transmission-id') ?? '',
    'paypal-transmission-sig': request.headers.get('paypal-transmission-sig') ?? '',
    'paypal-transmission-time': request.headers.get('paypal-transmission-time') ?? '',
  };
  if (Object.values(signatureHeaders).some((value) => !value)) {
    return NextResponse.json({ error: 'Faltan datos de la firma de PayPal.' }, { status: 401 });
  }

  try {
    const signatureValid = await verifyPayPalWebhook(signatureHeaders, {
      ...event,
    });
    if (!signatureValid)
      return NextResponse.json({ error: 'Firma de PayPal no válida.' }, { status: 401 });
  } catch (error) {
    if (error instanceof PayPalNotConfiguredError) {
      return NextResponse.json(
        { error: 'El webhook de PayPal no está configurado.' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: 'No se pudo verificar el evento con PayPal.' },
      { status: 503 },
    );
  }

  if (!supportedEvents.has(event.event_type)) return NextResponse.json({ received: true });

  const resourceId =
    event.event_type === 'PAYMENT.SALE.COMPLETED'
      ? (stringField(event.resource, 'billing_agreement_id') ??
        stringField(event.resource, 'subscription_id'))
      : stringField(event.resource, 'id');
  if (!resourceId)
    return NextResponse.json(
      { error: 'El evento no identifica una suscripción.' },
      { status: 400 },
    );

  try {
    const local = await prisma.workspaceSubscription.findUnique({
      where: { providerSubscriptionId: resourceId },
      include: { workspace: true },
    });
    if (!local) return NextResponse.json({ received: true });

    const remote = await getPayPalSubscription(resourceId);
    if (
      (remote.custom_id && remote.custom_id !== local.workspaceId) ||
      remote.plan_id !== local.planId
    ) {
      await recordEvent(event.id, event.event_type, resourceId);
      return NextResponse.json({ received: true });
    }

    const nextBillingTime = parseDate(remote.billing_info?.next_billing_time);
    const eventTime = parseDate(event.create_time) ?? new Date();
    const lastPaymentAt = parseDate(remote.billing_info?.last_payment?.time) ?? eventTime;
    const providerLastPaymentAt = parseDate(remote.billing_info?.last_payment?.time);
    const ignoredAsOutdated =
      (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' &&
        providerLastPaymentAt !== null &&
        providerLastPaymentAt.getTime() > eventTime.getTime()) ||
      (event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED' && remote.status !== 'SUSPENDED') ||
      (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' && remote.status !== 'CANCELLED');
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.workspaceSubscription.findUnique({
        where: { providerSubscriptionId: resourceId },
      });
      if (!current) return 'unmatched';
      await tx.processedPayPalEvent.create({
        data: { eventId: event.id, eventType: event.event_type, resourceId },
      });
      if (ignoredAsOutdated) return 'outdated';

      const next = transitionSubscriptionEvent(
        current,
        event.event_type,
        remote.status,
        nextBillingTime,
      );
      const saleConfirmed =
        event.event_type === 'PAYMENT.SALE.COMPLETED' &&
        ['ACTIVE', 'CANCELLED'].includes(remote.status);
      await tx.workspaceSubscription.update({
        where: { id: current.id },
        data: {
          status: next.status,
          paidThrough: next.paidThrough,
          lastEventAt:
            current.lastEventAt && current.lastEventAt.getTime() > eventTime.getTime()
              ? current.lastEventAt
              : eventTime,
          ...(saleConfirmed ? { lastPaymentAt } : {}),
        },
      });
      if (saleConfirmed) {
        await tx.financialAgent.updateMany({
          where: { userId: local.workspace.ownerUserId, workspaceId: null, status: 'draft' },
          data: { workspaceId: local.workspaceId },
        });
      }
      return 'processed';
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    if (isDuplicate(error)) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json(
      { error: 'No se pudo procesar el evento confirmado por PayPal.' },
      { status: 503 },
    );
  }
}
