// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialAdmin } from '@/lib/business/editorial-access';
import { EditorialReviewAction } from '@/lib/contracts/editorial-content';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireEditorialAdmin();
  if ('response' in access) return access.response;
  const parsed = EditorialReviewAction.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Revisa la acción y la nota profesional.' }, { status: 400 });

  const reviewer = await prisma.editorialProfessionalReviewer.findUnique({
    where: { userId: access.user.id },
  });
  if (!reviewer?.active || !reviewer.credentialsConfirmed) {
    return NextResponse.json(
      { error: 'Tu cuenta requiere una designación profesional activa para revisar.' },
      { status: 403 },
    );
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: access.user.id },
    select: { name: true, email: true, role: true },
  });
  if (currentUser?.role !== 'admin')
    return NextResponse.json({ error: 'Se requiere una cuenta admin activa.' }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.editorialDraft.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!current) return NextResponse.json({ error: 'No se encontró el borrador.' }, { status: 404 });
  if (current.status !== 'pending_review') {
    return NextResponse.json(
      { error: 'Solo los borradores pendientes pueden recibir una decisión.' },
      { status: 409 },
    );
  }

  const nextStatus = parsed.data.action === 'approved' ? 'approved' : 'changes_requested';
  const reviewerSnapshot = `${currentUser.name} <${currentUser.email}> — ${reviewer.profession}, ${reviewer.registryName} ${reviewer.registrationNumber} (${reviewer.jurisdiction})`;
  const outcome = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.editorialDraft.updateMany({
      where: { id, status: 'pending_review' },
      data: {
        status: nextStatus,
        approvedAt: nextStatus === 'approved' ? new Date() : null,
        approvedByUserId: nextStatus === 'approved' ? access.user.id : null,
        approvedBySnapshot: nextStatus === 'approved' ? reviewerSnapshot : null,
        latestReviewNote: parsed.data.note ?? null,
      },
    });
    if (updated.count === 0) return false;
    await transaction.editorialReviewEvent.create({
      data: {
        draftId: id,
        reviewerUserId: access.user.id,
        reviewerSnapshot,
        action: parsed.data.action,
        note: parsed.data.note,
      },
    });
    return true;
  });
  if (!outcome)
    return NextResponse.json({ error: 'El borrador ya recibió otra decisión.' }, { status: 409 });
  return NextResponse.json(
    { id, status: nextStatus, reviewerSnapshot },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
