// @polsia:user-owned
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { WorkspaceSecurityAccessPanel } from '@/components/custom/workspace-security-access';
import { WorkspaceSecurityEventsPanel } from '@/components/custom/workspace-security-events';
import { WorkspaceSecurityRetentionPanel } from '@/components/custom/workspace-security-retention';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import type { RetentionDays } from '@/lib/business/document-retention';
import {
  type WorkspaceAccessEventList as AccessEventData,
  type WorkspaceSubmissionAccessList as AccessListData,
  type WorkspaceDocumentRetentionState as RetentionData,
  type WorkspaceSubmissionDetail as SubmissionDetailData,
  type WorkspaceSubmissionList as SubmissionListData,
  WorkspaceAccessEventList,
  WorkspaceDocumentRetentionState,
  WorkspaceSubmissionAccessList,
  WorkspaceSubmissionDetail,
  WorkspaceSubmissionDocumentContent,
  WorkspaceSubmissionList,
} from '@/lib/contracts/workspace-security';

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function retentionDaysForSelection(value: string): RetentionDays | undefined {
  if (value === 'manual') return null;
  if (value === '30') return 30;
  if (value === '90') return 90;
  if (value === '180') return 180;
  if (value === '365') return 365;
  return undefined;
}

function formatRole(role: string | null) {
  if (role === 'PROPIETARIO') return 'Propietario/a';
  if (role === 'REMITENTE') return 'Remitente';
  if (role === 'LECTOR') return 'Lector';
  if (role === 'REVISOR') return 'Revisor';
  return 'Sin acceso';
}

function getErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error && typeof cause.cause === 'object' && cause.cause !== null) {
    const body = cause.cause;
    if ('error' in body && typeof body.error === 'string') return body.error;
  }
  return fallback;
}

