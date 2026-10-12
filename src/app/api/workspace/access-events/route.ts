// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { WorkspaceAccessEventList } from '@/lib/contracts/workspace-security';
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
    const access = await findWorkspaceForUser(user.id);
    if (!access) {
      return NextResponse.json(WorkspaceAccessEventList.parse({ canManage: false, items: [] }));
    }
    const visibleSubmissions = access.isOwner
      ? []
      : await prisma.financialAgentSubmission.findMany({
          where: {
            workspaceId: access.workspace.id,
            OR: [
              { userId: user.id },
              { accessGrants: { some: { userId: user.id, active: true } } },
            ],
          },
          select: { id: true },
        });
    const events = await prisma.workspaceAccessEvent.findMany({
      where: {
        workspaceId: access.workspace.id,
        ...(access.isOwner
          ? {}
          : { submissionId: { in: visibleSubmissions.map((item) => item.id) } }),
      },
      include: { submission: { select: { agent: { select: { name: true } } } } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    const personIds = [
      ...new Set(
        events.flatMap((event) =>
          [event.actorUserId, event.subjectUserId].filter((id): id is string => id !== null),
        ),
      ),
    ];
    const documentIds = [
      ...new Set(events.flatMap((event) => (event.documentId ? [event.documentId] : []))),
    ];
    const users = await prisma.user.findMany({
      where: { id: { in: personIds } },
      select: { id: true, name: true, email: true },
    });
    const documents = await prisma.financialAgentSubmissionDocument.findMany({
      where: { id: { in: documentIds }, submission: { workspaceId: access.workspace.id } },
      select: { id: true, documentName: true },
    });
    const userById = new Map(users.map((account) => [account.id, account]));
    const documentById = new Map(documents.map((document) => [document.id, document.documentName]));
    return NextResponse.json(
      WorkspaceAccessEventList.parse({
        canManage: access.isOwner,
        items: events.map((event) => {
          const actor = event.actorUserId ? userById.get(event.actorUserId) : undefined;
          const subject = event.subjectUserId ? userById.get(event.subjectUserId) : undefined;
          return {
            id: event.id,
            submissionId: event.submissionId,
            submissionName: event.submission?.agent.name ?? null,
            documentId: event.documentId,
            documentName: event.documentId ? (documentById.get(event.documentId) ?? null) : null,
            actorUserId: event.actorUserId,
            actorName: actor?.name ?? null,
            actorEmail: actor?.email ?? null,
            actorLabel: event.actorLabel,
            subjectUserId: event.subjectUserId,
            subjectName: subject?.name ?? null,
            subjectEmail: subject?.email ?? null,
            action: event.action,
            previousRole: validRole(event.previousRole),
            newRole: validRole(event.newRole),
            previousRetentionDays: validRetentionDays(event.previousRetentionDays),
            newRetentionDays: validRetentionDays(event.newRetentionDays),
            occurredAt: event.occurredAt.toISOString(),
          };
        }),
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar el historial de accesos.' },
      { status: 500 },
    );
  }
}

function validRole(value: string | null): 'LECTOR' | 'REVISOR' | null {
  return value === 'LECTOR' || value === 'REVISOR' ? value : null;
}

function validRetentionDays(value: number | null): 30 | 90 | 180 | 365 | null {
  return value === 30 || value === 90 || value === 180 || value === 365 ? value : null;
}
