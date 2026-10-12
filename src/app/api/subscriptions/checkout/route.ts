// @polsia:user-owned
import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { findCohortAccessForUser } from '@/lib/business/cohort-access';
import {
  COHORT_DEFAULT_PRICE_USD,
  COHORT_DURATION_WEEKS,
  COHORT_OFFER_ID,
  isCohortPrice,
} from '@/lib/business/cohort-offer';
import { canReuseCohortCheckout } from '@/lib/business/cohort-payment';
import { createOrFindOwnedWorkspace, findWorkspaceForUser } from '@/lib/business/workspace-access';
import { CohortCheckoutRequest } from '@/lib/contracts/cohort';
import { CheckoutUrl } from '@/lib/contracts/subscriptions';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import {
  createCheckoutSession,
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  const parsed = CohortCheckoutRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Revisa el precio mostrado antes de continuar.' },
      { status: 400 },
    );
  }

  const current = await findWorkspaceForUser(user.id);
  if (current && !current.isOwner) {
    return NextResponse.json(
      { error: 'Solo la persona propietaria puede iniciar la inscripción.' },
      { status: 403 },
    );
  }
  const cohortAccess = await findCohortAccessForUser(user.id);
  if (current?.hasAccess || cohortAccess.hasAccess) {
    return NextResponse.json(
      { error: 'El acceso al espacio ya está habilitado.' },
      { status: 409 },
    );
  }

  try {
    const workspace = current?.workspace ?? (await createOrFindOwnedWorkspace(user.id));
    const savedOffer = await prisma.cohortOffer.findUnique({ where: { id: COHORT_OFFER_ID } });
    const totalUsd = savedOffer?.totalUsd ?? COHORT_DEFAULT_PRICE_USD;
    if (!isCohortPrice(totalUsd)) {
      return NextResponse.json(
        { error: 'El precio configurado no está dentro del rango permitido.' },
        { status: 503 },
      );
    }

    const previousAttempt = await prisma.cohortPaymentAttempt.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
    });
    const reusableAttempt =
      previousAttempt && canReuseCohortCheckout(previousAttempt.status) ? previousAttempt : null;
    if (reusableAttempt?.checkoutUrl) {
      if (reusableAttempt.totalUsd !== parsed.data.displayedTotalUsd) {
        return NextResponse.json(
          {
            error:
              'El importe del checkout anterior no coincide con el precio que se muestra. Actualiza la página y revisa el total.',
          },
          { status: 409 },
        );
      }
      return NextResponse.json(CheckoutUrl.parse({ url: reusableAttempt.checkoutUrl }));
    }
    if (
      reusableAttempt &&
      (reusableAttempt.status === 'PENDING' || reusableAttempt.status === 'UNVERIFIABLE')
    ) {
      return NextResponse.json(
        {
          error:
            'El checkout anterior sigue pendiente. Intenta continuar desde la página de inscripción.',
        },
        { status: 409 },
      );
    }
    if (parsed.data.displayedTotalUsd !== totalUsd) {
      return NextResponse.json(
        { error: 'El precio se actualizó. Revisa el total mostrado antes de iniciar el checkout.' },
        { status: 409 },
      );
    }

    const requestId = randomUUID();
    const attempt = await prisma.cohortPaymentAttempt.create({
      data: { workspaceId: workspace.id, userId: user.id, requestId, totalUsd, status: 'PENDING' },
    });
    const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');

    try {
      const session = await createCheckoutSession({
        amountUsd: totalUsd,
        name: 'Cohorte educativa de 12 semanas',
        description: 'Inscripción de pago único a la cohorte educativa de 12 semanas.',
        customerEmail: user.email,
        clientReferenceId: requestId,
        metadata: {
          requestId,
          workspaceId: workspace.id,
          durationWeeks: String(COHORT_DURATION_WEEKS),
        },
        successUrl: `${origin}/inscripcion/resultado?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/inscripcion/resultado?request_id=${requestId}&cancelled=1`,
        submitType: 'pay',
        locale: 'es',
      });
      await prisma.cohortPaymentAttempt.update({
        where: { id: attempt.id },
        data: { checkoutSessionId: session.stripeSessionId, checkoutUrl: session.url },
      });
      return NextResponse.json(CheckoutUrl.parse({ url: session.url }));
    } catch (error) {
      await prisma.cohortPaymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'CHECKOUT_UNAVAILABLE' },
      });
      if (error instanceof StripeBillingNotEnabledError) {
        return NextResponse.json(
          { error: 'Los pagos todavía no están habilitados en Polsia.' },
          { status: 503 },
        );
      }
      if (error instanceof StripeBillingOnboardingError) {
        return NextResponse.json(
          {
            error: 'El checkout integrado requiere completar la configuración de pagos de Polsia.',
          },
          { status: 503 },
        );
      }
      if (error instanceof StripeBillingConfigurationError) {
        return NextResponse.json(
          { error: 'El checkout integrado no está disponible en este entorno.' },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: 'No se pudo iniciar el pago integrado. Inténtalo de nuevo.' },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo iniciar la inscripción.' }, { status: 500 });
  }
}
