// @polsia:user-owned
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AiConfigurationError } from '@/lib/ai/client';
import { auth } from '@/lib/auth';
import { FinancialAgentAiProxyError } from '@/lib/business/financial-agent-ai-errors';
import {
  extractFinancialAgentDocumentText,
  FinancialAgentDocumentTextError,
} from '@/lib/business/financial-agent-document-text';
import {
  FinancialAgentFilePolicyError,
  MAX_FINANCIAL_AGENT_SUBMISSION_BYTES,
} from '@/lib/business/financial-agent-file-policy';
import { translateFinancialAgentText } from '@/lib/business/financial-agent-translation';
import { FinancialAgentReviewAnswer } from '@/lib/contracts/financial-agent-review';
import {
  FinancialAgentTranslationItem,
  FinancialAgentTranslationList,
  FinancialAgentTranslationRequest,
} from '@/lib/contracts/financial-agent-translations';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return { response: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }) };
  if (session.user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 }) };
  }
  return { session };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdmin();
  if ('response' in authorization) return authorization.response;

  try {
    const { id } = await context.params;
    const submission = await prisma.financialAgentSubmission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!submission) return jsonError('Expediente no encontrado.', 404);

    const translations = await prisma.financialAgentTranslation.findMany({
      where: { submissionId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const approverIds = [
      ...new Set(
        translations.flatMap((translation) =>
          translation.approvedByUserId ? [translation.approvedByUserId] : [],
        ),
      ),
    ];
    const approvers =
      approverIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: approverIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const approversById = new Map(approvers.map((user) => [user.id, user]));

    const result = FinancialAgentTranslationList.parse({
      items: translations.map((translation) => {
        const approver = translation.approvedByUserId
          ? approversById.get(translation.approvedByUserId)
          : undefined;
        return FinancialAgentTranslationItem.parse({
          ...translation,
          createdAt: translation.createdAt.toISOString(),
          approvedAt: translation.approvedAt?.toISOString() ?? null,
          approvedByUserName: approver?.name ?? null,
          approvedByUserEmail: approver?.email ?? null,
        });
      }),
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudieron cargar las propuestas de traducción.', 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdmin();
  if ('response' in authorization) return authorization.response;

  const parsed = FinancialAgentTranslationRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join('.') || 'form';
      errors[field] ??= issue.message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const submission = await prisma.financialAgentSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        answers: true,
        questionSnapshot: true,
        documents: { select: { sizeBytes: true } },
      },
    });
    if (!submission) return jsonError('Expediente no encontrado.', 404);

    let sourceType: 'answer' | 'document';
    let sourceKey: string;
    let sourceLabel: string;
    let originalText: string;

    if (parsed.data.source.type === 'answer') {
      const answers = z.array(FinancialAgentReviewAnswer).parse(submission.answers);
      const questions = z.array(z.string()).parse(submission.questionSnapshot);
      const answer = answers[parsed.data.source.index];
      if (!answer) return jsonError('La respuesta no existe en este expediente.', 404);
      sourceType = 'answer';
      sourceKey = `answer:${parsed.data.source.index}`;
      sourceLabel = questions[parsed.data.source.index] ?? answer.question;
      originalText = answer.answer;
    } else {
      const document = await prisma.financialAgentSubmissionDocument.findFirst({
        where: { id: parsed.data.source.documentId, submissionId: id },
        select: {
          id: true,
          documentName: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          content: true,
        },
      });
      if (!document) return jsonError('Documento no encontrado en este expediente.', 404);
      if (!document.content) {
        return jsonError(
          'El archivo venció y sus bytes se eliminaron; ya no se puede traducir.',
          410,
        );
      }
      const submittedBytes = submission.documents.reduce(
        (total, item) => total + item.sizeBytes,
        0,
      );
      if (submittedBytes > MAX_FINANCIAL_AGENT_SUBMISSION_BYTES) {
        return jsonError('La entrega supera el límite permitido de 10 MiB.', 413);
      }

      try {
        originalText = await extractFinancialAgentDocumentText({
          fileName: document.fileName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          content: document.content,
        });
      } catch (error) {
        if (
          error instanceof FinancialAgentFilePolicyError ||
          error instanceof FinancialAgentDocumentTextError ||
          error instanceof AiConfigurationError ||
          error instanceof FinancialAgentAiProxyError
        ) {
          throw error;
        }
        throw new FinancialAgentDocumentTextError(
          'No se pudo extraer texto del documento. Comprueba que el archivo no esté dañado y vuelve a intentarlo.',
        );
      }
      sourceType = 'document';
      sourceKey = document.id;
      sourceLabel = document.documentName;
    }

    if (!originalText.trim()) return jsonError('La fuente no contiene texto para traducir.', 422);
    let translatedText: string;
    try {
      translatedText = await translateFinancialAgentText(originalText);
    } catch (error) {
      if (error instanceof AiConfigurationError || error instanceof FinancialAgentAiProxyError) {
        throw error;
      }
      throw new FinancialAgentAiProxyError();
    }
    if (!translatedText.trim()) return jsonError('La IA devolvió una propuesta vacía.', 502);

    const created = await prisma.financialAgentTranslation.create({
      data: {
        submissionId: id,
        sourceType,
        sourceKey,
        sourceLabel,
        originalText,
        translatedText,
        targetLanguage: 'es',
        status: 'pending',
      },
    });
    return NextResponse.json(
      FinancialAgentTranslationItem.parse({
        ...created,
        createdAt: created.createdAt.toISOString(),
        approvedAt: null,
        approvedByUserName: null,
        approvedByUserEmail: null,
      }),
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof FinancialAgentFilePolicyError) {
      return jsonError(error.message, error.kind === 'too_large' ? 413 : 422);
    }
    if (error instanceof FinancialAgentDocumentTextError) return jsonError(error.message, 422);
    if (error instanceof AiConfigurationError) {
      return jsonError('El servicio de traducción no está configurado.', 503);
    }
    if (error instanceof FinancialAgentAiProxyError) {
      return jsonError(
        'El servicio de IA no pudo procesar esta propuesta. Inténtalo de nuevo.',
        502,
      );
    }
    return jsonError('No se pudo generar la propuesta de traducción.', 500);
  }
}
