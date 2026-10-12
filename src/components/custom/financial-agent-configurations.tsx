// @polsia:user-owned
'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type FinancialAgentConfigurationItem as Configuration,
  FinancialAgentConfigurationInput,
  FinancialAgentConfigurationItem,
  FinancialAgentConfigurationList,
} from '@/lib/contracts/financial-agent-configurations';

type Props = { agentId: string; isOwner: boolean };

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: Configuration['status']) {
  if (status === 'active') return 'Activa';
  if (status === 'archived') return 'Archivada';
  if (status === 'inactive') return 'Inactiva';
  return 'Borrador';
}

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof Error && typeof error.cause === 'object' && error.cause !== null) {
    if ('error' in error.cause && typeof error.cause.error === 'string') {
      return error.cause.error;
    }
  }
  return fallback;
}

export function FinancialAgentConfigurations({ agentId, isOwner }: Props) {
  const [items, setItems] = useState<Configuration[]>([]);
  const [activeConfigurationId, setActiveConfigurationId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFromVersion, setEditingFromVersion] = useState<number | null>(null);
  const [rules, setRules] = useState('');
  const [instructions, setInstructions] = useState('');
  const [supervisionLevel, setSupervisionLevel] = useState<'Alta' | 'Media' | 'Baja'>('Alta');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch(
        `/api/financial-agents/${encodeURIComponent(agentId)}/configurations`,
        {
          schema: FinancialAgentConfigurationList,
        },
      );
      setItems(payload.items);
      setActiveConfigurationId(payload.activeConfigurationId);
      setSelectedId((current) => {
        if (current && payload.items.some((item) => item.id === current)) return current;
        return payload.activeConfigurationId ?? payload.items[0]?.id ?? null;
      });
      setLoadError(null);
    } catch {
      setLoadError('No se pudo cargar el historial de versiones.');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  function startEditing(configuration: Configuration) {
    setSelectedId(configuration.id);
    setRules(configuration.rules);
    setInstructions(configuration.instructions);
    setSupervisionLevel(configuration.supervisionLevel);
    setEditingFromVersion(configuration.version);
    setFieldErrors({});
    setEditorOpen(true);
  }

  async function saveVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = FinancialAgentConfigurationInput.safeParse({
      rules,
      instructions,
      supervisionLevel,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.map(String).join('.') || 'form';
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setPendingId('create');
    try {
      const created = await apiFetch(
        `/api/financial-agents/${encodeURIComponent(agentId)}/configurations`,
        {
          method: 'POST',
          body: JSON.stringify(parsed.data),
          schema: FinancialAgentConfigurationItem,
        },
      );
      setItems((current) => [created, ...current]);
      setSelectedId(created.id);
      setEditorOpen(false);
      setEditingFromVersion(null);
      toast.success(`Versión ${created.version} guardada como borrador`);
    } catch (error) {
      toast.error(messageFromError(error, 'No se pudo guardar la nueva versión.'));
    } finally {
      setPendingId(null);
    }
  }

  async function changeVersion(configuration: Configuration, action: 'activate' | 'archive') {
    if (pendingId) return;
    setPendingId(configuration.id);
    try {
      await apiFetch(
        `/api/financial-agents/${encodeURIComponent(agentId)}/configurations/${encodeURIComponent(configuration.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action }),
          schema: FinancialAgentConfigurationItem,
        },
      );
      await refresh();
      toast.success(
        action === 'activate' ? `Versión ${configuration.version} activada` : 'Versión archivada',
      );
    } catch (error) {
      toast.error(messageFromError(error, 'No se pudo actualizar la versión.'));
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <Card aria-live="polite">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Cargando reglas e historial…
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 border-border/80">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1.5">
            <CardTitle className="font-display text-2xl tracking-[-0.02em]">
              Reglas e instrucciones
            </CardTitle>
            <CardDescription>
              Historial independiente del estado de publicación del agente.
            </CardDescription>
          </div>
          <Badge variant="default">
            {items.find((item) => item.id === activeConfigurationId)
              ? `Activa · versión ${items.find((item) => item.id === activeConfigurationId)?.version}`
              : 'Sin versión activa'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Aún no hay versiones de configuración.
          </div>
        ) : (
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
            <section
              aria-labelledby="configuration-history-heading"
              className="grid min-w-0 content-start gap-3"
            >
              <h3 id="configuration-history-heading" className="font-medium">
                Historial de versiones
              </h3>
              <ul className="grid gap-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-pressed={selectedId === item.id}
                      className={`grid w-full gap-1 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedId === item.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card'
                      }`}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Versión {item.version}</span>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                          {statusLabel(item.status)}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Creada {formatCreatedAt(item.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {selected ? (
              <section
                aria-labelledby="configuration-detail-heading"
                className="grid min-w-0 content-start gap-4"
              >
                <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 id="configuration-detail-heading" className="font-medium">
                      Versión {selected.version} · {statusLabel(selected.status)}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Creada {formatCreatedAt(selected.createdAt)}
                      {selected.archivedAt
                        ? ` · Archivada ${formatCreatedAt(selected.archivedAt)}`
                        : ''}
                    </p>
                  </div>
                  {isOwner ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(selected)}
                      >
                        Cargar para editar
                      </Button>
                      {selected.id !== activeConfigurationId && selected.status !== 'archived' ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={pendingId !== null}
                          onClick={() => void changeVersion(selected, 'activate')}
                        >
                          Activar
                        </Button>
                      ) : null}
                      {selected.id !== activeConfigurationId &&
                      selected.status !== 'active' &&
                      selected.status !== 'archived' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pendingId !== null}
                          onClick={() => void changeVersion(selected, 'archive')}
                        >
                          Archivar
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid content-start gap-2">
                    <h4 className="text-sm font-medium">Reglas</h4>
                    <p className="min-h-16 rounded-md bg-muted/40 p-3 text-sm leading-6 whitespace-pre-wrap">
                      {selected.rules || 'Sin reglas definidas.'}
                    </p>
                  </div>
                  <div className="grid content-start gap-2">
                    <h4 className="text-sm font-medium">Instrucciones</h4>
                    <p className="min-h-16 rounded-md bg-muted/40 p-3 text-sm leading-6 whitespace-pre-wrap">
                      {selected.instructions || 'Sin instrucciones definidas.'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Nivel de supervisión:{' '}
                  <span className="font-medium text-foreground">{selected.supervisionLevel}</span>
                </p>
              </section>
            ) : null}
          </div>
        )}

        {isOwner && editorOpen ? (
          <form className="grid gap-4 border-t border-border/70 pt-5" onSubmit={saveVersion}>
            <div>
              <h3 className="font-medium">
                Nueva versión
                {editingFromVersion ? ` basada en la versión ${editingFromVersion}` : ''}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Guardar añade un borrador al historial; no modifica la versión seleccionada.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`agent-${agentId}-rules`}>Reglas</Label>
              <Textarea
                id={`agent-${agentId}-rules`}
                rows={4}
                maxLength={10_000}
                value={rules}
                onChange={(event) => setRules(event.currentTarget.value)}
                aria-invalid={Boolean(fieldErrors.rules)}
                aria-describedby={fieldErrors.rules ? `agent-${agentId}-rules-error` : undefined}
              />
              <p className="text-xs text-muted-foreground">{rules.length}/10.000 caracteres</p>
              {fieldErrors.rules ? (
                <p id={`agent-${agentId}-rules-error`} className="text-sm text-destructive">
                  {fieldErrors.rules}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`agent-${agentId}-instructions`}>Instrucciones</Label>
              <Textarea
                id={`agent-${agentId}-instructions`}
                rows={4}
                maxLength={10_000}
                value={instructions}
                onChange={(event) => setInstructions(event.currentTarget.value)}
                aria-invalid={Boolean(fieldErrors.instructions)}
                aria-describedby={
                  fieldErrors.instructions ? `agent-${agentId}-instructions-error` : undefined
                }
              />
              <p className="text-xs text-muted-foreground">
                {instructions.length}/10.000 caracteres
              </p>
              {fieldErrors.instructions ? (
                <p id={`agent-${agentId}-instructions-error`} className="text-sm text-destructive">
                  {fieldErrors.instructions}
                </p>
              ) : null}
            </div>
            <div className="grid max-w-sm gap-2">
              <Label htmlFor={`agent-${agentId}-supervision`}>Nivel de supervisión</Label>
              <select
                id={`agent-${agentId}-supervision`}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={supervisionLevel}
                onChange={(event) =>
                  setSupervisionLevel(event.currentTarget.value as 'Alta' | 'Media' | 'Baja')
                }
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pendingId !== null}>
                {pendingId === 'create' ? 'Guardando…' : 'Guardar como nueva versión'}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
