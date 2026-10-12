// @polsia:user-owned
import 'server-only';
import { Buffer } from 'node:buffer';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  FinancialAgentReviewDocument,
  FinancialAgentReviewDocumentContent,
  FinancialAgentReviewDocumentPatchSchema,
} from '@/lib/contracts/financial-agent-review';
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  try {
    const { id, documentId } = await context.params;
    const document = await prisma.financialAgentSubmissionDocument.findFirst({
      where: { id: documentId, submissionId: id },
      select: {
        fileName: true,
        mimeType: true,
        content: true,
        deletedAt: true,
        submission: { select: { workspaceId: true } },
      },
    });
    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado en este expediente.' },
        { status: 404 },
      );
    }

    await prisma.workspaceAccessEvent.create({
      data: {
        workspaceId: document.submission.workspaceId,
        submissionId: id,
        documentId,
        actorUserId: session.user.id,
        action: 'DOCUMENT_OPENED',
      },
    });
    if (!document.content || document.deletedAt) {
      return NextResponse.json(
        { error: 'El archivo venció y sus bytes se eliminaron; los metadatos siguen disponibles.' },
        { status: 410 },
      );
    }

    const payload = FinancialAgentReviewDocumentContent.parse({
      fileName: document.fileName,
      mimeType: document.mimeType,
      base64: Buffer.from(document.content).toString('base64'),
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el documento.' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = FinancialAgentReviewDocumentPatchSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error);

  try {
    const { id, documentId } = await context.params;
    const updated = await prisma.financialAgentSubmissionDocument.updateMany({
      where: { id: documentId, submissionId: id },
      data: parsed.data,
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: 'Documento no encontrado en este expediente.' },
        { status: 404 },
      );
    }

    const document = await prisma.financialAgentSubmissionDocument.findFirst({
      where: { id: documentId, submissionId: id },
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
    });
    if (!document) {
      return NextResponse.json(
        { error: 'Documento no encontrado en este expediente.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      FinancialAgentReviewDocument.parse({
        ...document,
        createdAt: document.createdAt.toISOString(),
        deletedAt: document.deletedAt?.toISOString() ?? null,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el documento.' }, { status: 500 });
  }
}
