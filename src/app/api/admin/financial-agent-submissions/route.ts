// @polsia:user-owned
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FinancialAgentReviewQueue } from '@/lib/contracts/financial-agent-review';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const submissions = await prisma.financialAgentSubmission.findMany({
      select: {
        id: true,
        userId: true,
        reviewStatus: true,
        reviewResult: true,
        reviewUpdatedAt: true,
        submittedAt: true,
        agent: { select: { id: true, name: true, status: true } },
        workspace: { select: { id: true, name: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(submissions.map((submission) => submission.userId))] } },
      select: { id: true, name: true, email: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const payload = FinancialAgentReviewQueue.parse({
      items: submissions.map((submission) => {
        const client = usersById.get(submission.userId);
        return {
          id: submission.id,
          agent: submission.agent,
          workspace: submission.workspace,
          client: {
            id: submission.userId,
            name: client?.name ?? null,
            email: client?.email ?? null,
          },
          reviewStatus: submission.reviewStatus,
          reviewResult: submission.reviewResult,
          submittedAt: submission.submittedAt.toISOString(),
          reviewUpdatedAt: submission.reviewUpdatedAt?.toISOString() ?? null,
        };
      }),
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar la cola de evaluaciones.' },
      { status: 500 },
    );
  }
}
