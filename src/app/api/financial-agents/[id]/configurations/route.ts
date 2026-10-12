// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import {
  initialConfigurationData,
  newDraftConfigurationData,
  nextConfigurationVersion,
} from '@/lib/business/financial-agent-configurations';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import {
  FinancialAgentConfigurationInput,
  FinancialAgentConfigurationItem,
  FinancialAgentConfigurationList,
} from '@/lib/contracts/financial-agent-configurations';
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
  financialAgentId: string;
  version: number;
  rules: string;
  instructions: string;
  supervisionLevel: string;
  status: string;
  archivedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
}) {
  return FinancialAgentConfigurationItem.parse({
    ...record,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  });
}

async function getUser(request: Request): Promise<SessionUser | Response> {
  try {
    return await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
}

async function ensureInitialConfiguration(
  agentId: string,
  workspaceId: string,
  createdByUserId: string,
) {
  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.financialAgentConfiguration.findFirst({
        where: { financialAgentId: agentId },
        select: { id: true },
      });
      if (existing) return;

      const agent = await transaction.financialAgent.findFirst({
        where: { id: agentId, workspaceId },
        select: { id: true },
      });
      if (!agent) return;

      const configuration = await transaction.financialAgentConfiguration.create({
        data: initialConfigurationData(agentId, createdByUserId),
      });
      await transaction.financialAgent.updateMany({
        where: { id: agentId, workspaceId },
        data: { activeConfigurationId: configuration.id },
      });
    });
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
    // A concurrent first read won the unique (agent, version) insert.
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  const access = await findWorkspaceForUser(user.id);
  if (!access || !access.hasAccess) {
    return NextResponse.json({ error: 'El espacio requiere un pago confirmado.' }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const agent = await prisma.financialAgent.findFirst({
      where: { id, workspaceId: access.workspace.id },
      select: { id: true, activeConfigurationId: true, userId: true },
    });
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });

    await ensureInitialConfiguration(agent.id, access.workspace.id, agent.userId);
    const currentAgent = await prisma.financialAgent.findFirst({
      where: { id: agent.id, workspaceId: access.workspace.id },
      select: { activeConfigurationId: true },
    });
    const records = await prisma.financialAgentConfiguration.findMany({
      where: { financialAgentId: agent.id },
      orderBy: { version: 'desc' },
    });
    const payload = FinancialAgentConfigurationList.parse({
      items: records.map(toItem),
      activeConfigurationId: currentAgent?.activeConfigurationId ?? null,
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar el historial de configuración.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  const access = await findWorkspaceForUser(user.id);
  if (!access || !access.hasAccess) {
    return NextResponse.json({ error: 'El espacio requiere un pago confirmado.' }, { status: 403 });
  }
  if (!access.isOwner) {
    return NextResponse.json(
      { error: 'Solo la persona propietaria puede crear versiones.' },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const agent = await prisma.financialAgent.findFirst({
    where: { id, workspaceId: access.workspace.id },
    select: { id: true, userId: true },
  });
  if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 });

  const parsed = FinancialAgentConfigurationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationResponse(parsed.error);

  try {
    await ensureInitialConfiguration(agent.id, access.workspace.id, agent.userId);
    const created = await prisma.$transaction(async (transaction) => {
      const versions = await transaction.financialAgentConfiguration.findMany({
        where: { financialAgentId: agent.id },
        select: { id: true, version: true, status: true },
      });
      const version = nextConfigurationVersion(versions);
      return transaction.financialAgentConfiguration.create({
        data: newDraftConfigurationData(agent.id, user.id, version, parsed.data),
      });
    });
    return NextResponse.json(toItem(created), { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'El historial cambió. Actualízalo y crea la versión de nuevo.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'No se pudo crear la versión.' }, { status: 500 });
  }
}
