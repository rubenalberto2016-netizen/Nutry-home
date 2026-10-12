// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import { AddWorkspaceMember, WorkspaceMemberList } from '@/lib/contracts/subscriptions';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function memberList(workspaceId: string | null, canManage: boolean) {
  if (!workspaceId) {
    return WorkspaceMemberList.parse({ workspaceId: null, canManage: false, items: [] });
  }
  const memberships = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((membership) => membership.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  return WorkspaceMemberList.parse({
    workspaceId,
    canManage,
    items: memberships.map((membership) => {
      const user = userById.get(membership.userId);
      return {
        id: membership.id,
        userId: membership.userId,
        email: user?.email ?? null,
        name: user?.name ?? null,
        role: membership.role === 'OWNER' ? 'OWNER' : 'MEMBER',
        createdAt: membership.createdAt.toISOString(),
      };
    }),
  });
}

export async function GET(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  try {
    const access = await findWorkspaceForUser(user.id);
    if (!access) return NextResponse.json(await memberList(null, false));
    return NextResponse.json(await memberList(access.workspace.id, access.isOwner));
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el equipo.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
  const access = await findWorkspaceForUser(user.id);
  if (!access)
    return NextResponse.json(
      { error: 'Primero inicia el checkout para crear tu espacio.' },
      { status: 404 },
    );
  if (!access.isOwner)
    return NextResponse.json(
      { error: 'Solo la persona propietaria administra miembros.' },
      { status: 403 },
    );

  const parsed = AddWorkspaceMember.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { email: 'Escribe un correo electrónico válido.' } },
      { status: 400 },
    );
  }
  const email = parsed.data.email.toLowerCase();
  try {
    const target = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, emailVerified: true },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: 'No encontramos una cuenta Vardelume existente con ese correo verificado.' },
        { status: 404 },
      );
    }
    if (target.id === user.id) {
      return NextResponse.json(
        { error: 'Ya eres la persona propietaria de este espacio.' },
        { status: 409 },
      );
    }
    const existing = await prisma.workspaceMembership.findUnique({ where: { userId: target.id } });
    if (existing) {
      return NextResponse.json(
        { error: 'Esa cuenta ya pertenece a un espacio de trabajo.' },
        { status: 409 },
      );
    }
    await prisma.workspaceMembership.create({
      data: { workspaceId: access.workspace.id, userId: target.id, role: 'MEMBER' },
    });
    return NextResponse.json(await memberList(access.workspace.id, true), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'No se pudo añadir la cuenta al equipo.' }, { status: 500 });
  }
}
