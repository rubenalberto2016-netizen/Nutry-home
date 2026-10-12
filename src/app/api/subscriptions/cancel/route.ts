// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import {
  cancelPayPalSubscription,
  getPayPalSubscription,
  PayPalNotConfiguredError,
} from '@/lib/business/paypal';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { CancellationResult } from '@/lib/contracts/subscriptions';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  const access = await findWorkspaceForUser(user.id);
  if (!access)
    return NextResponse.json({ error: 'No perteneces a un espacio de trabajo.' }, { status: 403 });
  if (!access.isOwner)
    return NextResponse.json(
      { error: 'Solo la persona propietaria puede cancelar.' },
      { status: 403 },
    );
  const subscription = access.subscription;
  if (!subscription || !['ACTIVE', 'PAYMENT_FAILED', 'SUSPENDED'].includes(subscription.status)) {
    return NextResponse.json(
      { error: 'No hay una renovación activa para cancelar.' },
      { status: 409 },
    );
  }
  if (!subscription.providerSubscriptionId) {
    return NextResponse.json(
      { error: 'La suscripción de PayPal no está disponible.' },
      { status: 409 },
    );
  }

  try {
    const remote = await getPayPalSubscription(subscription.providerSubscriptionId);
    if (remote.custom_id && remote.custom_id !== access.workspace.id) {
      return NextResponse.json(
        { error: 'La suscripción no coincide con este espacio.' },
        { status: 409 },
      );
    }
    if (remote.status === 'ACTIVE' || remote.status === 'SUSPENDED') {
      await cancelPayPalSubscription(remote.id);
    } else if (remote.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'PayPal no permite cancelar esta suscripción ahora.' },
        { status: 409 },
      );
    }

    const paidThrough =
      subscription.status === 'ACTIVE' && subscription.lastPaymentAt
        ? subscription.paidThrough
        : null;
    await prisma.workspaceSubscription.update({
      where: { workspaceId: access.workspace.id },
      data: { status: 'CANCELLED', paidThrough },
    });
    return NextResponse.json(
      CancellationResult.parse({
        status: 'cancelled',
        paidThrough: paidThrough?.toISOString() ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof PayPalNotConfiguredError) {
      return NextResponse.json(
        { error: 'La conexión con PayPal no está configurada.' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: 'No se pudo cancelar la renovación en PayPal.' },
      { status: 502 },
    );
  }
}
