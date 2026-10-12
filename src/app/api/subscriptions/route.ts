// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findCohortAccessForUser } from '@/lib/business/cohort-access';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { SubscriptionOverview } from '@/lib/contracts/subscriptions';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  try {
    const access = await findWorkspaceForUser(user.id);
    const subscription = access?.subscription;
    const cohortAccess = await findCohortAccessForUser(user.id);
    const latestAttempt = access?.workspace
      ? await prisma.cohortPaymentAttempt.findFirst({
          where: { workspaceId: access.workspace.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const paymentStatus = cohortAccess.hasAccess
      ? 'confirmed'
      : latestAttempt
        ? latestAttempt.status === 'CONFIRMED'
          ? 'confirmed'
          : latestAttempt.status === 'CANCELLED'
            ? 'cancelled'
            : latestAttempt.status === 'FAILED'
              ? 'failed'
              : latestAttempt.status === 'UNVERIFIABLE'
                ? 'unverifiable'
                : latestAttempt.status === 'CHECKOUT_UNAVAILABLE'
                  ? 'not_started'
                  : 'pending'
        : subscription?.lastPaymentAt || access?.hasAccess
          ? 'confirmed'
          : subscription?.status === 'PAYMENT_FAILED'
            ? 'failed'
            : subscription?.status === 'PENDING'
              ? 'pending'
              : 'not_started';
    const accessStatus = cohortAccess.hasAccess
      ? 'enabled'
      : (latestAttempt?.status === 'CONFIRMED' &&
            latestAttempt.paidThrough !== null &&
            latestAttempt.paidThrough.getTime() <= Date.now()) ||
          (subscription?.lastPaymentAt !== null &&
            subscription?.lastPaymentAt !== undefined &&
            access?.publicStatus === 'expired')
        ? 'expired'
        : 'closed';
    return NextResponse.json(
      SubscriptionOverview.parse({
        workspaceId: access?.workspace.id ?? null,
        workspaceName: access?.workspace.name ?? null,
        role: access ? (access.isOwner ? 'OWNER' : 'MEMBER') : null,
        isOwner: access?.isOwner ?? false,
        hasAccess: access?.hasAccess ?? false,
        status: access?.publicStatus ?? 'none',
        paidThrough:
          (latestAttempt?.status === 'CONFIRMED'
            ? latestAttempt.paidThrough
            : null
          )?.toISOString() ??
          subscription?.paidThrough?.toISOString() ??
          null,
        canCancel:
          access?.isOwner === true &&
          subscription?.provider === 'PAYPAL' &&
          ['ACTIVE', 'PAYMENT_FAILED', 'SUSPENDED'].includes(subscription?.status ?? '') &&
          Boolean(subscription?.providerSubscriptionId),
        checkoutTotalUsd: latestAttempt?.totalUsd ?? null,
        requestStatus: latestAttempt || subscription ? 'received' : 'not_started',
        paymentStatus,
        accessStatus,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: 'No se pudo consultar el estado del espacio.' },
      { status: 500 },
    );
  }
}
