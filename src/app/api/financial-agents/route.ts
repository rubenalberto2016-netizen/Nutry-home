// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { initialConfigurationData } from '@/lib/business/financial-agent-configurations';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import {
  FinancialAgentAvailabilityQuery,
  FinancialAgentCreate,
  FinancialAgentItem,
  FinancialAgentList,
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

export async function GET(request: Request) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  try {
    const query = FinancialAgentAvailabilityQuery.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!query.success) return validationResponse(query.error);

    const access = await findWorkspaceForUser(user.id);
    if (!access || !access.hasAccess) {
      return NextResponse.json(
        { error: 'El espacio requiere un pago confirmado.' },
        { status: 403 },
      );
    }
    const records = await prisma.financialAgent.findMany({
      where: {
        workspaceId: access.workspace.id,
        ...(query.data.availability === 'published' ? { status: 'published' } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    const payload = FinancialAgentList.parse({ items: records.map(toItem) });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron cargar los agentes del espacio' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  const access = await findWorkspaceForUser(user.id);
  if (!access || !access.hasAccess) {
    return NextResponse.json({ error: 'El espacio requiere un pago confirmado.' }, { status: 403 });
  }
  if (!access.isOwner) {
    return NextResponse.json(
      { error: 'Los miembros pueden consultar borradores, pero no crearlos.' },
      { status: 403 },
    );
  }

  const parsed = FinancialAgentCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationResponse(parsed.error);

  try {
    const record = await prisma.$transaction(async (transaction) => {
      const agent = await transaction.financialAgent.create({
        data: {
          ...parsed.data,
          userId: user.id,
          workspaceId: access.workspace.id,
          status: 'draft',
        },
      });
      const configuration = await transaction.financialAgentConfiguration.create({
        data: initialConfigurationData(agent.id, user.id),
      });
      await transaction.financialAgent.update({
        where: { id: agent.id },
        data: { activeConfigurationId: configuration.id },
      });
      return agent;
    });
    return NextResponse.json(toItem(record), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el agente' }, { status: 500 });
  }
}
