// @polsia:user-owned
import 'server-only';
import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { resolveSubmissionPermissions } from '@/lib/business/workspace-security';
import { WorkspaceSubmissionDocumentContent } from '@/lib/contracts/workspace-security';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  const { id, documentId } = await context.params;
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
          accessGrants: {
            where: { userId: user.id, active: true },
            select: { role: true },
            take: 1,
          },
        },
      });
      if (!submission) return { kind: 'not_found' as const };
      const grant = submission.accessGrants[0]?.role;
      const permissions = resolveSubmissionPermissions({
        actorId: user.id,
        memberWorkspaceId: membership.workspaceId,
        submissionWorkspaceId: submission.workspaceId,
        workspaceOwnerId: membership.workspace.ownerUserId,
        workspaceOwnerRole: membership.role,
        submissionUserId: submission.userId,
        grantRole: grant === 'LECTOR' || grant === 'REVISOR' ? grant : null,
      });
      if (!permissions.canView || !permissions.canReadDocuments) {
        return { kind: 'forbidden' as const };
      }
      const document = await transaction.financialAgentSubmissionDocument.findFirst({
        where: { id: documentId, submissionId: id },
        select: { fileName: true, mimeType: true, content: true, deletedAt: true },
      });
      if (!document) return { kind: 'not_found' as const };
      if (!document.content || document.deletedAt) return { kind: 'expired' as const };
      await transaction.workspaceAccessEvent.create({
        data: {
          workspaceId: submission.workspaceId,
          submissionId: id,
          documentId,
          actorUserId: user.id,
          action: 'DOCUMENT_OPENED',
        },
      });
      return {
        kind: 'success' as const,
        payload: WorkspaceSubmissionDocumentContent.parse({
          fileName: document.fileName,
          mimeType: document.mimeType,
          base64: Buffer.from(document.content).toString('base64'),
        }),
      };
    });
    if (result.kind === 'forbidden') {
      return NextResponse.json(
        { error: 'No tienes permiso para abrir este documento.' },
        { status: 403 },
      );
    }
    if (result.kind === 'not_found') {
      return NextResponse.json(
        { error: 'Documento no encontrado en este expediente.' },
        { status: 404 },
      );
    }
    if (result.kind === 'expired') {
      return NextResponse.json(
        { error: 'El archivo venció y sus bytes se eliminaron; los metadatos siguen disponibles.' },
        { status: 410 },
      );
    }
    return NextResponse.json(result.payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el documento.' }, { status: 500 });
  }
}
