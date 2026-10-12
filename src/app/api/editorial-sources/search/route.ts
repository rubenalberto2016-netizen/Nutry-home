// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialWorkspace } from '@/lib/business/editorial-access';
import { toEditorialSource } from '@/lib/business/editorial-content';
import { EditorialSearchRequest, EditorialSourceList } from '@/lib/contracts/editorial-content';
import { prisma } from '@/lib/db';
import { search } from '@/modules/web-search/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const access = await requireEditorialWorkspace(request);
  if ('response' in access) return access.response;
  const parsed = EditorialSearchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Escribe una búsqueda de al menos cuatro caracteres.' },
      { status: 400 },
    );
  }

  try {
    const result = await search({ query: parsed.data.query, count: 6 });
    const usable = result.results.filter((item) => {
      try {
        const url = new URL(item.url);
        return (
          (url.protocol === 'https:' || url.protocol === 'http:') && item.snippet.trim().length > 0
        );
      } catch {
        return false;
      }
    });
    const records = await Promise.all(
      usable.map((item) =>
        prisma.editorialSource.create({
          data: {
            workspaceId: access.workspaceId,
            createdByUserId: access.user.id,
            kind: 'web_search',
            title: item.title.trim() || 'Resultado web sin título',
            url: item.url,
            excerpt: item.snippet.slice(0, 8000),
            checkedAt: result.fetchedAt ? new Date(result.fetchedAt) : new Date(),
          },
        }),
      ),
    );
    return NextResponse.json(EditorialSourceList.parse({ items: records.map(toEditorialSource) }), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'La búsqueda verificada no está disponible ahora. Conserva tus materiales y vuelve a intentarlo.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
