// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type FinancialAgentReviewQueue as FinancialAgentReviewQueueData,
  FinancialAgentReviewQueue as FinancialAgentReviewQueueSchema,
  type FinancialAgentReviewStatus,
} from '@/lib/contracts/financial-agent-review';

const reviewLabels: Record<FinancialAgentReviewStatus, string> = {
  pending_review: 'Pendiente de revisión',
  in_review: 'En revisión',
  approved: 'Aprobada',
};

const agentLabels = { draft: 'Borrador', published: 'Publicado', retired: 'Retirado' };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.cause && typeof error.cause === 'object') {
    const body = error.cause as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  }
  return error instanceof Error ? error.message : 'No se pudo cargar la cola.';
}

export function FinancialAgentReviewQueue() {
  const [queue, setQueue] = useState<FinancialAgentReviewQueueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/api/admin/financial-agent-submissions', {
        schema: FinancialAgentReviewQueueSchema,
      });
      setQueue(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Administración</p>
          <h1 className="text-3xl font-semibold tracking-normal">Evaluaciones recibidas</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Revisa las respuestas y documentos originales, y registra el resultado humano.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadQueue()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </header>

      {loading && !queue ? (
        <output className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Cargando expedientes…
        </output>
      ) : null}

      {error ? (
        <section
          aria-live="assertive"
          className="grid gap-3 rounded-xl border border-destructive/40 bg-card p-6"
        >
          <p className="text-sm text-destructive">{error}</p>
          <div>
            <Button type="button" variant="outline" onClick={() => void loadQueue()}>
              Reintentar
            </Button>
          </div>
        </section>
      ) : null}

      {queue && queue.items.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-semibold">Aún no hay evaluaciones enviadas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Los expedientes aparecerán aquí cuando un cliente complete una evaluación.
          </p>
        </section>
      ) : null}

      {queue && queue.items.length > 0 ? (
        <section aria-label="Expedientes enviados" className="grid gap-3">
          {queue.items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/financial-agents/${encodeURIComponent(item.id)}`}
              aria-label={`Abrir evaluación de ${item.client.name ?? item.client.email ?? item.client.id}`}
              className="grid gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
            >
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{item.agent.name}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {item.client.name ?? item.client.email ?? `Cuenta ${item.client.id}`}
                  </p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate text-foreground">{item.workspace.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    Agente: {agentLabels[item.agent.status]} · Enviada{' '}
                    {formatDate(item.submittedAt)}
                  </p>
                </div>
              </div>
              <span
                className="w-fit rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground"
                data-status={item.reviewStatus}
              >
                {reviewLabels[item.reviewStatus]}
              </span>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
