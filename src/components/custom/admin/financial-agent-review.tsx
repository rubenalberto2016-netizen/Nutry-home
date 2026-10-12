// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type FinancialAgentReviewDetail as FinancialAgentReviewDetailData,
  FinancialAgentReviewDetail as FinancialAgentReviewDetailSchema,
  FinancialAgentReviewDocumentContent,
  FinancialAgentReviewDocument as FinancialAgentReviewDocumentSchema,
  type FinancialAgentReviewDocumentStatus,
  FinancialAgentReviewDocumentStatusSchema,
  type FinancialAgentReviewStatus,
} from '@/lib/contracts/financial-agent-review';
import {
  type FinancialAgentTranslationItem as FinancialAgentTranslationItemData,
  FinancialAgentTranslationItem as FinancialAgentTranslationItemSchema,
  FinancialAgentTranslationList as FinancialAgentTranslationListSchema,
  type FinancialAgentTranslationSource,
} from '@/lib/contracts/financial-agent-translations';

const reviewLabels: Record<FinancialAgentReviewStatus, string> = {
  pending_review: 'Pendiente de revisión',
  in_review: 'En revisión',
  approved: 'Aprobada',
};

const agentLabels = { draft: 'Borrador', published: 'Publicado', retired: 'Retirado' };

const documentStatusLabels: Record<FinancialAgentReviewDocumentStatus, string> = {
  pending: 'Pendiente',
  reviewed: 'Revisado',
  rejected: 'Rechazado',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function responseBody(error: unknown) {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== 'object') return null;
  return error.cause as { error?: unknown; errors?: Record<string, unknown> };
}

function errorMessage(error: unknown) {
  const body = responseBody(error);
  if (typeof body?.error === 'string') return body.error;
  return error instanceof Error ? error.message : 'No se pudo cargar el expediente.';
}

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const translationStatusLabels = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobada',
} as const;

