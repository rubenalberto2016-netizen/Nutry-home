// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialAdmin } from '@/lib/business/editorial-access';
import { EditorialReviewerCreate } from '@/lib/contracts/editorial-content';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const access = await requireEditorialAdmin();
  if ('response' in access) return access.response;
  const parsed = EditorialReviewerCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Completa los datos y confirma la verificación externa.' },
      { status: 400 },
    );

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, emailVerified: true },
  });
  if (!user)
    return NextResponse.json(
      { error: 'La persona debe tener una cuenta antes de su designación.' },
      { status: 404 },
    );
  if (!user.emailVerified || user.role !== 'admin') {
    return NextResponse.json(
      { error: 'La persona debe tener email verificado y una cuenta admin.' },
      { status: 409 },
    );
  }

  const reviewer = await prisma.editorialProfessionalReviewer.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      profession: parsed.data.profession,
      registryName: parsed.data.registryName,
      registrationNumber: parsed.data.registrationNumber,
      jurisdiction: parsed.data.jurisdiction,
      credentialsConfirmed: true,
      authorizedByUserId: access.user.id,
    },
    update: {
      profession: parsed.data.profession,
      registryName: parsed.data.registryName,
      registrationNumber: parsed.data.registrationNumber,
      jurisdiction: parsed.data.jurisdiction,
      credentialsConfirmed: true,
      active: true,
      authorizedByUserId: access.user.id,
      authorizedAt: new Date(),
      revokedByUserId: null,
      revokedAt: null,
    },
  });
  return NextResponse.json(
    { id: reviewer.id, userId: reviewer.userId, active: reviewer.active },
    { status: 201 },
  );
}
