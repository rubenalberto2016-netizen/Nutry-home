// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { requireEditorialAdmin } from '@/lib/business/editorial-access';
import { toEditorialDraft } from '@/lib/business/editorial-content';
import {
  EditorialDraft as EditorialDraftSchema,
  EditorialReviewer as EditorialReviewerSchema,
  EditorialReviewQueue,
} from '@/lib/contracts/editorial-content';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireEditorialAdmin();
  if ('response' in access) return access.response;

  const [drafts, reviewerRecords] = await Promise.all([
    prisma.editorialDraft.findMany({
      where: { status: { in: ['pending_review', 'changes_requested'] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    }),
    prisma.editorialProfessionalReviewer.findMany({ orderBy: { authorizedAt: 'desc' }, take: 100 }),
  ]);
  const userIds = [
    ...new Set([
      ...reviewerRecords.map((reviewer) => reviewer.userId),
      ...reviewerRecords.map((reviewer) => reviewer.authorizedByUserId),
      access.user.id,
    ]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const reviewers = reviewerRecords.flatMap((record) => {
    const user = usersById.get(record.userId);
    if (!user) return [];
    return [
      EditorialReviewerSchema.parse({
        id: record.id,
        userId: record.userId,
        name: user.name,
        email: user.email,
        profession: record.profession,
        registryName: record.registryName,
        registrationNumber: record.registrationNumber,
        jurisdiction: record.jurisdiction,
        active: record.active,
        authorizedAt: record.authorizedAt.toISOString(),
        authorizedByEmail: usersById.get(record.authorizedByUserId)?.email ?? null,
        revokedAt: record.revokedAt?.toISOString() ?? null,
      }),
    ];
  });
  const currentReviewer =
    reviewers.find((reviewer) => reviewer.userId === access.user.id && reviewer.active) ?? null;
  return NextResponse.json(
    EditorialReviewQueue.parse({
      items: drafts.map((draft) => EditorialDraftSchema.parse(toEditorialDraft(draft))),
      reviewers,
      currentReviewer,
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
