// @polsia:user-owned
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import type { SessionUser } from '@/lib/require-auth';

export async function requireEditorialWorkspace(_request: Request) {
  let user: SessionUser;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return {
        response: NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 }),
      };
    user = session.user;
  } catch {
    return {
      response: NextResponse.json({ error: 'No se pudo validar la sesión.' }, { status: 401 }),
    };
  }

  const access = await findWorkspaceForUser(user.id);
  if (!access || !access.hasAccess) {
    return {
      response: NextResponse.json({ error: 'El espacio no tiene acceso activo.' }, { status: 403 }),
    };
  }
  return { user, workspaceId: access.workspace.id };
}

export async function requireEditorialAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 }) };
  }
  return { user: session.user };
}
