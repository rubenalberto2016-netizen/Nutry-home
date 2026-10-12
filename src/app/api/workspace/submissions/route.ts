// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { resolveSubmissionPermissions } from '@/lib/business/workspace-security';
import { WorkspaceSubmissionList } from '@/lib/contracts/workspace-security';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  try {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { userId: user.id },
      select: { workspaceId: true, role: true, workspace: { select: { ownerUserId: true } } },
    });
    if (!membership) {
      return NextResponse.json(
        WorkspaceSubmissionList.parse({ workspaceId: null, canManage: false, items: [] }),
      );
    }

    const submissions = await prisma.financialAgentSubmission.findMany({
      where:
        membership.role === 'OWNER' && membership.workspace.ownerUserId === user.id
          ? { workspaceId: membership.workspaceId }
          : {
              workspaceId: membership.workspaceId,
              OR: [
                { userId: user.id },
                { accessGrants: { some: { userId: user.id, active: true } } },
              ],
            },
      select: {
        id: true,
        userId: true,
        submittedAt: true,
        agent: { select: { name: true } },
        workspace: { select: { ownerUserId: true } },
        documents: { select: { id: true } },
        accessGrants: {
          where: { userId: user.id, active: true },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
    });
    const items = submissions.flatMap((submission) => {
      const permissions = resolveSubmissionPermissions({
        actorId: user.id,
        memberWorkspaceId: membership.workspaceId,
        submissionWorkspaceId: membership.workspaceId,
        workspaceOwnerId: submission.workspace.ownerUserId,
        workspaceOwnerRole: membership.role,
        submissionUserId: submission.userId,
        grantRole: parseGrantRole(submission.accessGrants[0]?.role),
      });
      if (!permissions.canView || !permissions.role) return [];
      return [
        {
          id: submission.id,
          agentName: submission.agent.name,
          submittedAt: submission.submittedAt.toISOString(),
          documentCount: submission.documents.length,
          role: permissions.role,
        },
      ];
    });
    const isOwner = membership.role === 'OWNER' && membership.workspace.ownerUserId === user.id;
    return NextResponse.json(
      WorkspaceSubmissionList.parse({
        workspaceId: membership.workspaceId,
        canManage: isOwner,
        items,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron consultar los expedientes.' },
      { status: 500 },
    );
  }
}

function parseGrantRole(role: string | undefined): 'LECTOR' | 'REVISOR' | null {
  return role === 'LECTOR' || role === 'REVISOR' ? role : null;
}
