// @polsia:user-owned
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  approveFinancialAgentTranslation,
  FinancialAgentTranslationTransitionError,
} from '@/lib/business/financial-agent-translation-state';
import {
  FinancialAgentTranslationApproval,
  FinancialAgentTranslationItem,
  FinancialAgentTranslationStatus,
} from '@/lib/contracts/financial-agent-translations';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; translationId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const parsed = FinancialAgentTranslationApproval.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { action: parsed.error.issues[0]?.message ?? 'Acción no válida.' } },
      { status: 400 },
    );
  }

  try {
    const { id, translationId } = await context.params;
    const transition = await prisma.$transaction(async (transaction) => {
      const current = await transaction.financialAgentTranslation.findFirst({
        where: { id: translationId, submissionId: id },
        select: { status: true },
      });
      if (!current) return { kind: 'not_found' as const };

      const approvedAt = new Date();
      let approval: ReturnType<typeof approveFinancialAgentTranslation>;
      try {
        approval = approveFinancialAgentTranslation(
          FinancialAgentTranslationStatus.parse(current.status),
          session.user.id,
          approvedAt,
        );
      } catch (error) {
        if (error instanceof FinancialAgentTranslationTransitionError) {
          return { kind: 'conflict' as const, message: error.message };
        }
        throw error;
      }

      const updated = await transaction.financialAgentTranslation.updateMany({
        where: { id: translationId, submissionId: id, status: 'pending' },
        data: approval,
      });
      if (updated.count !== 1) {
        return {
          kind: 'conflict' as const,
          message: 'La propuesta cambió durante la aprobación. Recarga el expediente.',
        };
      }
      return { kind: 'approved' as const, approvedAt };
    });

    if (transition.kind === 'not_found') {
      return NextResponse.json(
        { error: 'Propuesta no encontrada en este expediente.' },
        { status: 404 },
      );
    }
    if (transition.kind === 'conflict') {
      return NextResponse.json({ error: transition.message }, { status: 409 });
    }

    const item = await prisma.financialAgentTranslation.findFirst({
      where: { id: translationId, submissionId: id },
    });
    if (!item) {
      return NextResponse.json(
        { error: 'Propuesta no encontrada en este expediente.' },
        { status: 404 },
      );
    }
    const approver = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    return NextResponse.json(
      FinancialAgentTranslationItem.parse({
        ...item,
        createdAt: item.createdAt.toISOString(),
        approvedAt: transition.approvedAt.toISOString(),
        approvedByUserName: approver?.name ?? null,
        approvedByUserEmail: approver?.email ?? null,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'No se pudo aprobar la propuesta.' }, { status: 500 });
  }
}
