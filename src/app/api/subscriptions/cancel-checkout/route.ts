// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findCohortAccessForUser } from '@/lib/business/cohort-access';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { CohortCheckoutCancellation, CohortEnrollmentState } from '@/lib/contracts/cohort';
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

  const parsed = CohortCheckoutCancellation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'La solicitud de inscripción no es válida.' },
      { status: 400 },
    );
  }
  const access = await findWorkspaceForUser(user.id);
  if (!access?.isOwner) {
    return NextResponse.json(
      { error: 'No encontramos una solicitud para esta cuenta.' },
      { status: 404 },
    );
  }
  const programAccess = await findCohortAccessForUser(user.id);

  const changed = await prisma.cohortPaymentAttempt.updateMany({
    where: {
      requestId: parsed.data.requestId,
      userId: user.id,
      workspaceId: access.workspace.id,
      status: { in: ['PENDING', 'UNVERIFIABLE'] },
    },
    data: { status: 'CANCELLED' },
  });
  if (changed.count === 0) {
    const prior = await prisma.cohortPaymentAttempt.findUnique({
      where: { requestId: parsed.data.requestId },
    });
    if (!prior || prior.userId !== user.id || prior.workspaceId !== access.workspace.id) {
      return NextResponse.json(
        { error: 'La solicitud no coincide con esta cuenta.' },
        { status: 404 },
      );
    }
    const priorPaymentStatus =
      prior.status === 'CONFIRMED'
        ? 'confirmed'
        : prior.status === 'FAILED'
          ? 'failed'
          : prior.status === 'UNVERIFIABLE'
            ? 'unverifiable'
            : prior.status === 'CANCELLED'
              ? 'cancelled'
              : 'pending';
    return NextResponse.json(
      CohortEnrollmentState.parse({
        requestStatus: 'received',
        paymentStatus: priorPaymentStatus,
        accessStatus: programAccess.hasAccess ? 'enabled' : 'closed',
        message:
          prior.status === 'CONFIRMED'
            ? 'El pago ya estaba confirmado; el acceso se conserva según su estado actual.'
            : 'La solicitud permanece recibida y el acceso sigue cerrado.',
      }),
    );
  }

  return NextResponse.json(
    CohortEnrollmentState.parse({
      requestStatus: 'received',
      paymentStatus: 'cancelled',
      accessStatus: programAccess.hasAccess ? 'enabled' : 'closed',
      message:
        'El checkout se canceló. La solicitud permanece recibida, el pago no está confirmado y el acceso sigue cerrado.',
    }),
  );
}