export function WorkspaceSecurity() {
  const [submissions, setSubmissions] = useState<SubmissionListData | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [events, setEvents] = useState<AccessEventData | null>(null);
  const [detail, setDetail] = useState<SubmissionDetailData | null>(null);
  const [accessList, setAccessList] = useState<AccessListData | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedRetention, setSelectedRetention] = useState('manual');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [loadingDocument, setLoadingDocument] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const documentUrlsRef = useRef<Record<string, string>>({});

  const loadEvents = useCallback(async () => {
    const result = await apiFetch('/api/workspace/access-events', {
      schema: WorkspaceAccessEventList,
    });
    setEvents(result);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch('/api/workspace/submissions', { schema: WorkspaceSubmissionList }),
      apiFetch('/api/workspace/retention', { schema: WorkspaceDocumentRetentionState }),
      apiFetch('/api/workspace/access-events', { schema: WorkspaceAccessEventList }),
    ])
      .then(([submissionData, retentionData, eventData]) => {
        if (!active) return;
        setSubmissions(submissionData);
        setRetention(retentionData);
        setSelectedRetention(
          retentionData.retentionDays === null ? 'manual' : String(retentionData.retentionDays),
        );
        setEvents(eventData);
        setSelectedId((current) => current || submissionData.items[0]?.id || '');
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause, 'No se pudo cargar la seguridad del espacio.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setAccessList(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetail(null);
    setAccessList(null);
    setAccessError(null);
    setDocumentError(null);
    apiFetch(`/api/workspace/submissions/${encodeURIComponent(selectedId)}`, {
      schema: WorkspaceSubmissionDetail,
    })
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setDetail(null);
          setAccessList(null);
          setAccessError(getErrorMessage(cause, 'No se pudo abrir este expediente.'));
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    void loadEvents().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loadEvents, selectedId]);

  useEffect(() => {
    if (!selectedId || !detail?.access.canManage) {
      setAccessList(null);
      setAccessError(null);
      return;
    }
    let active = true;
    setAccessError(null);
    apiFetch(`/api/workspace/submissions/${encodeURIComponent(selectedId)}/access`, {
      schema: WorkspaceSubmissionAccessList,
    })
      .then((result) => {
        if (active) setAccessList(result);
      })
      .catch((cause: unknown) => {
        if (active) setAccessError(getErrorMessage(cause, 'No se pudieron cargar los permisos.'));
      });
    return () => {
      active = false;
    };
  }, [detail?.access.canManage, selectedId]);

  useEffect(
    () => () => {
      for (const url of Object.values(documentUrlsRef.current)) URL.revokeObjectURL(url);
    },
    [],
  );

  async function saveRetention() {
    if (!retention?.canManage) return;
    const retentionDays = retentionDaysForSelection(selectedRetention);
    if (retentionDays === undefined) return;
    setSavingRetention(true);
    try {
      const result = await apiFetch('/api/workspace/retention', {
        method: 'PUT',
        body: JSON.stringify({ retentionDays }),
        schema: WorkspaceDocumentRetentionState,
      });
      setRetention(result);
      setSelectedRetention(result.retentionDays === null ? 'manual' : String(result.retentionDays));
      await loadEvents();
      toast.success('La política de retención se actualizó.');
    } catch (cause) {
      toast.error(getErrorMessage(cause, 'No se pudo guardar la política.'));
    } finally {
      setSavingRetention(false);
    }
  }

  async function changeRole(userId: string, value: string) {
    const role = value === 'LECTOR' || value === 'REVISOR' ? value : null;
    try {
      const result = await apiFetch(
        `/api/workspace/submissions/${encodeURIComponent(selectedId)}/access`,
        {
          method: 'PATCH',
          body: JSON.stringify({ userId, role }),
          schema: WorkspaceSubmissionAccessList,
        },
      );
      setAccessList(result);
      await loadEvents();
      toast.success(
        role ? 'El permiso del expediente se guardó.' : 'El acceso al expediente se revocó.',
      );
    } catch (cause) {
      toast.error(getErrorMessage(cause, 'No se pudo actualizar este permiso.'));
    }
  }

  async function loadDocument(documentId: string) {
    setLoadingDocument(documentId);
    setDocumentError(null);
    try {
      const document = await apiFetch(
        `/api/workspace/submissions/${encodeURIComponent(selectedId)}/documents/${encodeURIComponent(documentId)}`,
        { schema: WorkspaceSubmissionDocumentContent },
      );
      const binary = window.atob(document.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType }));
      const previousUrl = documentUrlsRef.current[documentId];
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      documentUrlsRef.current = { ...documentUrlsRef.current, [documentId]: url };
      setDocumentUrls((current) => {
        return { ...current, [documentId]: url };
      });
      await loadEvents();
    } catch (cause) {
      setDocumentError(getErrorMessage(cause, 'No se pudo abrir este archivo.'));
    } finally {
      setLoadingDocument(null);
    }
  }

  async function downloadDocument(documentId: string) {
    setLoadingDocument(documentId);
    setDocumentError(null);
    try {
      const document = await apiFetch(
        `/api/workspace/submissions/${encodeURIComponent(selectedId)}/documents/${encodeURIComponent(documentId)}`,
        { schema: WorkspaceSubmissionDocumentContent },
      );
      const binary = window.atob(document.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType }));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      await loadEvents();
    } catch (cause) {
      setDocumentError(getErrorMessage(cause, 'No se pudo descargar este archivo.'));
    } finally {
      setLoadingDocument(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          Controles del espacio
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Seguridad y retención
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Revisa quién puede consultar cada expediente, cuándo se abrieron sus archivos y cuánto
          tiempo se conservan los documentos.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Cargando controles…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="font-display text-xl">Acceso a expedientes</CardTitle>
          <CardDescription>
            La persona propietaria y quien envió un expediente conservan acceso. Los demás miembros
            solo ven expedientes con una concesión activa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 border-t border-border/70 pt-5">
          {submissions?.workspaceId === null ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Este perfil todavía no pertenece a un espacio de trabajo.
            </p>
          ) : null}
          {submissions?.workspaceId && submissions.items.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              No hay expedientes disponibles para este perfil. Los expedientes sin concesión no
              aparecen en esta lista.
            </p>
          ) : null}
          {submissions?.items.length ? (
            <div className="grid gap-2">
              <label htmlFor="security-submission" className="text-sm font-medium">
                Expediente
              </label>
              <select
                id="security-submission"
                value={selectedId}
                onChange={(event) => setSelectedId(event.currentTarget.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xl"
              >
                {submissions.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.agentName} · {formatDate(item.submittedAt)} · {formatRole(item.role)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Abriendo expediente…</p>
          ) : null}
          {accessError ? (
            <p className="text-sm text-destructive" role="alert">
              {accessError}
            </p>
          ) : null}
          {detail ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <section className="grid min-w-0 gap-4" aria-labelledby="case-detail-title">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="case-detail-title" className="text-lg font-semibold">
                    {detail.agentName}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {formatRole(detail.access.role)} · enviado {formatDate(detail.submittedAt)}
                  </p>
                </div>
                <div className="grid gap-3">
                  {detail.answers.map((answer) => (
                    <article
                      key={`${answer.question}:${answer.answer}`}
                      className="rounded-md border border-border/70 p-3"
                    >
                      <h3 className="text-sm font-medium">{answer.question}</h3>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {answer.answer}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="grid gap-3">
                  <h3 className="text-sm font-semibold">Documentos del expediente</h3>
                  {detail.documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este expediente no contiene documentos.
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {detail.documents.map((document) => (
                        <li
                          key={document.id}
                          className="grid min-w-0 gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{document.documentName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {document.fileName} · {formatDate(document.createdAt)}
                            </p>
                            {document.deletedAt ? (
                              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                Archivo eliminado el {formatDate(document.deletedAt)}; los metadatos
                                se conservan.
                              </p>
                            ) : null}
                          </div>
                          {document.deletedAt ? (
                            <span className="text-xs text-muted-foreground">Vencido</span>
                          ) : !detail.access.canReadDocuments ? (
                            <span className="text-xs text-muted-foreground">
                              Requiere permiso Revisor
                            </span>
                          ) : documentUrls[document.id] ? (
                            <div className="flex gap-2">
                              <Button asChild type="button" size="sm" variant="outline">
                                <a
                                  href={documentUrls[document.id]}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir
                                </a>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void downloadDocument(document.id)}
                                disabled={loadingDocument !== null}
                              >
                                {loadingDocument === document.id ? 'Preparando…' : 'Descargar'}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void loadDocument(document.id)}
                              disabled={loadingDocument !== null}
                            >
                              {loadingDocument === document.id
                                ? 'Cargando archivo…'
                                : 'Abrir documento'}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {documentError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {documentError}
                    </p>
                  ) : null}
                </div>
              </section>

              <WorkspaceSecurityAccessPanel
                detail={detail}
                accessList={accessList}
                onRoleChange={changeRole}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <WorkspaceSecurityRetentionPanel
        data={retention}
        selectedValue={selectedRetention}
        onSelect={setSelectedRetention}
        onSave={() => void saveRetention()}
        saving={savingRetention}
      />

      <WorkspaceSecurityEventsPanel data={events} />
    </div>
  );
}
