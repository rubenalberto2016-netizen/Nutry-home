// @polsia:user-owned
import 'server-only';
import { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  buildFinancialAgentReviewEvent,
  FinancialAgentReviewTransitionError,
  transitionFinancialAgentReview,
} from '@/lib/business/financial-agent-review';
import {
  FinancialAgentReviewDetail,
  FinancialAgentReviewPatch,
  FinancialAgentReviewStatusSchema,
} from '@/lib/contracts/financial-agent-review';
import { FinancialAgentStatusSchema } from '@/lib/contracts/financial-agents';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function validationResponse(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join('.') || 'form';
    errors[field] ??= issue.message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}

async function loadDetail(id: string) {
  const submission = await prisma.financialAgentSubmission.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      answers: true,
      questionSnapshot: true,
      requestedDocumentsSnapshot: true,
      submittedAt: true,
      reviewStatus: true,
      reviewResult: true,
      reviewUpdatedAt: true,
      agent: { select: { id: true, name: true, status: true } },
      workspace: { select: { id: true, name: true } },
      documents: {
        select: {
          id: true,
          documentName: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          classification: true,
          status: true,
          createdAt: true,
          deletedAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      reviewEvents: {
        select: {
          id: true,
          reviewerUserId: true,
          action: true,
          previousStatus: true,
          newStatus: true,
          resultSnapshot: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!submission) return null;

  const rawAnswers = z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .parse(submission.answers);
  const questions = z.array(z.string()).parse(submission.questionSnapshot);
  const requestedDocuments = z.array(z.string()).parse(submission.requestedDocumentsSnapshot);
  const reviewerIds = submission.reviewEvents.map((event) => event.reviewerUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set([submission.userId, ...reviewerIds])] } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const client = usersById.get(submission.userId);

  return FinancialAgentReviewDetail.parse({
    id: submission.id,
    agent: {
      ...submission.agent,
      status: FinancialAgentStatusSchema.parse(submission.agent.status),
    },
    workspace: submission.workspace,
    client: {
      id: submission.userId,
      name: client?.name ?? null,
      email: client?.email ?? null,
    },
    answers: rawAnswers.map((item, index) => ({
      question: questions[index] ?? item.question,
      answer: item.answer,
    })),
    requestedDocuments,
    documents: submission.documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
      deletedAt: document.deletedAt?.toISOString() ?? null,
    })),
    submittedAt: submission.submittedAt.toISOString(),
    review: {
      status: submission.reviewStatus,
      result: submission.reviewResult,
      updatedAt: submission.reviewUpdatedAt?.toISOString() ?? null,
    },
    events: submission.reviewEvents.map((event) => {
      const reviewer = usersById.get(event.reviewerUserId);
      return {
        ...event,
        reviewerName: reviewer?.name ?? null,
        reviewerEmail: reviewer?.email ?? null,
        occurredAt: event.occurredAt.toISOString(),
      };
    }),
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const detail = await loadDetail(id);
    if (!detail) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    await prisma.workspaceAccessEvent.create({
      data: {
        workspaceId: detail.workspace.id,
        submissionId: id,
        actorUserId: session.user.id,
        action: 'SUBMISSION_OPENED',
      },
    });
    return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo cargar el expediente de evaluación.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const parsed = FinancialAgentReviewPatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationResponse(parsed.error);

  try {
    const { id } = await context.params;
    const result = await prisma.$transaction(
      async (transaction) => {
        const current = await transaction.financialAgentSubmission.findUnique({
          where: { id },
          select: { reviewStatus: true, reviewUpdatedAt: true },
        });
        if (!current) return { kind: 'not_found' as const };

        let transition: ReturnType<typeof transitionFinancialAgentReview>;
        try {
          transition = transitionFinancialAgentReview(
            FinancialAgentReviewStatusSchema.parse(current.reviewStatus),
            parsed.data.action,
          );
        } catch (error) {
          if (error instanceof FinancialAgentReviewTransitionError) {
            return { kind: 'conflict' as const, message: error.message };
          }
          throw error;
        }

        const updated = await transaction.financialAgentSubmission.updateMany({
          where: {
            id,
            reviewStatus: current.reviewStatus,
            reviewUpdatedAt: current.reviewUpdatedAt,
          },
          data: {
            reviewStatus: transition.newStatus,
            reviewResult: parsed.data.reviewResult,
            reviewUpdatedAt: new Date(),
          },
        });
        if (updated.count !== 1) {
          return {
            kind: 'conflict' as const,
            message: 'El expediente cambió durante la revisión. Recarga e inténtalo de nuevo.',
          };
        }

        await transaction.financialAgentReviewEvent.create({
          data: buildFinancialAgentReviewEvent({
            submissionId: id,
            reviewerUserId: session.user.id,
            action: parsed.data.action,
            previousStatus: transition.previousStatus,
            newStatus: transition.newStatus,
            resultSnapshot: parsed.data.reviewResult,
          }),
        });
        return { kind: 'updated' as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    const detail = await loadDetail(id);
    if (!detail) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json(
        { error: 'El expediente cambió durante la revisión. Recarga e inténtalo de nuevo.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'No se pudo guardar la revisión.' }, { status: 500 });
  }
}
