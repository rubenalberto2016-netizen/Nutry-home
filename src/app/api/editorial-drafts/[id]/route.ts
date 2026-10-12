// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialWorkspace } from '@/lib/business/editorial-access';
import {
  hasUnsafeHealthAdvice,
  onlyKnownSourceIds,
  toEditorialDraft,
} from '@/lib/business/editorial-content';
import {
  EditorialDraftPatch,
  EditorialDraft as EditorialDraftSchema,
} from '@/lib/contracts/editorial-content';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireEditorialWorkspace(request);
  if ('response' in access) return access.response;
  const parsed = EditorialDraftPatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Revisa los cambios del borrador.' }, { status: 400 });
  const { id } = await context.params;
  const current = await prisma.editorialDraft.findFirst({
    where: { id, workspaceId: access.workspaceId },
  });
  if (!current) return NextResponse.json({ error: 'No se encontró el borrador.' }, { status: 404 });
  if (current.status !== 'pending_review' && current.status !== 'changes_requested') {
    return NextResponse.json(
      { error: 'Un borrador aprobado ya no se puede editar.' },
      { status: 409 },
    );
  }

  const sources = EditorialDraftSchema.shape.sources.parse(current.sources);
  const sections =
    parsed.data.sections ?? EditorialDraftSchema.shape.sections.parse(current.sections);
  if (!onlyKnownSourceIds(sections, sources)) {
    return NextResponse.json(
      { error: 'Cada sección debe conservar referencias a fuentes del borrador.' },
      { status: 400 },
    );
  }
  if (hasUnsafeHealthAdvice(sections)) {
    return NextResponse.json(
      { error: 'El texto contiene una instrucción o afirmación clínica que debe retirarse.' },
      { status: 422 },
    );
  }

  const result = await prisma.editorialDraft.updateMany({
    where: { id, workspaceId: access.workspaceId, status: current.status },
    data: { ...parsed.data, status: 'pending_review', latestReviewNote: null },
  });
  if (result.count === 0)
    return NextResponse.json(
      { error: 'El estado cambió; actualiza el borrador.' },
      { status: 409 },
    );
  const updated = await prisma.editorialDraft.findFirst({
    where: { id, workspaceId: access.workspaceId },
  });
  if (!updated) return NextResponse.json({ error: 'No se encontró el borrador.' }, { status: 404 });
  return NextResponse.json(EditorialDraftSchema.parse(toEditorialDraft(updated)), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
