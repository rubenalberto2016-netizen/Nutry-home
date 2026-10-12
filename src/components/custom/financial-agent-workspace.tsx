// @polsia:user-owned
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronRight,
  CirclePlus,
  ClipboardList,
  FileCheck2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FinancialAgentConfigurations } from '@/components/custom/financial-agent-configurations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  FinancialAgentCreate,
  type FinancialAgentCreateData,
  type FinancialAgentInput,
  type FinancialAgentItem,
  FinancialAgentItem as FinancialAgentItemSchema,
  FinancialAgentList,
  FinancialAgentRequestedDocumentsPatch,
  type FinancialAgentStatus,
} from '@/lib/contracts/financial-agents';
import {
  SubscriptionOverview,
  type SubscriptionOverview as SubscriptionOverviewData,
} from '@/lib/contracts/subscriptions';
import { applyServerErrors } from '@/lib/forms';

const suggestedQuestions = [
  '¿Cuál es el objetivo de la solicitud?',
  '¿Qué monto aproximado se evalúa?',
  '¿En qué plazo se requiere?',
];

const financialEvaluationTemplate: FinancialAgentInput = {
  name: 'Evaluación financiera inicial',
  objective: 'Recopilar la información necesaria para una evaluación financiera inicial',
  questions: suggestedQuestions,
  requestedDocuments: [],
};

const newDraft: FinancialAgentInput = {
  name: '',
  objective: '',
  questions: [''],
  requestedDocuments: [],
};

function newQuestionKeys(count = suggestedQuestions.length) {
  return Array.from({ length: count }, (_, index) => `question-${index + 1}`);
}

function newDocumentKeys(count: number) {
  return Array.from({ length: count }, (_, index) => `document-${index + 1}`);
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
}

function statusLabel(status: FinancialAgentStatus) {
  if (status === 'published') return 'Publicado';
  if (status === 'retired') return 'Retirado';
  return 'Borrador';
}