function TranslationReviewPanel({
  translation,
  loading,
  approving,
  error,
  onGenerate,
  onApprove,
}: {
  translation: FinancialAgentTranslationItemData | undefined;
  loading: boolean;
  approving: boolean;
  error: string | undefined;
  onGenerate: () => void;
  onApprove: (translationId: string) => void;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Traducción jurídica</h4>
          <p className="text-xs text-muted-foreground">La propuesta requiere aprobación humana.</p>
        </div>
        <Button type="button" variant="outline" onClick={onGenerate} disabled={loading}>
          {loading ? 'Generando…' : translation ? 'Generar nueva propuesta' : 'Proponer traducción'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {translation ? (
        <>
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <div className="min-w-0 rounded-md border border-border bg-background p-3">
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Original
              </h5>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {translation.originalText}
              </p>
            </div>
            <div className="min-w-0 rounded-md border border-primary/30 bg-background p-3">
              <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Propuesta de IA · español
              </h5>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {translation.translatedText}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span>{translationStatusLabels[translation.status]}</span>
              {translation.status === 'approved' && translation.approvedAt ? (
                <span>
                  Aprobada por{' '}
                  {translation.approvedByUserName ??
                    translation.approvedByUserEmail ??
                    translation.approvedByUserId}{' '}
                  · {formatDate(translation.approvedAt)}
                </span>
              ) : null}
            </div>
            {translation.status === 'pending' ? (
              <Button type="button" onClick={() => onApprove(translation.id)} disabled={approving}>
                {approving ? 'Aprobando…' : 'Aprobar traducción'}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function FinancialAgentReview({ submissionId }: { submissionId: string }) {
  const [detail, setDetail] = useState<FinancialAgentReviewDetailData | null>(null);
  const [reviewResult, setReviewResult] = useState('');
  const [resultError, setResultError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [classificationDraft, setClassificationDraft] = useState('');
  const [documentStatusDraft, setDocumentStatusDraft] =
    useState<FinancialAgentReviewDocumentStatus>('pending');
  const [savingDocument, setSavingDocument] = useState(false);
  const [documentEditError, setDocumentEditError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<FinancialAgentTranslationItemData[]>([]);
  const [translationLoadError, setTranslationLoadError] = useState<string | null>(null);
  const [translatingSourceKey, setTranslatingSourceKey] = useState<string | null>(null);
  const [translationErrors, setTranslationErrors] = useState<Record<string, string>>({});
  const [approvingTranslationId, setApprovingTranslationId] = useState<string | null>(null);
  const objectUrls = useRef(new Set<string>());

  const loadTranslations = useCallback(async () => {
    setTranslationLoadError(null);
    try {
      const result = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}/translations`,
        { schema: FinancialAgentTranslationListSchema },
      );
      setTranslations(result.items);
    } catch (caught) {
      setTranslationLoadError(errorMessage(caught));
    }
  }, [submissionId]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}`,
        { schema: FinancialAgentReviewDetailSchema },
      );
      setDetail(result);
      setReviewResult(result.review.result ?? '');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadTranslations();
  }, [loadTranslations]);

  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  async function saveReview(action: 'saved' | 'approved') {
    setSaving(true);
    setResultError(null);
    try {
      const updated = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action, reviewResult }),
          schema: FinancialAgentReviewDetailSchema,
        },
      );
      setDetail(updated);
      setReviewResult(updated.review.result ?? '');
      toast.success(action === 'approved' ? 'Resultado aprobado' : 'Resultado guardado');
    } catch (caught) {
      const body = responseBody(caught);
      const fieldMessage = body?.errors?.reviewResult;
      if (typeof fieldMessage === 'string') {
        setResultError(fieldMessage);
      } else {
        toast.error(errorMessage(caught));
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadDocument(documentId: string) {
    setLoadingDocument(documentId);
    try {
      const document = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}/documents/${encodeURIComponent(documentId)}`,
        { schema: FinancialAgentReviewDocumentContent },
      );
      const binary = window.atob(document.base64);
      const buffer = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(buffer);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const url = URL.createObjectURL(new Blob([buffer], { type: document.mimeType }));
      objectUrls.current.add(url);
      setDocumentUrls((current) => ({ ...current, [documentId]: url }));
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setLoadingDocument(null);
    }
  }

  async function saveDocument() {
    if (!selectedDocumentId) return;
    setSavingDocument(true);
    setDocumentEditError(null);
    try {
      const updated = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}/documents/${encodeURIComponent(selectedDocumentId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            classification: classificationDraft,
            status: documentStatusDraft,
          }),
          schema: FinancialAgentReviewDocumentSchema,
        },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((document) =>
                document.id === updated.id ? updated : document,
              ),
            }
          : current,
      );
      setClassificationDraft(updated.classification);
      setDocumentStatusDraft(updated.status);
      toast.success('Documento actualizado');
    } catch (caught) {
      const body = responseBody(caught);
      const classificationError = body?.errors?.classification;
      const statusError = body?.errors?.status;
      if (typeof classificationError === 'string') {
        setDocumentEditError(classificationError);
      } else if (typeof statusError === 'string') {
        setDocumentEditError(statusError);
      } else {
        toast.error(errorMessage(caught));
      }
    } finally {
      setSavingDocument(false);
    }
  }

  async function generateTranslation(source: FinancialAgentTranslationSource) {
    const sourceKey = source.type === 'answer' ? `answer:${source.index}` : source.documentId;
    setTranslatingSourceKey(sourceKey);
    setTranslationErrors((current) => ({ ...current, [sourceKey]: '' }));
    try {
      const created = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}/translations`,
        {
          method: 'POST',
          body: JSON.stringify({ source }),
          schema: FinancialAgentTranslationItemSchema,
        },
      );
      setTranslations((current) => [created, ...current]);
      toast.success('Propuesta de traducción generada');
    } catch (caught) {
      setTranslationErrors((current) => ({ ...current, [sourceKey]: errorMessage(caught) }));
    } finally {
      setTranslatingSourceKey(null);
    }
  }

  async function approveTranslation(translationId: string) {
    setApprovingTranslationId(translationId);
    try {
      const approved = await apiFetch(
        `/api/admin/financial-agent-submissions/${encodeURIComponent(submissionId)}/translations/${encodeURIComponent(translationId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action: 'approve' }),
          schema: FinancialAgentTranslationItemSchema,
        },
      );
      setTranslations((current) =>
        current.map((translation) => (translation.id === approved.id ? approved : translation)),
      );
      toast.success('Traducción aprobada');
    } catch (caught) {
      toast.error(errorMessage(caught));
      void loadTranslations();
    } finally {
      setApprovingTranslationId(null);
    }
  }

  function latestTranslation(sourceType: 'answer' | 'document', sourceKey: string) {
    return translations.find(
      (translation) => translation.sourceType === sourceType && translation.sourceKey === sourceKey,
    );
  }

  const selectedDocument = detail?.documents.find((document) => document.id === selectedDocumentId);

  if (loading && !detail) {
    return (
      <output className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Cargando expediente…
      </output>
    );
  }

  if (error || !detail) {
    return (
      <section
        aria-live="assertive"
        className="grid gap-4 rounded-xl border border-destructive/40 bg-card p-6"
      >
        <Link href="/admin/financial-agents" className="text-sm text-primary hover:underline">
          Volver a evaluaciones
        </Link>
        <p className="text-sm text-destructive">{error ?? 'Expediente no encontrado.'}</p>
        <div>
          <Button type="button" variant="outline" onClick={() => void loadDetail()}>
            Reintentar
          </Button>
        </div>
      </section>
    );
  }

  const clientLabel = detail.client.name ?? detail.client.email ?? `Cuenta ${detail.client.id}`;

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <Link href="/admin/financial-agents" className="w-fit text-sm text-primary hover:underline">
          ← Todas las evaluaciones
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Expediente enviado</p>
            <h1 className="break-words text-3xl font-semibold tracking-normal">
              {detail.agent.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {clientLabel} · {detail.workspace.name} · Enviada {formatDate(detail.submittedAt)}
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
            {reviewLabels[detail.review.status]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Estado de publicación del agente: {agentLabels[detail.agent.status]}. La revisión no lo
          modifica.
        </p>
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="grid min-w-0 content-start gap-4" aria-labelledby="answers-heading">
          <div>
            <h2 id="answers-heading" className="text-xl font-semibold">
              Respuestas del cliente
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preguntas conservadas en la instantánea del envío.
            </p>
          </div>
          {detail.answers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              El envío no contiene respuestas.
            </p>
          ) : (
            detail.answers.map((answer, answerIndex) => {
              const sourceKey = `answer:${answerIndex}`;
              const translation = latestTranslation('answer', sourceKey);
              return (
                <article
                  key={`${answer.question}:${answer.answer}`}
                  className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:p-5"
                >
                  <h3 className="text-sm font-semibold">{answer.question}</h3>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {answer.answer}
                  </p>
                  <TranslationReviewPanel
                    translation={translation}
                    loading={translatingSourceKey === sourceKey}
                    approving={approvingTranslationId === translation?.id}
                    error={translationErrors[sourceKey] || undefined}
                    onGenerate={() =>
                      void generateTranslation({ type: 'answer', index: answerIndex })
                    }
                    onApprove={(translationId) => void approveTranslation(translationId)}
                  />
                </article>
              );
            })
          )}

          <section
            className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:p-5"
            aria-labelledby="documents-heading"
          >
            <div>
              <h2 id="documents-heading" className="font-semibold">
                Documentos enviados
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Archivos privados unidos a este expediente.
              </p>
            </div>
            {detail.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No se adjuntaron documentos.</p>
            ) : (
              <ul className="grid gap-3">
                {detail.documents.map((document) => {
                  const translation = latestTranslation('document', document.id);
                  return (
                    <li key={document.id} className="rounded-lg border border-border/70">
                      <button
                        type="button"
                        className="grid w-full gap-2 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                        onClick={() => {
                          setSelectedDocumentId(document.id);
                          setClassificationDraft(document.classification);
                          setDocumentStatusDraft(document.status);
                          setDocumentEditError(null);
                        }}
                        aria-haspopup="dialog"
                      >
                        <span className="break-words text-sm font-medium">
                          {document.documentName}
                        </span>
                        <span className="break-all text-xs text-muted-foreground">
                          {document.fileName} · {formatBytes(document.sizeBytes)}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Clasificación:</span>
                          <span className="break-words font-medium text-foreground">
                            {document.classification}
                          </span>
                          <span className="rounded-full border border-border px-2 py-0.5 font-medium text-foreground">
                            {documentStatusLabels[document.status]}
                          </span>
                        </span>
                      </button>
                      <div className="grid gap-3 border-t border-border/70 p-3 sm:p-4">
                        <TranslationReviewPanel
                          translation={translation}
                          loading={translatingSourceKey === document.id}
                          approving={approvingTranslationId === translation?.id}
                          error={translationErrors[document.id] || undefined}
                          onGenerate={() =>
                            void generateTranslation({ type: 'document', documentId: document.id })
                          }
                          onApprove={(translationId) => void approveTranslation(translationId)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {translationLoadError ? (
            <p role="alert" className="text-sm text-destructive">
              No se pudo cargar el historial de traducciones: {translationLoadError}
            </p>
          ) : null}
        </section>

        <aside className="grid min-w-0 content-start gap-6">
          <section
            className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
            aria-labelledby="result-heading"
          >
            <div>
              <h2 id="result-heading" className="text-xl font-semibold">
                Resultado de revisión
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Redacta la conclusión de la persona revisora.
              </p>
            </div>
            <div className="grid gap-2">
              <label htmlFor="review-result" className="text-sm font-medium">
                Resultado
              </label>
              <Textarea
                id="review-result"
                value={reviewResult}
                onChange={(event) => {
                  setReviewResult(event.target.value);
                  setResultError(null);
                }}
                maxLength={20000}
                rows={10}
                aria-invalid={resultError ? true : undefined}
                aria-describedby={resultError ? 'review-result-error' : 'review-result-count'}
                placeholder="Escribe aquí el resultado de la revisión…"
              />
              {resultError ? (
                <p id="review-result-error" role="alert" className="text-sm text-destructive">
                  {resultError}
                </p>
              ) : (
                <p id="review-result-count" className="text-right text-xs text-muted-foreground">
                  {reviewResult.length.toLocaleString('es-ES')} / 20.000
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveReview('saved')}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar resultado'}
              </Button>
              <Button
                type="button"
                onClick={() => void saveReview('approved')}
                disabled={saving || detail.review.status !== 'in_review'}
              >
                {saving ? 'Guardando…' : 'Aprobar resultado'}
              </Button>
            </div>
            {detail.review.status === 'pending_review' ? (
              <p className="text-xs text-muted-foreground">
                Guarda el resultado para iniciar la revisión antes de aprobar.
              </p>
            ) : null}
            {detail.review.status === 'approved' ? (
              <p className="text-xs text-muted-foreground">
                Guardar una edición volverá a dejar este expediente en revisión.
              </p>
            ) : null}
            {detail.review.updatedAt ? (
              <p className="text-xs text-muted-foreground">
                Última actualización: {formatDate(detail.review.updatedAt)}
              </p>
            ) : null}
          </section>

          <section className="grid gap-4" aria-labelledby="history-heading">
            <div>
              <h2 id="history-heading" className="text-xl font-semibold">
                Historial de revisión
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Eventos guardados con autor, estado y resultado.
              </p>
            </div>
            {detail.events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Todavía no hay eventos de revisión.
              </p>
            ) : (
              <ol className="grid gap-3">
                {detail.events.map((event) => (
                  <li
                    key={event.id}
                    className="grid gap-2 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {event.action === 'approved'
                          ? 'Aprobó el resultado'
                          : 'Guardó el resultado'}
                      </p>
                      <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                        {formatDate(event.occurredAt)}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {event.reviewerName ?? event.reviewerEmail ?? event.reviewerUserId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reviewLabels[event.previousStatus]} → {reviewLabels[event.newStatus]}
                    </p>
                    <p className="whitespace-pre-wrap break-words border-t border-border/70 pt-2 text-sm text-foreground">
                      {event.resultSnapshot || 'Resultado vacío'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
      <Dialog
        open={selectedDocumentId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDocumentId(null);
        }}
      >
        {selectedDocument ? (
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader className="pr-6">
              <DialogTitle className="break-words">{selectedDocument.documentName}</DialogTitle>
              <DialogDescription className="break-all">
                Archivo de este expediente: {selectedDocument.fileName}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-3 rounded-lg border border-border/70 p-3 text-sm sm:grid-cols-2 sm:p-4">
              <div>
                <dt className="text-xs text-muted-foreground">Tamaño</dt>
                <dd className="mt-1">{formatBytes(selectedDocument.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tipo de archivo</dt>
                <dd className="mt-1 break-all">{selectedDocument.mimeType}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Recibido</dt>
                <dd className="mt-1">{formatDate(selectedDocument.createdAt)}</dd>
              </div>
              {selectedDocument.deletedAt ? (
                <div className="sm:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                  <dt className="text-xs font-semibold text-foreground">
                    Archivo eliminado por retención
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    Los bytes se eliminaron el {formatDate(selectedDocument.deletedAt)}. Se
                    conservan los metadatos del documento para el historial.
                  </dd>
                </div>
              ) : null}
            </dl>

            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void saveDocument();
              }}
            >
              <div className="grid gap-2">
                <label htmlFor="document-classification" className="text-sm font-medium">
                  Clasificación
                </label>
                <Input
                  id="document-classification"
                  value={classificationDraft}
                  onChange={(event) => {
                    setClassificationDraft(event.target.value);
                    setDocumentEditError(null);
                  }}
                  disabled={savingDocument}
                  maxLength={120}
                  required
                  aria-invalid={documentEditError ? true : undefined}
                  aria-describedby={
                    documentEditError ? 'document-edit-error' : 'classification-count'
                  }
                />
                {documentEditError ? (
                  <p id="document-edit-error" role="alert" className="text-sm text-destructive">
                    {documentEditError}
                  </p>
                ) : (
                  <p id="classification-count" className="text-right text-xs text-muted-foreground">
                    {classificationDraft.length} / 120
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label htmlFor="document-status" className="text-sm font-medium">
                  Estado del documento
                </label>
                <select
                  id="document-status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={documentStatusDraft}
                  onChange={(event) => {
                    const status = FinancialAgentReviewDocumentStatusSchema.safeParse(
                      event.target.value,
                    );
                    if (status.success) setDocumentStatusDraft(status.data);
                    setDocumentEditError(null);
                  }}
                  disabled={savingDocument}
                >
                  {Object.entries(documentStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.deletedAt ? (
                    <p className="text-sm text-muted-foreground">
                      El archivo ya no está disponible.
                    </p>
                  ) : documentUrls[selectedDocument.id] ? (
                    <>
                      <a
                        href={documentUrls[selectedDocument.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                      >
                        Abrir
                      </a>
                      <a
                        href={documentUrls[selectedDocument.id]}
                        download={selectedDocument.fileName}
                        className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                      >
                        Descargar
                      </a>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadDocument(selectedDocument.id)}
                      disabled={loadingDocument !== null}
                    >
                      {loadingDocument === selectedDocument.id
                        ? 'Cargando archivo…'
                        : 'Cargar archivo'}
                    </Button>
                  )}
                </div>
                <Button type="submit" disabled={savingDocument}>
                  {savingDocument ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
