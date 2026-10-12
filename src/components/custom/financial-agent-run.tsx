// @polsia:user-owned
'use client';

import { ArrowLeft, CheckCircle2, FileUp, LockKeyhole, Send } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  FINANCIAL_AGENT_FILE_ACCEPT,
  FinancialAgentFilePolicyError,
  MAX_FINANCIAL_AGENT_FILE_BYTES,
  validateFinancialAgentFileMetadata,
  validateFinancialAgentSubmissionSize,
} from '@/lib/business/financial-agent-file-policy';
import type { FinancialAgentEvaluationConfig as FinancialAgentEvaluationConfigData } from '@/lib/contracts/financial-agent-submissions';
import {
  FinancialAgentEvaluationConfig,
  FinancialAgentEvaluationSubmitResult,
} from '@/lib/contracts/financial-agent-submissions';

function apiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const cause = error.cause;
  if (typeof cause !== 'object' || cause === null) return fallback;
  if ('error' in cause && typeof cause.error === 'string') {
    return cause.error === 'Unauthorized'
      ? 'Tu sesión no está disponible. Inicia sesión para continuar.'
      : cause.error;
  }
  if ('errors' in cause && typeof cause.errors === 'object' && cause.errors !== null) {
    const firstMessage = Object.values(cause.errors).find(
      (message): message is string => typeof message === 'string',
    );
    if (firstMessage) return firstMessage;
  }
  return fallback;
}

function formatFileSize(bytes: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024));
}

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo leer el archivo.'));
        return;
      }
      const comma = reader.result.indexOf(',');
      if (comma < 0) {
        reject(new Error('No se pudo codificar el archivo.'));
        return;
      }
      resolve(reader.result.slice(comma + 1));
    });
    reader.addEventListener('error', () => reject(new Error('No se pudo leer el archivo.')));
    reader.readAsDataURL(file);
  });
}

