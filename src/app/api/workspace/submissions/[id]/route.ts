// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSubmissionPermissions } from '@/lib/business/workspace-security';
import { WorkspaceSubmissionDetail } from '@/lib/contracts/workspace-security';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const membership = await transaction.workspaceMembership.findUnique({
        where: { userId: user.id },
        select: { workspaceId: true, role: true, workspace: { select: { ownerUserId: true } } },
      });
      if (!membership) return { kind: 'forbidden' as const };

      const submission = await transaction.financialAgentSubmission.findFirst({
        where: { id, workspaceId: membership.workspaceId },
        select: {
          id: true,
          workspaceId: true,
          userId: true,
          answers: true,
          questionSnapshot: true,
          requestedDocumentsSnapshot: true,
          submittedAt: true,
          agent: { select: { name: true } },
          documents: {
            select: {
              id: true,
              documentName: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              createdAt: true,
              deletedAt: true,
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
          accessGrants: {
            where: { userId: user.id, active: true },
            select: { role: true },
            take: 1,
          },
        },
      });
      if (!submission) return { kind: 'not_found' as const };

      const grantRole = parseGrantRole(submission.accessGrants[0]?.role);
      const permissions = resolveSubmissionPermissions({
        actorId: user.id,
        memberWorkspaceId: membership.workspaceId,
        submissionWorkspaceId: submission.workspaceId,
        workspaceOwnerId: membership.workspace.ownerUserId,
        workspaceOwnerRole: membership.role,
        submissionUserId: submission.userId,
        grantRole,
      });
      if (!permissions.canView || !permissions.role) return { kind: 'forbidden' as const };

      const rawAnswers = z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .parse(submission.answers);
      const questions = z.array(z.string()).parse(submission.questionSnapshot);
      const requestedDocuments = z.array(z.string()).parse(submission.requestedDocumentsSnapshot);
      await transaction.workspaceAccessEvent.create({
        data: {
          workspaceId: submission.workspaceId,
          submissionId: submission.id,
          actorUserId: user.id,
          action: 'SUBMISSION_OPENED',
        },
      });

      return {
        kind: 'success' as const,
        payload: WorkspaceSubmissionDetail.parse({
          id: submission.id,
          agentName: submission.agent.name,
          submittedAt: submission.submittedAt.toISOString(),
          answers: rawAnswers.map((item, index) => ({
            question: questions[index] ?? item.question,
            answer: item.answer,
          })),
          requestedDocuments,
          documents: submission.documents.map((document) => ({
            ...document,
            createdAt: document.createdAt.toISOString(),
            deletedAt: document.deletedAt?.toISOString() ?? null,
          })),
          access: {
            role: permissions.role,
            canManage: permissions.canManage,
            canReadDocuments: permissions.canReadDocuments,
          },
        }),
      };
    });
    if (result.kind === 'forbidden') {
      return NextResponse.json({ error: 'No tienes acceso a este expediente.' }, { status: 403 });
    }
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    return NextResponse.json(result.payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el expediente.' }, { status: 500 });
  }
}

function parseGrantRole(role: string | undefined): 'LECTOR' | 'REVISOR' | null {
  return role === 'LECTOR' || role === 'REVISOR' ? role : null;
}
