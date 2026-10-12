// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import {
  WorkspaceSubmissionAccessChange,
  WorkspaceSubmissionAccessList,
  WorkspaceSubmissionAccessPatch,
} from '@/lib/contracts/workspace-security';
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
    const owner = await findOwnedSubmission(user.id, id);
    if (!owner) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    return NextResponse.json(await accessList(id, owner.workspaceId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'No se pudieron consultar los permisos.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  const parsed = WorkspaceSubmissionAccessChange.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationResponse(parsed.error);
  return savePermission(user, context, parsed.data.userId, parsed.data.role);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  const parsed = WorkspaceSubmissionAccessPatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationResponse(parsed.error);
  return savePermission(user, context, parsed.data.userId, parsed.data.role);
}

async function savePermission(
  user: SessionUser,
  context: { params: Promise<{ id: string }> },
  targetUserId: string,
  role: 'LECTOR' | 'REVISOR' | null,
) {
  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const actorMembership = await transaction.workspaceMembership.findUnique({
        where: { userId: user.id },
        select: { workspaceId: true, role: true, workspace: { select: { ownerUserId: true } } },
      });
      if (
        !actorMembership ||
        actorMembership.role !== 'OWNER' ||
        actorMembership.workspace.ownerUserId !== user.id
      ) {
        return { kind: 'forbidden' as const };
      }
      const submission = await transaction.financialAgentSubmission.findFirst({
        where: { id, workspaceId: actorMembership.workspaceId },
        select: { id: true, userId: true },
      });
      if (!submission) return { kind: 'not_found' as const };
      const target = await transaction.workspaceMembership.findFirst({
        where: { workspaceId: actorMembership.workspaceId, userId: targetUserId, role: 'MEMBER' },
        select: { userId: true },
      });
      if (!target || target.userId === user.id) return { kind: 'invalid_member' as const };
      if (target.userId === submission.userId) return { kind: 'sender' as const };

      const existing = await transaction.workspaceSubmissionAccessGrant.findUnique({
        where: { submissionId_userId: { submissionId: id, userId: targetUserId } },
      });
      if (role === null) {
        if (!existing?.active)
          return { kind: 'saved' as const, workspaceId: actorMembership.workspaceId };
        await transaction.workspaceSubmissionAccessGrant.update({
          where: { id: existing.id },
          data: { active: false, revokedAt: new Date() },
        });
        await transaction.workspaceAccessEvent.create({
          data: {
            workspaceId: actorMembership.workspaceId,
            submissionId: id,
            actorUserId: user.id,
            subjectUserId: targetUserId,
            action: 'ACCESS_REVOKED',
            previousRole: existing.role,
          },
        });
        return { kind: 'saved' as const, workspaceId: actorMembership.workspaceId };
      }

      if (existing?.active && existing.role === role) {
        return { kind: 'saved' as const, workspaceId: actorMembership.workspaceId };
      }
      const previousRole = existing?.active ? existing.role : null;
      if (existing) {
        await transaction.workspaceSubmissionAccessGrant.update({
          where: { id: existing.id },
          data: {
            role,
            active: true,
            grantedByUserId: user.id,
            revokedAt: null,
          },
        });
      } else {
        await transaction.workspaceSubmissionAccessGrant.create({
          data: { submissionId: id, userId: targetUserId, role, grantedByUserId: user.id },
        });
      }
      await transaction.workspaceAccessEvent.create({
        data: {
          workspaceId: actorMembership.workspaceId,
          submissionId: id,
          actorUserId: user.id,
          subjectUserId: targetUserId,
          action: previousRole === null ? 'ACCESS_GRANTED' : 'ACCESS_CHANGED',
          previousRole,
          newRole: role,
        },
      });
      return { kind: 'saved' as const, workspaceId: actorMembership.workspaceId };
    });
    if (result.kind === 'forbidden') {
      return NextResponse.json(
        { error: 'Solo la persona propietaria administra permisos.' },
        { status: 403 },
      );
    }
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    if (result.kind === 'invalid_member') {
      return NextResponse.json({ error: 'La cuenta ya no pertenece al equipo.' }, { status: 409 });
    }
    if (result.kind === 'sender') {
      return NextResponse.json(
        { error: 'La persona remitente conserva acceso propio y no necesita una concesión.' },
        { status: 409 },
      );
    }
    return NextResponse.json(await accessList(id, result.workspaceId));
  } catch {
    return NextResponse.json({ error: 'No se pudieron guardar los permisos.' }, { status: 500 });
  }
}

async function findOwnedSubmission(userId: string, submissionId: string) {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId },
    select: { workspaceId: true, role: true, workspace: { select: { ownerUserId: true } } },
  });
  if (!membership || membership.role !== 'OWNER' || membership.workspace.ownerUserId !== userId) {
    return null;
  }
  const submission = await prisma.financialAgentSubmission.findFirst({
    where: { id: submissionId, workspaceId: membership.workspaceId },
    select: { id: true, userId: true },
  });
  return submission
    ? { workspaceId: membership.workspaceId, senderUserId: submission.userId }
    : null;
}

async function accessList(submissionId: string, workspaceId: string) {
  const submission = await prisma.financialAgentSubmission.findFirst({
    where: { id: submissionId, workspaceId },
    select: { userId: true },
  });
  if (!submission) throw new Error('Submission not found in workspace');
  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId, role: 'MEMBER', userId: { not: submission.userId } },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: members.map((member) => member.userId) } },
    select: { id: true, name: true, email: true },
  });
  const grants = await prisma.workspaceSubmissionAccessGrant.findMany({
    where: { submissionId, userId: { in: members.map((member) => member.userId) }, active: true },
    select: { userId: true, role: true },
  });
  const userById = new Map(users.map((account) => [account.id, account]));
  const roleById = new Map(grants.map((grant) => [grant.userId, grant.role]));
  return WorkspaceSubmissionAccessList.parse({
    canManage: true,
    senderUserId: submission.userId,
    members: members.map(({ userId }) => {
      const account = userById.get(userId);
      const role = roleById.get(userId);
      return {
        userId,
        name: account?.name ?? null,
        email: account?.email ?? null,
        role: role === 'LECTOR' || role === 'REVISOR' ? role : null,
      };
    }),
  });
}

function validationResponse(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.map(String).join('.') || 'form'] ??= issue.message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}