export function FinancialAgentRun({ agentId }: { agentId: string }) {
  const [data, setData] = useState<FinancialAgentEvaluationConfigData | null>(null);
  const [questionKeys, setQuestionKeys] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerErrors, setAnswerErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<(File | null)[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    apiFetch(`/api/financial-agents/${encodeURIComponent(agentId)}/evaluation`, {
      schema: FinancialAgentEvaluationConfig,
    })
      .then((result) => {
        if (!active) return;
        setData(result);
        setQuestionKeys(result.agent.questions.map(() => crypto.randomUUID()));
        setAnswers(result.agent.questions.map(() => ''));
        setAnswerErrors(result.agent.questions.map(() => ''));
        setFiles(result.agent.requestedDocuments.map(() => null));
        setFileErrors(result.agent.requestedDocuments.map(() => ''));
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            apiErrorMessage(
              error,
              'No pudimos cargar esta evaluación. Vuelve al espacio e inténtalo de nuevo.',
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [agentId]);

  function updateAnswer(index: number, value: string) {
    setAnswers((current) =>
      current.map((answer, currentIndex) => (currentIndex === index ? value : answer)),
    );
    setAnswerErrors((current) =>
      current.map((message, currentIndex) => (currentIndex === index ? '' : message)),
    );
  }

  function selectFile(index: number, file: File | null) {
    if (!data) return;
    if (!file) {
      setFiles((current) =>
        current.map((value, currentIndex) => (currentIndex === index ? null : value)),
      );
      setFileErrors((current) =>
        current.map((message, currentIndex) => (currentIndex === index ? '' : message)),
      );
      return;
    }

    try {
      validateFinancialAgentFileMetadata({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      validateFinancialAgentSubmissionSize([
        ...files
          .filter((_value, currentIndex) => currentIndex !== index)
          .flatMap((value) => (value ? [value.size] : [])),
        file.size,
      ]);
      setFiles((current) =>
        current.map((value, currentIndex) => (currentIndex === index ? file : value)),
      );
      setFileErrors((current) =>
        current.map((message, currentIndex) => (currentIndex === index ? '' : message)),
      );
      setSubmitError(null);
    } catch (error) {
      const message =
        error instanceof FinancialAgentFilePolicyError
          ? error.message
          : 'No se pudo seleccionar el archivo.';
      setFiles((current) =>
        current.map((value, currentIndex) => (currentIndex === index ? null : value)),
      );
      setFileErrors((current) =>
        current.map((value, currentIndex) => (currentIndex === index ? message : value)),
      );
    }
  }

  async function submitEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || data.submission || submitting) return;

    const nextAnswerErrors = answers.map((answer) =>
      answer.trim() ? '' : 'Completa esta respuesta.',
    );
    const nextFileErrors = files.map((file, index) =>
      data.agent.requestedDocuments[index] && !file ? 'Adjunta este documento para continuar.' : '',
    );
    setAnswerErrors(nextAnswerErrors);
    setFileErrors(nextFileErrors.map((message, index) => message || fileErrors[index] || ''));
    if (
      nextAnswerErrors.some(Boolean) ||
      nextFileErrors.some(Boolean) ||
      fileErrors.some(Boolean)
    ) {
      setSubmitError('Revisa las respuestas y los documentos marcados antes de enviar.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const uploadedFiles = await Promise.all(
        data.agent.requestedDocuments.map(async (documentName, index) => {
          const file = files[index];
          if (!file) return null;
          return {
            documentName,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            base64: await readFileAsBase64(file),
          };
        }),
      );
      const result = await apiFetch(
        `/api/financial-agents/${encodeURIComponent(agentId)}/evaluation`,
        {
          method: 'POST',
          body: JSON.stringify({ answers, files: uploadedFiles.filter((file) => file !== null) }),
          schema: FinancialAgentEvaluationSubmitResult,
        },
      );
      setData((current) =>
        current ? { ...current, submission: { submittedAt: result.submittedAt } } : current,
      );
    } catch (error) {
      setSubmitError(
        apiErrorMessage(error, 'No se pudo enviar la evaluación. Inténtalo de nuevo.'),
      );
      try {
        const refreshed = await apiFetch(
          `/api/financial-agents/${encodeURIComponent(agentId)}/evaluation`,
          { schema: FinancialAgentEvaluationConfig },
        );
        if (refreshed.submission) {
          setData(refreshed);
          setSubmitError(null);
        }
      } catch {
        // Se conserva el error original si no se puede confirmar el estado del servidor.
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground" aria-live="polite">
          Cargando evaluación…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-5">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/dashboard">
            <ArrowLeft aria-hidden="true" />
            Volver al espacio
          </Link>
        </Button>
        <Alert variant="destructive" role="alert">
          <AlertTitle>No se puede abrir esta evaluación</AlertTitle>
          <AlertDescription>{loadError ?? 'La evaluación no está disponible.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const answeredCount = answers.filter((answer) => answer.trim().length > 0).length;
  const attachedCount = files.filter((file) => file !== null).length;
  const completionCount = answeredCount + attachedCount;
  const totalFields = data.agent.questions.length + data.agent.requestedDocuments.length;

  return (
    <div className="mx-auto grid w-full max-w-3xl min-w-0 gap-5 sm:gap-7">
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/dashboard">
          <ArrowLeft aria-hidden="true" />
          Volver a agentes
        </Link>
      </Button>

      {data.submission ? (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="grid gap-2">
                <h1 className="font-display text-2xl tracking-[-0.02em] sm:text-3xl">
                  Evaluación enviada
                </h1>
                <CardDescription>
                  {data.agent.name} · {formatSubmittedAt(data.submission.submittedAt)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Tus respuestas y documentos quedaron vinculados a esta evaluación para su revisión. El
              envío no se puede editar desde este flujo.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-4" aria-hidden="true" />
              Los archivos se guardan de forma privada y no tienen enlaces públicos.
            </div>
            <Button asChild variant="outline" className="w-fit">
              <Link href="/dashboard">Volver al espacio</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <header className="grid gap-3 border-b border-border/70 pb-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Evaluación financiera
            </p>
            <h1 className="font-display text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
              {data.agent.name}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.agent.objective}
            </p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {completionCount} de {totalFields} campos completados
            </p>
          </header>

          {submitError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>No se pudo enviar</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={submitEvaluation} className="grid min-w-0 gap-5" noValidate>
            <Card>
              <CardHeader>
                <h2 className="font-display text-xl">Preguntas</h2>
                <CardDescription>Completa todas las respuestas para continuar.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                {data.agent.questions.map((question, index) => {
                  const questionKey =
                    questionKeys[index] ?? `${data.agent.id}-question-${index + 1}`;
                  const inputId = `evaluation-question-${questionKey}`;
                  const errorId = `${inputId}-error`;
                  return (
                    <div key={questionKey} className="grid min-w-0 gap-2">
                      <Label htmlFor={inputId}>{question}</Label>
                      <Textarea
                        id={inputId}
                        value={answers[index] ?? ''}
                        rows={4}
                        maxLength={10000}
                        required
                        aria-invalid={Boolean(answerErrors[index])}
                        aria-describedby={answerErrors[index] ? errorId : undefined}
                        onChange={(event) => updateAnswer(index, event.currentTarget.value)}
                      />
                      {answerErrors[index] ? (
                        <p id={errorId} className="text-sm text-destructive">
                          {answerErrors[index]}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">Hasta 10.000 caracteres.</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-display text-xl">Documentación</h2>
                <CardDescription>
                  {data.agent.requestedDocuments.length > 0
                    ? 'Adjunta un archivo por documento. Los formatos admitidos son PDF, JPG, PNG, CSV y XLSX; hasta 5 MiB por archivo y 10 MiB en total.'
                    : 'No se solicitan documentos para esta evaluación.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                {data.agent.requestedDocuments.length === 0 ? (
                  <p className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
                    Puedes enviar tus respuestas sin adjuntar documentos.
                  </p>
                ) : (
                  data.agent.requestedDocuments.map((documentName, index) => {
                    const inputId = `evaluation-file-${index + 1}`;
                    const errorId = `${inputId}-error`;
                    const file = files[index];
                    return (
                      <div key={documentName} className="grid min-w-0 gap-2">
                        <Label htmlFor={inputId}>{documentName}</Label>
                        <input
                          id={inputId}
                          type="file"
                          required
                          accept={FINANCIAL_AGENT_FILE_ACCEPT}
                          aria-invalid={Boolean(fileErrors[index])}
                          aria-describedby={fileErrors[index] ? errorId : `${inputId}-help`}
                          onChange={(event) =>
                            selectFile(index, event.currentTarget.files?.item(0) ?? null)
                          }
                          className="block w-full min-w-0 cursor-pointer rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {file ? (
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <FileUp className="size-4 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-all">{file.name}</span>
                            <span className="shrink-0">{formatFileSize(file.size)} MiB</span>
                          </p>
                        ) : null}
                        {fileErrors[index] ? (
                          <p id={errorId} className="text-sm text-destructive">
                            {fileErrors[index]}
                          </p>
                        ) : (
                          <p id={`${inputId}-help`} className="text-xs text-muted-foreground">
                            PDF, JPG, PNG, CSV o XLSX · máximo{' '}
                            {formatFileSize(MAX_FINANCIAL_AGENT_FILE_BYTES)} MiB
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 border-t border-border/70 pt-5 sm:flex sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Tus respuestas y documentos solo se vinculan a esta evaluación y no se publican.
              </p>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto sm:min-w-48">
                <Send aria-hidden="true" />
                {submitting ? 'Enviando…' : 'Enviar evaluación'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
