// @polsia:user-owned
import 'server-only';
import { subscriptionHasAccess } from '@/lib/business/subscription-state';
import { prisma } from '@/lib/db';

export async function findCohortAccessForUser(userId: string) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId },
    select: { workspaceId: true },
  });
  if (!membership) return { hasAccess: false, paidThrough: null };

  const now = new Date();
  const [cohortPayment, existingSubscription] = await Promise.all([
    prisma.cohortPaymentAttempt.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        status: 'CONFIRMED',
        paidThrough: { gt: now },
      },
      orderBy: { paidThrough: 'desc' },
      select: { paidThrough: true },
    }),
    prisma.workspaceSubscription.findUnique({ where: { workspaceId: membership.workspaceId } }),
  ]);

  if (cohortPayment?.paidThrough) {
    return { hasAccess: true, paidThrough: cohortPayment.paidThrough };
  }
  if (existingSubscription && subscriptionHasAccess(existingSubscription)) {
    return { hasAccess: true, paidThrough: existingSubscription.paidThrough };
  }
  return { hasAccess: false, paidThrough: null };
}