export function FinancialAgentWorkspace() {
  const [items, setItems] = useState<FinancialAgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [access, setAccess] = useState<SubscriptionOverviewData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const [documentsPending, setDocumentsPending] = useState(false);
  const [questionKeys, setQuestionKeys] = useState(() =>
    newQuestionKeys(newDraft.questions.length),
  );
  const [documentKeys, setDocumentKeys] = useState(() => newDocumentKeys(0));
  const form = useForm<FinancialAgentInput, unknown, FinancialAgentCreateData>({
    resolver: zodResolver(FinancialAgentCreate),
    defaultValues: newDraft,
    mode: 'onBlur',
  });
  const questions = form.watch('questions') ?? [];
  const requestedDocuments = form.watch('requestedDocuments') ?? [];

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      const overview = await apiFetch('/api/subscriptions', { schema: SubscriptionOverview });
      if (!active) return;
      setAccess(overview);
      if (!overview.hasAccess) return;
      const { items: records } = await apiFetch('/api/financial-agents', {
        schema: FinancialAgentList,
      });
      if (active) {
        setItems(records);
        setLoadError(null);
      }
    }
    loadWorkspace()
      .catch(() => {
        if (active) {
          setLoadError('No pudimos cargar el estado del espacio. Inténtalo de nuevo.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function beginNewDraft() {
    setEditingId(null);
    setQuestionKeys(newQuestionKeys(newDraft.questions.length));
    setDocumentKeys(newDocumentKeys(0));
    form.reset(newDraft);
  }

  function applyFinancialEvaluationTemplate() {
    setQuestionKeys(newQuestionKeys(financialEvaluationTemplate.questions.length));
    setDocumentKeys(newDocumentKeys(financialEvaluationTemplate.requestedDocuments?.length ?? 0));
    form.reset({
      ...financialEvaluationTemplate,
      questions: [...financialEvaluationTemplate.questions],
    });
  }

  function selectAgent(item: FinancialAgentItem) {
    setEditingId(item.id);
    setQuestionKeys(item.questions.map((_, index) => `${item.id}-question-${index + 1}`));
    setDocumentKeys(item.requestedDocuments.map((_, index) => `${item.id}-document-${index + 1}`));
    form.reset({
      name: item.name,
      objective: item.objective,
      questions: item.questions,
      requestedDocuments: item.requestedDocuments,
    });
  }

  function updateQuestion(index: number, value: string) {
    const next = [...form.getValues('questions')];
    next[index] = value;
    form.setValue('questions', next, { shouldDirty: true, shouldValidate: true });
  }

  function addQuestion() {
    if (questions.length >= 10) return;
    form.setValue('questions', [...questions, ''], { shouldDirty: true, shouldValidate: true });
    setQuestionKeys((current) => [...current, `question-${crypto.randomUUID()}`]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    form.setValue(
      'questions',
      questions.filter((_, currentIndex) => currentIndex !== index),
      { shouldDirty: true, shouldValidate: true },
    );
    setQuestionKeys((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateRequestedDocument(index: number, value: string) {
    const next = [...(form.getValues('requestedDocuments') ?? [])];
    next[index] = value;
    form.setValue('requestedDocuments', next, { shouldDirty: true, shouldValidate: true });
  }

  function addRequestedDocument() {
    if (requestedDocuments.length >= 10) return;
    form.setValue('requestedDocuments', [...(form.getValues('requestedDocuments') ?? []), ''], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setDocumentKeys((current) => [...current, `document-${crypto.randomUUID()}`]);
  }

  function removeRequestedDocument(index: number) {
    form.setValue(
      'requestedDocuments',
      requestedDocuments.filter((_, currentIndex) => currentIndex !== index),
      { shouldDirty: true, shouldValidate: true },
    );
    setDocumentKeys((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function saveDraft(values: FinancialAgentCreateData) {
    try {
      const saved = editingId
        ? await apiFetch(`/api/financial-agents/${encodeURIComponent(editingId)}`, {
            method: 'PATCH',
            body: JSON.stringify(values),
            schema: FinancialAgentItemSchema,
          })
        : await apiFetch('/api/financial-agents', {
            method: 'POST',
            body: JSON.stringify(values),
            schema: FinancialAgentItemSchema,
          });

      setItems((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      toast.success('Borrador guardado');
      if (!editingId) beginNewDraft();
    } catch (error) {
      const applied = error instanceof Error && applyServerErrors(error.cause, form.setError);
      if (!applied) toast.error('No se pudo guardar. Inténtalo de nuevo.');
    }
  }

  async function changeStatus(item: FinancialAgentItem, status: FinancialAgentStatus) {
    if (statusPendingId) return;
    setStatusPendingId(item.id);
    try {
      const updated = await apiFetch(`/api/financial-agents/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        schema: FinancialAgentItemSchema,
      });
      setItems((current) => current.map((agent) => (agent.id === updated.id ? updated : agent)));
      toast.success(status === 'published' ? 'Agente publicado' : 'Agente retirado');
    } catch {
      toast.error('No se pudo cambiar el estado. Actualiza la lista e inténtalo de nuevo.');
    } finally {
      setStatusPendingId(null);
    }
  }

  async function savePublishedDocuments() {
    if (!selectedAgent || documentsPending) return;
    const parsed = FinancialAgentRequestedDocumentsPatch.safeParse({
      requestedDocuments: form.getValues('requestedDocuments'),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Revisa los documentos solicitados.');
      return;
    }

    setDocumentsPending(true);
    try {
      const updated = await apiFetch(
        `/api/financial-agents/${encodeURIComponent(selectedAgent.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(parsed.data),
          schema: FinancialAgentItemSchema,
        },
      );
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDocumentKeys(
        updated.requestedDocuments.map((_, index) => `${updated.id}-document-${index + 1}`),
      );
      form.reset({
        name: updated.name,
        objective: updated.objective,
        questions: updated.questions,
        requestedDocuments: updated.requestedDocuments,
      });
      toast.success('Documentos solicitados actualizados');
    } catch {
      toast.error('No se pudieron actualizar los documentos solicitados.');
    } finally {
      setDocumentsPending(false);
    }
  }

  const submitting = form.formState.isSubmitting;
  const nameError = form.formState.errors.name?.message;
  const objectiveError = form.formState.errors.objective?.message;
  const canEdit = access?.isOwner === true;
  const selectedAgent = items.find((item) => item.id === editingId);
  const canEditDraft = canEdit && (editingId === null || selectedAgent?.status === 'draft');
  const canEditPublishedDocuments = canEdit && selectedAgent?.status === 'published';

  if (!loading && access && !access.hasAccess) {
    return (
      <Card className="border-dashed border-primary/30 bg-muted/20">
        <CardContent className="grid gap-4 py-8 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Acceso al espacio cerrado
            </p>
            <h2 className="mt-2 font-display text-2xl">
              Los borradores esperan la confirmación del pago
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {access.role === 'MEMBER'
                ? 'Pide a la persona propietaria acceso al espacio de agentes financieros; la inscripción a la cohorte no desbloquea esta herramienta.'
                : 'El espacio de agentes financieros requiere acceso propio. La inscripción a la cohorte habilita el programa educativo.'}
            </p>
          </div>
          {access.isOwner ? (
            <Button asChild>
              <Link href="/pricing">Ver plan de equipo</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            Espacio de trabajo
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
            Agentes financieros
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Consulta los agentes del espacio, publica borradores para futuras evaluaciones o retira
            agentes publicados.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" variant="outline" onClick={beginNewDraft} className="shrink-0">
            <CirclePlus aria-hidden="true" />
            Nuevo agente
          </Button>
        ) : null}
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.35fr)]">
        <section aria-labelledby="drafts-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="drafts-heading" className="font-display text-xl tracking-[-0.02em]">
                Agentes del espacio
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canEdit
                  ? 'El equipo puede publicar o retirar agentes; solo la persona propietaria edita borradores.'
                  : 'Puedes consultar, publicar y retirar los agentes del espacio.'}
              </p>
            </div>
            {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground" aria-live="polite">
                Cargando agentes…
              </CardContent>
            </Card>
          ) : loadError ? (
            <Card>
              <CardContent className="py-8 text-sm text-destructive" role="alert">
                {loadError}
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="py-8">
                <p className="font-medium">Aún no hay agentes</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cuando la persona propietaria guarde un agente, aparecerá aquí para el equipo.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <div
                    className={`flex min-w-0 flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 ${
                      editingId === item.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => selectAgent(item)}
                        aria-pressed={editingId === item.id}
                        className="min-w-0 rounded-sm p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex min-w-0 items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.name}</span>
                            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">
                              {item.objective}
                            </span>
                          </span>
                          <ChevronRight
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                        <Badge
                          variant={
                            item.status === 'published'
                              ? 'default'
                              : item.status === 'retired'
                                ? 'outline'
                                : 'secondary'
                          }
                        >
                          {statusLabel(item.status)}
                        </Badge>
                        <span>{item.questions.length} preguntas</span>
                        <span>{item.requestedDocuments.length} documentos solicitados</span>
                        <span>Actualizado {formatUpdatedAt(item.updatedAt)}</span>
                      </div>
                    </div>
                    {item.status === 'draft' ? (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full shrink-0 sm:w-auto"
                        disabled={statusPendingId !== null}
                        onClick={() => void changeStatus(item, 'published')}
                      >
                        {statusPendingId === item.id ? 'Publicando…' : 'Publicar'}
                      </Button>
                    ) : item.status === 'published' ? (
                      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button asChild size="sm" className="w-full sm:w-auto">
                          <Link href={`/dashboard/financial-agents/${encodeURIComponent(item.id)}`}>
                            Completar evaluación
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={statusPendingId !== null}
                          onClick={() => void changeStatus(item, 'retired')}
                        >
                          {statusPendingId === item.id ? 'Retirando…' : 'Retirar'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Card className="min-w-0 border-border/80">
          <CardHeader>
            <h2 className="font-display text-2xl tracking-[-0.02em]">
              {canEditPublishedDocuments
                ? 'Documentos solicitados'
                : canEditDraft
                  ? editingId
                    ? 'Editar borrador'
                    : 'Nuevo agente'
                  : editingId
                    ? 'Consulta del agente'
                    : 'Lectura del espacio'}
            </h2>
            <CardDescription>
              {canEditPublishedDocuments
                ? 'En un agente publicado puedes cambiar solo los documentos solicitados. Las preguntas y el objetivo permanecen bloqueados.'
                : canEditDraft
                  ? 'Empieza con campos vacíos o aplica una plantilla. Nada se guarda hasta que confirmes el borrador.'
                  : editingId
                    ? selectedAgent?.status === 'draft'
                      ? 'Este borrador es de solo lectura. La edición corresponde a la persona propietaria del espacio.'
                      : 'Los agentes publicados y retirados son de solo lectura; las preguntas y el objetivo no se pueden cambiar.'
                    : 'Selecciona un agente para consultar sus preguntas.'}
            </CardDescription>
            {!editingId && canEditDraft ? (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={applyFinancialEvaluationTemplate}
              >
                <ClipboardList aria-hidden="true" />
                Usar plantilla de evaluación financiera
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <form className="grid min-w-0 gap-6" noValidate onSubmit={form.handleSubmit(saveDraft)}>
              <div className="grid gap-2">
                <Label htmlFor="financial-agent-name">Nombre</Label>
                <Input
                  id="financial-agent-name"
                  disabled={!canEditDraft}
                  placeholder="Ej. Evaluación financiera inicial"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? 'financial-agent-name-error' : undefined}
                  {...form.register('name')}
                />
                {nameError && (
                  <p id="financial-agent-name-error" className="text-sm text-destructive">
                    {nameError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Hasta 120 caracteres.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="financial-agent-objective">Objetivo</Label>
                <Textarea
                  id="financial-agent-objective"
                  rows={4}
                  disabled={!canEditDraft}
                  aria-invalid={Boolean(objectiveError)}
                  aria-describedby={objectiveError ? 'financial-agent-objective-error' : undefined}
                  {...form.register('objective')}
                />
                {objectiveError && (
                  <p id="financial-agent-objective-error" className="text-sm text-destructive">
                    {objectiveError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Hasta 1.000 caracteres.</p>
              </div>

              <fieldset disabled={!canEditDraft} className="grid min-w-0 gap-3">
                <legend className="text-sm font-medium">Preguntas abiertas</legend>
                <p className="text-xs leading-5 text-muted-foreground">
                  Añade de 1 a 10 preguntas. Cada una puede tener hasta 300 caracteres.
                </p>
                <div className="grid gap-3">
                  {questions.map((question, index) => {
                    const rowKey = questionKeys[index] ?? `question-${index + 1}`;
                    const fieldName = `questions.${index}` as const;
                    const questionError = form.formState.errors.questions?.[index]?.message;
                    const questionId = `financial-agent-${rowKey}`;
                    const errorId = `${questionId}-error`;
                    return (
                      <div key={rowKey} className="flex min-w-0 items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-2">
                          <Label htmlFor={questionId} className="text-xs text-muted-foreground">
                            Pregunta {index + 1}
                          </Label>
                          <Textarea
                            id={questionId}
                            rows={2}
                            disabled={!canEditDraft}
                            value={question}
                            onChange={(event) => updateQuestion(index, event.currentTarget.value)}
                            onBlur={() => void form.trigger(fieldName)}
                            aria-invalid={Boolean(questionError)}
                            aria-describedby={questionError ? errorId : undefined}
                          />
                          {questionError && (
                            <p id={errorId} className="text-sm text-destructive">
                              {questionError}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="mt-6 shrink-0"
                          aria-label={`Eliminar pregunta ${index + 1}`}
                          disabled={questions.length <= 1}
                          onClick={() => removeQuestion(index)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  disabled={questions.length >= 10}
                  onClick={addQuestion}
                >
                  <Plus aria-hidden="true" />
                  Añadir pregunta
                </Button>
              </fieldset>

              <fieldset
                disabled={!canEditDraft && !canEditPublishedDocuments}
                className="grid min-w-0 gap-3 border-t border-border/70 pt-5"
              >
                <legend className="text-sm font-medium">Documentos requeridos</legend>
                <p className="text-xs leading-5 text-muted-foreground">
                  Añade hasta 10 documentos con nombres claros. Cada persona adjuntará un archivo
                  por requisito.
                </p>
                {requestedDocuments.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    No se solicitan documentos.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {requestedDocuments.map((document, index) => {
                      const rowKey = documentKeys[index] ?? `document-${index + 1}`;
                      const documentId = `financial-agent-${rowKey}`;
                      return (
                        <div key={rowKey} className="flex min-w-0 items-end gap-2">
                          <div className="grid min-w-0 flex-1 gap-2">
                            <Label htmlFor={documentId} className="text-xs text-muted-foreground">
                              Documento {index + 1}
                            </Label>
                            <Input
                              id={documentId}
                              value={document}
                              maxLength={120}
                              placeholder="Ej. Estados financieros del último ejercicio"
                              disabled={!canEditDraft && !canEditPublishedDocuments}
                              onChange={(event) =>
                                updateRequestedDocument(index, event.currentTarget.value)
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="shrink-0"
                            aria-label={`Eliminar documento ${index + 1}`}
                            disabled={!canEditDraft && !canEditPublishedDocuments}
                            onClick={() => removeRequestedDocument(index)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(canEditDraft || canEditPublishedDocuments) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={requestedDocuments.length >= 10}
                    onClick={addRequestedDocument}
                  >
                    <Plus aria-hidden="true" />
                    Añadir documento
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Los nombres admiten hasta 120 caracteres. No incluyas datos confidenciales en el
                  nombre del requisito.
                </p>
              </fieldset>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={beginNewDraft}>
                    Cancelar edición
                  </Button>
                ) : (
                  <span className="text-xs leading-5 text-muted-foreground">
                    Nada se guarda hasta que pulses el botón.
                  </span>
                )}
                {canEditDraft ? (
                  <Button type="submit" disabled={submitting} className="sm:min-w-48">
                    <Save aria-hidden="true" />
                    {submitting ? 'Guardando…' : 'Guardar borrador'}
                  </Button>
                ) : canEditPublishedDocuments ? (
                  <Button
                    type="button"
                    disabled={documentsPending}
                    className="sm:min-w-48"
                    onClick={() => void savePublishedDocuments()}
                  >
                    <FileCheck2 aria-hidden="true" />
                    {documentsPending ? 'Guardando…' : 'Guardar documentos'}
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      {selectedAgent ? (
        <FinancialAgentConfigurations
          key={selectedAgent.id}
          agentId={selectedAgent.id}
          isOwner={canEdit}
        />
      ) : null}
    </div>
  );
}
