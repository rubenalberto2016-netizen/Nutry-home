// @polsia:user-owned — lectura de materiales y progreso personal del programa.
import 'server-only';
import { NextResponse } from 'next/server';
import { findCohortAccessForUser } from '@/lib/business/cohort-access';
import { programDisclaimer, programTitle, programWeeks } from '@/lib/business/program-curriculum';
import {
  ProgramOverview,
  ProgramProgressUpdate,
  ProgramProgressUpdateResult,
} from '@/lib/contracts/program-progress';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function requireParticipantAccess(user: SessionUser) {
  const access = await findCohortAccessForUser(user.id);
  return access.hasAccess ? access : null;
}

export async function GET(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  try {
    const access = await requireParticipantAccess(user);
    if (!access) {
      return NextResponse.json(
        { error: 'El programa está disponible después de confirmar el pago de inscripción.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const progress = await prisma.participantWeekProgress.findMany({
      where: { userId: user.id },
      select: { weekNumber: true, completed: true, updatedAt: true },
    });
    const progressByWeek = new Map(progress.map((item) => [item.weekNumber, item]));
    const weeks = programWeeks.map((week) => {
      const savedProgress = progressByWeek.get(week.weekNumber);
      return {
        ...week,
        completed: savedProgress?.completed ?? false,
        updatedAt: savedProgress?.updatedAt.toISOString() ?? null,
      };
    });

    return NextResponse.json(
      ProgramOverview.parse({
        title: programTitle,
        contentStatus: 'sample',
        disclaimer: programDisclaimer,
        weeks,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'No se pudo consultar el espacio del programa.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function PATCH(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  try {
    const access = await requireParticipantAccess(user);
    if (!access) {
      return NextResponse.json(
        { error: 'El programa está disponible después de confirmar el pago de inscripción.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const parsed = ProgramProgressUpdate.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { errors: { weekNumber: 'Indica una semana válida entre la 1 y la 12.' } },
        { status: 400 },
      );
    }

    const progress = await prisma.participantWeekProgress.upsert({
      where: {
        userId_weekNumber: { userId: user.id, weekNumber: parsed.data.weekNumber },
      },
      create: {
        userId: user.id,
        weekNumber: parsed.data.weekNumber,
        completed: parsed.data.completed,
      },
      update: { completed: parsed.data.completed },
      select: { weekNumber: true, completed: true, updatedAt: true },
    });

    return NextResponse.json(
      ProgramProgressUpdateResult.parse({
        ...progress,
        updatedAt: progress.updatedAt.toISOString(),
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'No se pudo guardar el progreso.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
