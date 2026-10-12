// @polsia:user-owned
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import {
  decodeAndValidateFinancialAgentFile,
  FinancialAgentFilePolicyError,
  validateFinancialAgentSubmissionSize,
} from '@/lib/business/financial-agent-file-policy';
import { findWorkspaceForUser } from '@/lib/business/workspace-access';
import {
  FinancialAgentEvaluationConfig,
  FinancialAgentEvaluationSubmit,
  FinancialAgentEvaluationSubmitResult,
} from '@/lib/contracts/financial-agent-submissions';
import { FinancialAgentItem } from '@/lib/contracts/financial-agents';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const MAX_REQUEST_BYTES = 15 * 1024 * 1024;

function validationResponse(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join('.') || 'form';
    errors[field] ??= issue.message;
  }
  return NextResponse.json({ errors }, { status: 400 });
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function getUser(request: Request): Promise<SessionUser | Response> {
  try {
    return await requireAuth(request);
  } catch (response) {
    return response as Response;
  }
}

function evaluationAgent(record: {
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

function configurationResponse(
  record: Parameters<typeof evaluationAgent>[0],
  submittedAt: Date | null,
) {
  const item = evaluationAgent(record);
  return FinancialAgentEvaluationConfig.parse({
    agent: {
      id: item.id,
      name: item.name,
      objective: item.objective,
      questions: item.questions,
      requestedDocuments: item.requestedDocuments,
    },
    submission: submittedAt ? { submittedAt: submittedAt.toISOString() } : null,
  });
}

async function authorizedWorkspace(userId: string) {
  const access = await findWorkspaceForUser(userId);
  if (!access || !access.hasAccess) return null;
  return access;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  try {
    const access = await authorizedWorkspace(user.id);
    if (!access) return errorResponse('El espacio requiere un pago confirmado.', 403);

    const { id } = await context.params;
    const agent = await prisma.financialAgent.findFirst({
      where: { id, workspaceId: access.workspace.id, status: 'published' },
    });
    if (!agent) return errorResponse('No encontramos un agente publicado en este espacio.', 404);

    const submission = await prisma.financialAgentSubmission.findUnique({
      where: { agentId_userId: { agentId: agent.id, userId: user.id } },
      select: { submittedAt: true },
    });
    return NextResponse.json(configurationResponse(agent, submission?.submittedAt ?? null), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return errorResponse('No se pudo cargar la evaluación.', 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser(request);
  if (user instanceof Response) return user;

  try {
    const access = await authorizedWorkspace(user.id);
    if (!access) return errorResponse('El espacio requiere un pago confirmado.', 403);

    const { id } = await context.params;
    const agent = await prisma.financialAgent.findFirst({
      where: { id, workspaceId: access.workspace.id, status: 'published' },
    });
    if (!agent) return errorResponse('No encontramos un agente publicado en este espacio.', 404);

    const existingSubmission = await prisma.financialAgentSubmission.findUnique({
      where: { agentId_userId: { agentId: id, userId: user.id } },
      select: { id: true },
    });
    if (existingSubmission) return errorResponse('Esta evaluación ya fue enviada.', 409);

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return errorResponse('La entrega admite hasta 10 MiB de archivos.', 413);
    }

    const parsed = FinancialAgentEvaluationSubmit.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationResponse(parsed.error);

    const config = configurationResponse(agent, null).agent;
    if (parsed.data.answers.length !== config.questions.length) {
      return errorResponse('Completa todas las preguntas de esta evaluación.', 400);
    }
    if (parsed.data.files.length !== config.requestedDocuments.length) {
      return errorResponse('Adjunta un archivo por cada documento solicitado.', 400);
    }

    const fileNames = new Set(parsed.data.files.map((file) => file.documentName));
    if (
      fileNames.size !== parsed.data.files.length ||
      config.requestedDocuments.some((name) => !fileNames.has(name))
    ) {
      return errorResponse('Los archivos no coinciden con los documentos solicitados.', 400);
    }

    try {
      validateFinancialAgentSubmissionSize(parsed.data.files.map((file) => file.sizeBytes));
      for (const file of parsed.data.files) decodeAndValidateFinancialAgentFile(file);
    } catch (error) {
      if (error instanceof FinancialAgentFilePolicyError) {
        return errorResponse(error.message, error.kind === 'too_large' ? 413 : 400);
      }
      return errorResponse('No se pudieron validar los archivos de la entrega.', 400);
    }

    const transactionResult = await prisma.$transaction(async (transaction) => {
      const current = await transaction.financialAgent.findFirst({
        where: { id, workspaceId: access.workspace.id, status: 'published' },
      });
      if (!current) return { kind: 'not_found' as const };

      const currentConfig = configurationResponse(current, null).agent;
      const requirementsChanged =
        currentConfig.questions.length !== parsed.data.answers.length ||
        currentConfig.requestedDocuments.length !== parsed.data.files.length ||
        currentConfig.requestedDocuments.some((name) => !fileNames.has(name));
      if (requirementsChanged) return { kind: 'changed' as const };

      const existing = await transaction.financialAgentSubmission.findUnique({
        where: { agentId_userId: { agentId: id, userId: user.id } },
        select: { id: true },
      });
      if (existing) return { kind: 'duplicate' as const };

      const answers = currentConfig.questions.map((question, index) => ({
        question,
        answer: parsed.data.answers[index] ?? '',
      }));
      const decodedFiles = parsed.data.files.map((file) => ({
        documentName: file.documentName,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        content: decodeAndValidateFinancialAgentFile(file),
      }));

      const submission = await transaction.financialAgentSubmission.create({
        data: {
          agentId: id,
          workspaceId: access.workspace.id,
          userId: user.id,
          answers,
          questionSnapshot: currentConfig.questions,
          requestedDocumentsSnapshot: currentConfig.requestedDocuments,
          documents: { create: decodedFiles },
        },
        select: { submittedAt: true },
      });
      return { kind: 'created' as const, submittedAt: submission.submittedAt };
    });

    if (transactionResult.kind === 'not_found') {
      return errorResponse('No encontramos un agente publicado en este espacio.', 404);
    }
    if (transactionResult.kind === 'changed') {
      return errorResponse('El agente cambió. Actualiza la página antes de enviar.', 409);
    }
    if (transactionResult.kind === 'duplicate') {
      return errorResponse('Esta evaluación ya fue enviada.', 409);
    }

    return NextResponse.json(
      FinancialAgentEvaluationSubmitResult.parse({
        submittedAt: transactionResult.submittedAt.toISOString(),
      }),
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return errorResponse('Esta evaluación ya fue enviada.', 409);
    }
    if (error instanceof FinancialAgentFilePolicyError) {
      return errorResponse(error.message, error.kind === 'too_large' ? 413 : 400);
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse('La configuración de esta evaluación no es válida.', 500);
    }
    return errorResponse('No se pudo guardar la evaluación. Inténtalo de nuevo.', 500);
  }
}
