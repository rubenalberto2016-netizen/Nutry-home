// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import {
  canActivateConfiguration,
  canArchiveConfiguration,
} from '@/lib/business/financial-agent-configurations';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import {
  FinancialAgentConfigurationAction,
  FinancialAgentConfigurationItem,
} from '@/lib/contracts/financial-agent-configurations';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

class ConfigurationConflict extends Error {}

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

function nextUpdatedAt(current: Date) {
  return new Date(Math.max(Date.now(), current.getTime() + 1));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  const access = await findWorkspaceForUser(user.id);
  if (!access || !access.hasAccess) {
    return NextResponse.json({ error: 'El espacio requiere un pago confirmado.' }, { status: 403 });
  }
  if (!access.isOwner) {
    return NextResponse.json(
      { error: 'Solo la persona propietaria puede cambiar versiones.' },
      { status: 403 },
    );
  }

  const parsed = FinancialAgentConfigurationAction.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join('.') || 'form';
      errors[field] ??= issue.message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const { id, versionId } = await context.params;
  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const agent = await transaction.financialAgent.findFirst({
        where: { id, workspaceId: access.workspace.id },
        select: { id: true, activeConfigurationId: true, updatedAt: true },
      });
      if (!agent) return { kind: 'not-found' as const };

      const configuration = await transaction.financialAgentConfiguration.findFirst({
        where: { id: versionId, financialAgentId: agent.id },
      });
      if (!configuration) return { kind: 'not-found' as const };

      const version = {
        id: configuration.id,
        version: configuration.version,
        status: configuration.status,
      };

      if (parsed.data.action === 'activate') {
        if (!canActivateConfiguration(version, agent.activeConfigurationId)) {
          if (configuration.id === agent.activeConfigurationId) {
            return { kind: 'ok' as const, record: configuration };
          }
          throw new ConfigurationConflict('La versión archivada no se puede activar.');
        }

        const updatedAgent = await transaction.financialAgent.updateMany({
          where: {
            id: agent.id,
            workspaceId: access.workspace.id,
            updatedAt: agent.updatedAt,
          },
          data: {
            activeConfigurationId: configuration.id,
            updatedAt: nextUpdatedAt(agent.updatedAt),
          },
        });
        if (updatedAgent.count === 0) {
          throw new ConfigurationConflict(
            'El agente cambió. Actualiza el historial e inténtalo de nuevo.',
          );
        }

        await transaction.financialAgentConfiguration.updateMany({
          where: {
            financialAgentId: agent.id,
            status: 'active',
            id: { not: configuration.id },
          },
          data: { status: 'inactive' },
        });
        const activated = await transaction.financialAgentConfiguration.update({
          where: { id: configuration.id },
          data: { status: 'active', archivedAt: null },
        });
        return { kind: 'ok' as const, record: activated };
      }

      if (!canArchiveConfiguration(version, agent.activeConfigurationId)) {
        if (configuration.status === 'archived') {
          return { kind: 'ok' as const, record: configuration };
        }
        throw new ConfigurationConflict('Primero activa otra versión para archivar esta.');
      }

      const updatedAgent = await transaction.financialAgent.updateMany({
        where: {
          id: agent.id,
          workspaceId: access.workspace.id,
          updatedAt: agent.updatedAt,
        },
        data: { updatedAt: nextUpdatedAt(agent.updatedAt) },
      });
      if (updatedAgent.count === 0) {
        throw new ConfigurationConflict(
          'El agente cambió. Actualiza el historial e inténtalo de nuevo.',
        );
      }

      const archived = await transaction.financialAgentConfiguration.updateMany({
        where: {
          id: configuration.id,
          financialAgentId: agent.id,
          status: { in: ['draft', 'inactive'] },
        },
        data: { status: 'archived', archivedAt: new Date() },
      });
      if (archived.count === 0) {
        throw new ConfigurationConflict(
          'La versión cambió. Actualiza el historial e inténtalo de nuevo.',
        );
      }
      const record = await transaction.financialAgentConfiguration.findUniqueOrThrow({
        where: { id: configuration.id },
      });
      return { kind: 'ok' as const, record };
    });

    if (outcome.kind === 'not-found') {
      return NextResponse.json({ error: 'Agente o versión no encontrados' }, { status: 404 });
    }
    return NextResponse.json(toItem(outcome.record));
  } catch (error) {
    if (error instanceof ConfigurationConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo cambiar la versión.' }, { status: 500 });
  }
}
