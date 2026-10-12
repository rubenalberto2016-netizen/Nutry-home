// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { canTransitionFinancialAgentStatus } from '@/lib/business/financial-agent-status';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import {
  FinancialAgentItem,
  FinancialAgentPatch,
  FinancialAgentRequestedDocumentsPatch,
  FinancialAgentStatusChange,
} from '@/lib/contracts/financial-agents';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function validationResponse(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join('.') || 'form';
    errors[field] ??= issue.message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}

function toItem(record: {
  id: string;
  name: string;
  objective: string;
  questions: unknown;
  requestedDocuments: unknown;
  status: string;
  updatedAt: Date;
}) {
  return FinancialAgentItem.parse({
    id: record.id,
    name: record.name,
    objective: record.objective,
    questions: record.questions,
    requestedDocuments: record.requestedDocuments ?? [],
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
  });
}

async function getUser(request: Request): Promise<SessionUser | Response> {
  try {
    return await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  const access = await findWorkspaceForUser(user.id);
  if (!access || !access.hasAccess) {
    return NextResponse.json({ error: 'El espacio requiere un pago confirmado.' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (typeof body === 'object' && body !== null && 'status' in body) {
    const parsedStatus = FinancialAgentStatusChange.safeParse(body);
    if (!parsedStatus.success) return validationResponse(parsedStatus.error);

    try {
      const current = await prisma.financialAgent.findFirst({
        where: { id, workspaceId: access.workspace.id },
      });
      if (!current) {
        return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
      }
      if (!canTransitionFinancialAgentStatus(current.status, parsedStatus.data.status)) {
        return NextResponse.json(
          { error: 'La transición ya no corresponde al estado actual del agente.' },
          { status: 409 },
        );
      }

      const result = await prisma.financialAgent.updateMany({
        where: { id, workspaceId: access.workspace.id, status: current.status },
        data: { status: parsedStatus.data.status },
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: 'El agente cambió de estado. Actualiza la lista e inténtalo de nuevo.' },
          { status: 409 },
        );
      }

      const updated = await prisma.financialAgent.findFirst({
        where: { id, workspaceId: access.workspace.id },
      });
      if (!updated) {
        return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
      }
      return NextResponse.json(toItem(updated));
    } catch {
      return NextResponse.json(
        { error: 'No se pudo cambiar el estado del agente' },
        { status: 500 },
      );
    }
  }

  try {
    const current = await prisma.financialAgent.findFirst({
      where: { id, workspaceId: access.workspace.id },
    });
    if (!current) {
      return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
    }
    if (!access.isOwner) {
      return NextResponse.json(
        { error: 'Solo la persona propietaria del espacio puede editar agentes.' },
        { status: 403 },
      );
    }

    if (current.status === 'published') {
      const parsedDocuments = FinancialAgentRequestedDocumentsPatch.safeParse(body);
      if (!parsedDocuments.success) return validationResponse(parsedDocuments.error);

      const result = await prisma.financialAgent.updateMany({
        where: { id, workspaceId: access.workspace.id, status: 'published' },
        data: parsedDocuments.data,
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: 'El agente cambió de estado. Actualiza la lista e inténtalo de nuevo.' },
          { status: 409 },
        );
      }
      const updated = await prisma.financialAgent.findFirst({
        where: { id, workspaceId: access.workspace.id, status: 'published' },
      });
      if (!updated) {
        return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });
      }
      return NextResponse.json(toItem(updated));
    }

    const parsed = FinancialAgentPatch.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);
    if (current.status !== 'draft') {
      return NextResponse.json(
        { error: 'Solo se pueden editar agentes en borrador.' },
        { status: 409 },
      );
    }

    const result = await prisma.financialAgent.updateMany({
      where: { id, workspaceId: access.workspace.id, status: 'draft' },
      data: parsed.data,
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'El agente cambió de estado. Actualiza la lista e inténtalo de nuevo.' },
        { status: 409 },
      );
    }

    const record = await prisma.financialAgent.findFirst({
      where: { id, workspaceId: access.workspace.id, status: 'draft' },
    });
    if (!record) {
      return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 });
    }
    return NextResponse.json(toItem(record));
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar el agente' }, { status: 500 });
  }
}
