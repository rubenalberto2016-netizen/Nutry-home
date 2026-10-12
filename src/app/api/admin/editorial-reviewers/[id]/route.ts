// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialAdmin } from '@/lib/business/editorial-access';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireEditorialAdmin();
  if ('response' in access) return access.response;
  const { id } = await context.params;
  const result = await prisma.editorialProfessionalReviewer.updateMany({
    where: { id, active: true },
    data: { active: false, revokedByUserId: access.user.id, revokedAt: new Date() },
  });
  if (result.count === 0)
    return NextResponse.json({ error: 'No se encontró una designación activa.' }, { status: 404 });
  return NextResponse.json({ id, active: false }, { headers: { 'Cache-Control': 'no-store' } });
}
