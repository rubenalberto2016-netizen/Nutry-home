// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import {
  WorkspaceDocumentRetentionChange,
  WorkspaceDocumentRetentionState,
} from '@/lib/contracts/workspace-security';
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
      return NextResponse.json(
        WorkspaceDocumentRetentionState.parse({
          workspaceId: null,
          canManage: false,
          retentionDays: null,
          updatedAt: null,
          documents: [],
        }),
      );
    }
    const policy = await prisma.workspaceDocumentRetention.findUnique({
      where: { workspaceId: access.workspace.id },
      select: { retentionDays: true, updatedAt: true },
    });
    const documents = access.isOwner
      ? await prisma.financialAgentSubmissionDocument.findMany({
          where: {
            submission: { workspaceId: access.workspace.id },
            content: { not: null },
            deletedAt: null,
          },
          select: { id: true, fileName: true, createdAt: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      : [];
    return NextResponse.json(
      WorkspaceDocumentRetentionState.parse({
        workspaceId: access.workspace.id,
        canManage: access.isOwner,
        retentionDays: validRetentionDays(policy?.retentionDays ?? null),
        updatedAt: policy?.updatedAt.toISOString() ?? null,
        documents: documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          uploadedAt: document.createdAt.toISOString(),
        })),
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'No se pudo consultar la política de retención.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  const parsed = WorkspaceDocumentRetentionChange.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { retentionDays: parsed.error.issues[0]?.message ?? 'Elige un periodo válido.' } },
      { status: 400 },
    );
  }
  const access = await findWorkspaceForUser(user.id);
  if (!access)
    return NextResponse.json({ error: 'No perteneces a un espacio de trabajo.' }, { status: 403 });
  if (!access.isOwner) {
    return NextResponse.json(
      { error: 'Solo la persona propietaria puede cambiar la retención.' },
      { status: 403 },
    );
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const membership = await transaction.workspaceMembership.findUnique({
        where: { userId: user.id },
        select: { workspaceId: true, role: true, workspace: { select: { ownerUserId: true } } },
      });
      if (
        !membership ||
        membership.workspaceId !== access.workspace.id ||
        membership.role !== 'OWNER' ||
        membership.workspace.ownerUserId !== user.id
      )
        return { kind: 'forbidden' as const };

      const existing = await transaction.workspaceDocumentRetention.findUnique({
        where: { workspaceId: membership.workspaceId },
        select: { retentionDays: true },
      });
      const previousRetentionDays = existing?.retentionDays ?? null;
      await transaction.workspaceDocumentRetention.upsert({
        where: { workspaceId: membership.workspaceId },
        create: {
          workspaceId: membership.workspaceId,
          retentionDays: parsed.data.retentionDays,
          updatedByUserId: user.id,
        },
        update: { retentionDays: parsed.data.retentionDays, updatedByUserId: user.id },
      });
      if (previousRetentionDays !== parsed.data.retentionDays) {
        await transaction.workspaceAccessEvent.create({
          data: {
            workspaceId: membership.workspaceId,
            actorUserId: user.id,
            action: 'RETENTION_CHANGED',
            previousRetentionDays,
            newRetentionDays: parsed.data.retentionDays,
          },
        });
      }
      return { kind: 'saved' as const };
    });
    if (result.kind === 'forbidden') {
      return NextResponse.json(
        { error: 'Solo la persona propietaria puede cambiar la retención.' },
        { status: 403 },
      );
    }
    return GET(request);
  } catch {
    return NextResponse.json(
      { error: 'No se pudo guardar la política de retención.' },
      { status: 500 },
    );
  }
}

function validRetentionDays(value: number | null): 30 | 90 | 180 | 365 | null {
  return value === 30 || value === 90 || value === 180 || value === 365 ? value : null;
}
