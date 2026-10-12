// @polsia:user-owned
import 'server-only';
import { publicSubscriptionStatus, subscriptionHasAccess } from '@/lib/business/subscription-state';
import { prisma } from '@/lib/db';

export {
  publicSubscriptionStatus,
  subscriptionHasAccess,
  transitionSubscriptionEvent,
} from '@/lib/business/subscription-state';

export async function findWorkspaceForUser(userId: string) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId },
    include: { workspace: { include: { subscription: true } } },
  });
  if (!membership) return null;
  const isOwner = membership.workspace.ownerUserId === userId && membership.role === 'OWNER';
  const subscription = membership.workspace.subscription;
  const hasAccess = subscriptionHasAccess(subscription);
  return {
    membership,
    workspace: membership.workspace,
    subscription,
    isOwner,
    hasAccess,
    publicStatus: publicSubscriptionStatus(subscription),
  };
}

export async function createOrFindOwnedWorkspace(userId: string) {
  return prisma.workspace.upsert({
    where: { ownerUserId: userId },
    create: {
      name: 'Espacio de trabajo de Vardelume',
      ownerUserId: userId,
      members: { create: { userId, role: 'OWNER' } },
    },
    update: {},
    include: { subscription: true },
  });
}
