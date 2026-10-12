// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findCohortAccessForUser } from '@/lib/business/cohort-access';
import { COHORT_DURATION_WEEKS } from '@/lib/business/cohort-offer';
import { decideCohortPayment } from '@/lib/business/cohort-payment';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { CohortEnrollmentState, CohortPaymentConfirmation } from '@/lib/contracts/cohort';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { verifyCheckoutSession } from '@/lib/stripe-billing/client';
import type { CheckoutVerificationResult } from '@/lib/stripe-billing/schema';

export const dynamic = 'force-dynamic';

function enrollmentState(
  paymentStatus: 'pending' | 'unverifiable' | 'failed' | 'confirmed' | 'cancelled',
  accessStatus: 'closed' | 'enabled' | 'expired',
  message: string,
) {
  return CohortEnrollmentState.parse({
    requestStatus: 'received',
    paymentStatus,
    accessStatus,
    message,
  });
}

export async function POST(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  const parsed = CohortPaymentConfirmation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Falta el identificador de la sesión de pago.' },
      { status: 400 },
    );
  }

  const access = await findWorkspaceForUser(user.id);
  if (!access?.isOwner) {
    return NextResponse.json(
      { error: 'No encontramos una solicitud de inscripción para esta cuenta.' },
      { status: 404 },
    );
  }
  const attempt = await prisma.cohortPaymentAttempt.findFirst({
    where: {
      checkoutSessionId: parsed.data.sessionId,
      userId: user.id,
      workspaceId: access.workspace.id,
    },
  });
  if (!attempt) {
    return NextResponse.json(
      { error: 'La sesión no coincide con una solicitud de esta cuenta.' },
      { status: 404 },
    );
  }

  if (attempt.status === 'CONFIRMED') {
    const current = await findCohortAccessForUser(user.id);
    const accessStatus = current?.hasAccess
      ? 'enabled'
      : attempt.paidThrough && attempt.paidThrough.getTime() <= Date.now()
        ? 'expired'
        : 'closed';
    return NextResponse.json(
      enrollmentState(
        'confirmed',
        accessStatus,
        current?.hasAccess
          ? 'Pago confirmado. El acceso al programa está habilitado.'
          : accessStatus === 'expired'
            ? 'El pago fue confirmado; el período de acceso de esta cohorte terminó.'
            : 'El pago se confirmó, pero el espacio todavía no está habilitado. Vuelve a comprobar el estado.',
      ),
    );
  }

  let verification: CheckoutVerificationResult;
  try {
    verification = await verifyCheckoutSession({ sessionId: parsed.data.sessionId });
  } catch {
    await prisma.cohortPaymentAttempt.updateMany({
      where: { id: attempt.id, status: { not: 'CONFIRMED' } },
      data: { status: attempt.status === 'CANCELLED' ? 'CANCELLED' : 'UNVERIFIABLE' },
    });
    return NextResponse.json(
      enrollmentState(
        'unverifiable',
        'closed',
        'Polsia no pudo verificar el pago en este momento. La solicitud sigue recibida y el acceso permanece cerrado; puedes volver a comprobarlo.',
      ),
    );
  }

  const decision = decideCohortPayment(verification, attempt.totalUsd);
  if (decision === 'pending') {
    const paymentStatus = attempt.status === 'CANCELLED' ? 'cancelled' : 'pending';
    const message =
      paymentStatus === 'cancelled'
        ? 'El checkout se canceló. La solicitud permanece recibida y el acceso sigue cerrado.'
        : 'La solicitud fue recibida, pero Polsia todavía no confirma el pago. El acceso permanece cerrado.';
    return NextResponse.json(enrollmentState(paymentStatus, 'closed', message));
  }

  if (decision === 'unverifiable') {
    await prisma.cohortPaymentAttempt.updateMany({
      where: { id: attempt.id, status: { not: 'CONFIRMED' } },
      data: { status: 'UNVERIFIABLE' },
    });
    return NextResponse.json(
      enrollmentState(
        'unverifiable',
        'closed',
        'Polsia confirmó una sesión, pero no informó el importe bruto necesario para validar esta inscripción. El acceso permanece cerrado.',
      ),
    );
  }
  if (decision === 'failed') {
    await prisma.cohortPaymentAttempt.updateMany({
      where: { id: attempt.id, status: { not: 'CONFIRMED' } },
      data: { status: 'FAILED', verifiedAt: new Date() },
    });
    return NextResponse.json(
      enrollmentState(
        'failed',
        'closed',
        'El importe confirmado no coincide con el total de esta inscripción. El acceso permanece cerrado; contacta a vardelume@polsia.app para revisar el cobro.',
      ),
    );
  }

  const parsedPaidAt = verification.payment?.paid_at
    ? new Date(verification.payment.paid_at)
    : null;
  const paidAt = parsedPaidAt && !Number.isNaN(parsedPaidAt.getTime()) ? parsedPaidAt : new Date();
  const paidThrough = new Date(paidAt.getTime() + COHORT_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000);
  const verifiedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.cohortPaymentAttempt.updateMany({
        where: { id: attempt.id, status: { not: 'CONFIRMED' } },
        data: { status: 'CONFIRMED', paidAt, paidThrough, verifiedAt },
      });
      if (claimed.count === 0) return;
    });

    const refreshed = await findCohortAccessForUser(user.id);
    const accessStatus = refreshed?.hasAccess
      ? 'enabled'
      : paidThrough.getTime() <= Date.now()
        ? 'expired'
        : 'closed';
    return NextResponse.json(
      enrollmentState(
        'confirmed',
        accessStatus,
        refreshed?.hasAccess
          ? `Pago confirmado. El acceso al espacio privado está habilitado durante ${COHORT_DURATION_WEEKS} semanas.`
          : accessStatus === 'expired'
            ? 'Pago confirmado. El acceso de esta cohorte ya venció.'
            : 'Pago confirmado, pero el acceso todavía no está habilitado. Vuelve a comprobarlo.',
      ),
    );
  } catch {
    return NextResponse.json(
      enrollmentState(
        'unverifiable',
        'closed',
        'Polsia confirmó el pago, pero no se pudo guardar la concesión de acceso. Vuelve a comprobarlo; la operación es segura de repetir.',
      ),
      { status: 503 },
    );
  }
}
