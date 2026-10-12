// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { WorkspaceMemberList } from '@/lib/contracts/subscriptions';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  const access = await findWorkspaceForUser(user.id);
  if (!access)
    return NextResponse.json({ error: 'No perteneces a un espacio de trabajo.' }, { status: 403 });
  if (!access.isOwner)
    return NextResponse.json(
      { error: 'Solo la persona propietaria administra miembros.' },
      { status: 403 },
    );

  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const member = await transaction.workspaceMembership.findFirst({
        where: { id, workspaceId: access.workspace.id, role: 'MEMBER' },
        select: { userId: true },
      });
      if (!member) return { count: 0 };
      const grants = await transaction.workspaceSubmissionAccessGrant.findMany({
        where: {
          userId: member.userId,
          active: true,
          submission: { workspaceId: access.workspace.id },
        },
        select: { id: true, submissionId: true, role: true },
      });
      const removed = await transaction.workspaceMembership.deleteMany({
        where: { id, workspaceId: access.workspace.id, role: 'MEMBER' },
      });
      if (removed.count !== 1) return { count: 0 };
      const revokedAt = new Date();
      for (const grant of grants) {
        await transaction.workspaceSubmissionAccessGrant.update({
          where: { id: grant.id },
          data: { active: false, revokedAt },
        });
        await transaction.workspaceAccessEvent.create({
          data: {
            workspaceId: access.workspace.id,
            submissionId: grant.submissionId,
            actorUserId: user.id,
            subjectUserId: member.userId,
            action: 'ACCESS_REVOKED',
            previousRole: grant.role,
          },
        });
      }
      return { count: removed.count };
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'No encontramos ese miembro en el espacio.' },
        { status: 404 },
      );
    }
    const memberships = await prisma.workspaceMembership.findMany({
      where: { workspaceId: access.workspace.id },
      orderBy: { createdAt: 'asc' },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: memberships.map((membership) => membership.userId) } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((account) => [account.id, account]));
    const payload = WorkspaceMemberList.parse({
      workspaceId: access.workspace.id,
      canManage: true,
      items: memberships.map((membership) => {
        const account = userById.get(membership.userId);
        return {
          id: membership.id,
          userId: membership.userId,
          email: account?.email ?? null,
          name: account?.name ?? null,
          role: membership.role === 'OWNER' ? 'OWNER' : 'MEMBER',
          createdAt: membership.createdAt.toISOString(),
        };
      }),
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'No se pudo quitar la cuenta del equipo.' }, { status: 500 });
  }
}
