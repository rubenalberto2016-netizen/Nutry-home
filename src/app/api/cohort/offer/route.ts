// @polsia:user-owned
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  COHORT_DEFAULT_PRICE_USD,
  COHORT_DURATION_WEEKS,
  COHORT_MAX_PRICE_USD,
  COHORT_MIN_PRICE_USD,
  COHORT_OFFER_ID,
} from '@/lib/business/cohort-offer';
import { CohortOffer, CohortPriceUpdate } from '@/lib/contracts/cohort';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function readOffer() {
  const saved = await prisma.cohortOffer.findUnique({ where: { id: COHORT_OFFER_ID } });
  return CohortOffer.parse({
    totalUsd: saved?.totalUsd ?? COHORT_DEFAULT_PRICE_USD,
    durationWeeks: COHORT_DURATION_WEEKS,
    minimumUsd: COHORT_MIN_PRICE_USD,
    maximumUsd: COHORT_MAX_PRICE_USD,
  });
}

export async function GET() {
  try {
    return NextResponse.json(await readOffer(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar la oferta.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const parsed = CohortPriceUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        errors: {
          totalUsd: `El precio debe ser un entero entre US$${COHORT_MIN_PRICE_USD} y US$${COHORT_MAX_PRICE_USD}.`,
        },
      },
      { status: 400 },
    );
  }

  try {
    await prisma.cohortOffer.upsert({
      where: { id: COHORT_OFFER_ID },
      create: { id: COHORT_OFFER_ID, totalUsd: parsed.data.totalUsd },
      update: { totalUsd: parsed.data.totalUsd },
    });
    return NextResponse.json(await readOffer(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el precio.' }, { status: 500 });
  }
}
