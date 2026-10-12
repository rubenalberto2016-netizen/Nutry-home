// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialWorkspace } from '@/lib/business/editorial-access';
import { toEditorialSource } from '@/lib/business/editorial-content';
import {
  EditorialSourceList,
  EditorialSourceMaterialCreate,
} from '@/lib/contracts/editorial-content';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await requireEditorialWorkspace(request);
  if ('response' in access) return access.response;
  const records = await prisma.editorialSource.findMany({
    where: { workspaceId: access.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return NextResponse.json(EditorialSourceList.parse({ items: records.map(toEditorialSource) }), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const access = await requireEditorialWorkspace(request);
  if ('response' in access) return access.response;
  const parsed = EditorialSourceMaterialCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Incluye el nombre y el extracto del material fuente.' },
      { status: 400 },
    );
  }

  const record = await prisma.editorialSource.create({
    data: {
      workspaceId: access.workspaceId,
      createdByUserId: access.user.id,
      kind: 'provided_material',
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
    },
  });
  return NextResponse.json(toEditorialSource(record), {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
