// @polsia:user-owned
'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import type { EditorialDraft, EditorialReviewer } from '@/lib/contracts/editorial-content';
import {
  EditorialReviewerCreateResult,
  EditorialReviewerRevocation,
  EditorialReviewQueue,
  EditorialReviewResult,
} from '@/lib/contracts/editorial-content';

function errorText(error: unknown, fallback: string) {
  if (
    error instanceof Error &&
    error.cause &&
    typeof error.cause === 'object' &&
    'error' in error.cause
  ) {
    const message = error.cause.error;
    return typeof message === 'string' ? message : fallback;
  }
  return fallback;
}

function ReviewDraft({
  draft,
  canReview,
  onDecision,
}: {
  draft: EditorialDraft;
  canReview: boolean;
  onDecision: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function decide(action: 'approved' | 'changes_requested') {
    setBusy(true);
    setMessage('');
    try {
      const result = await apiFetch(`/api/admin/editorial-drafts/${draft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, ...(note.trim() ? { note } : {}) }),
        schema: EditorialReviewResult,
      });
      setMessage(
        action === 'approved'
          ? `Aprobado por ${result.reviewerSnapshot}.`
          : 'Se solicitaron cambios al equipo.',
      );
      onDecision();
    } catch (error) {
      setMessage(errorText(error, 'No se pudo guardar la decisión.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="font-display text-2xl">{draft.title}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Encargo: {draft.brief}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Creado: {new Date(draft.createdAt).toLocaleString('es-ES')}
          </p>
        </div>
        <Badge variant="secondary">
          {draft.status === 'changes_requested'
            ? 'Revisión pendiente tras cambios'
            : 'Pendiente de revisión'}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        {draft.sections.map((section) => (
          <section key={section.id} className="grid gap-3 border-t border-border pt-4">
            <h3 className="font-display text-xl font-semibold">{section.heading}</h3>
            <p className="whitespace-pre-wrap leading-7">{section.body}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.sources
                .filter((source) => section.sourceIds.includes(source.id))
                .map((source) => (
                  <article key={source.id} className="rounded-lg bg-muted/70 p-3 text-sm">
                    <p className="font-medium">{source.title}</p>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-primary underline underline-offset-4"
                      >
                        {source.url}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Material aportado por el equipo, sin URL externa.
                      </p>
                    )}
                    {source.checkedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Consultado: {new Date(source.checkedAt).toLocaleDateString('es-ES')}
                      </p>
                    )}
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">
                        Extracto fuente guardado
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap">{source.excerpt}</p>
                    </details>
                  </article>
                ))}
            </div>
          </section>
        ))}
        <div className="rounded-lg border border-amber-700/20 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Revisión antes de cualquier uso externo</p>
          <p className="mt-1 text-muted-foreground">
            Comprueba cada afirmación frente al extracto enlazado y elimina consejos clínicos o
            afirmaciones sin respaldo. Aprobar aquí registra una decisión privada; no publica el
            contenido.
          </p>
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor={`review-note-${draft.id}`}>Nota de revisión</label>
          <Textarea
            id={`review-note-${draft.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Explica el motivo o los cambios solicitados."
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={!canReview || busy} onClick={() => decide('approved')}>
            Aprobar tras revisión profesional
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canReview || busy || note.trim().length === 0}
            onClick={() => decide('changes_requested')}
          >
            Solicitar cambios
          </Button>
        </div>
        {message && <output className="text-sm text-muted-foreground">{message}</output>}
      </CardContent>
    </Card>
  );
}

function ReviewerRow({
  reviewer,
  onRevoked,
}: {
  reviewer: EditorialReviewer;
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function revoke() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/editorial-reviewers/${reviewer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
        schema: EditorialReviewerRevocation,
      });
      onRevoked();
    } catch (error) {
      setMessage(errorText(error, 'No se pudo revocar la designación.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {reviewer.name ?? reviewer.email} · {reviewer.profession}
        </p>
        <p className="break-words text-muted-foreground">
          {reviewer.registryName}: {reviewer.registrationNumber} · {reviewer.jurisdiction}
        </p>
        <p className="text-xs text-muted-foreground">
          {reviewer.email} ·{' '}
          {reviewer.active
            ? 'Designación activa'
            : `Revocada ${reviewer.revokedAt ? new Date(reviewer.revokedAt).toLocaleDateString('es-ES') : ''}`}
        </p>
        {reviewer.authorizedByEmail && (
          <p className="text-xs text-muted-foreground">
            Designada por: {reviewer.authorizedByEmail}
          </p>
        )}
        {message && (
          <p role="alert" className="mt-1 text-destructive">
            {message}
          </p>
        )}
      </div>
      {reviewer.active && (
        <Button type="button" variant="outline" size="sm" onClick={revoke} disabled={busy}>
          {busy ? 'Guardando…' : 'Revocar autorización'}
        </Button>
      )}
    </div>
  );
}

export function EditorialReviewWorkspace() {
  const [items, setItems] = useState<EditorialDraft[]>([]);
  const [reviewers, setReviewers] = useState<EditorialReviewer[]>([]);
  const [currentReviewer, setCurrentReviewer] = useState<EditorialReviewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [registryName, setRegistryName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [credentialsConfirmed, setCredentialsConfirmed] = useState(false);
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    const queue = await apiFetch('/api/admin/editorial-drafts', { schema: EditorialReviewQueue });
    setItems(queue.items);
    setReviewers(queue.reviewers);
    setCurrentReviewer(queue.currentReviewer);
  }, []);
  useEffect(() => {
    reload()
      .catch(() =>
        setMessage('No se pudo cargar la cola de revisión. Comprueba el acceso administrativo.'),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  async function designate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await apiFetch('/api/admin/editorial-reviewers', {
        method: 'POST',
        body: JSON.stringify({
          email,
          profession,
          registryName,
          registrationNumber,
          jurisdiction,
          credentialsConfirmed,
        }),
        schema: EditorialReviewerCreateResult,
      });
      setMessage(
        'Designación guardada. La persona debe iniciar sesión con su cuenta admin para revisar.',
      );
      setEmail('');
      setProfession('');
      setRegistryName('');
      setRegistrationNumber('');
      setJurisdiction('');
      setCredentialsConfirmed(false);
      await reload();
    } catch (error) {
      setMessage(errorText(error, 'No se pudo guardar la designación.'));
    } finally {
      setBusy(false);
    }
  }

  async function refreshQueue() {
    try {
      await reload();
    } catch {
      setMessage('La decisión se guardó, pero no se pudo actualizar la cola. Recarga la página.');
    }
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Cargando la revisión de contenido…</p>;
  return (
    <div className="grid min-w-0 gap-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Vardelume · administración</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-normal">
          Revisión profesional
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          La decisión queda asociada a la cuenta, el registro profesional declarado y la fecha. Una
          aprobación mantiene el borrador privado y no inicia ninguna publicación.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Designar a una persona revisora</CardTitle>
          <p className="text-sm text-muted-foreground">
            La cuenta debe existir, tener el email verificado y contar con rol admin. Antes de
            guardar, verifica las credenciales en el registro profesional correspondiente.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={designate}>
            <label className="grid gap-2 text-sm font-medium" htmlFor="reviewer-email">
              Email de la cuenta admin
              <Input
                id="reviewer-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="reviewer-profession">
              Profesión declarada
              <Input
                id="reviewer-profession"
                value={profession}
                onChange={(event) => setProfession(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="reviewer-registry">
              Registro profesional
              <Input
                id="reviewer-registry"
                value={registryName}
                onChange={(event) => setRegistryName(event.target.value)}
                maxLength={160}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="reviewer-number">
              Número de registro
              <Input
                id="reviewer-number"
                value={registrationNumber}
                onChange={(event) => setRegistrationNumber(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="reviewer-jurisdiction">
              Jurisdicción
              <Input
                id="reviewer-jurisdiction"
                value={jurisdiction}
                onChange={(event) => setJurisdiction(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="flex items-start gap-3 rounded-lg bg-muted p-3 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={credentialsConfirmed}
                onChange={(event) => setCredentialsConfirmed(event.target.checked)}
                className="mt-1 size-4 accent-primary"
                required
              />
              <span>
                Confirmo que comprobé externamente esta credencial y autorizo a esta cuenta a
                revisar borradores.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={busy || !credentialsConfirmed}>
                {busy ? 'Guardando…' : 'Guardar designación'}
              </Button>
              {message && <output className="text-sm text-muted-foreground">{message}</output>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Personas designadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            La app registra la confirmación administrativa; no consulta registros profesionales
            externos.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {reviewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay designaciones.</p>
          ) : (
            reviewers.map((reviewer) => (
              <ReviewerRow key={reviewer.id} reviewer={reviewer} onRevoked={() => void reload()} />
            ))
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold">Cola de revisión</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentReviewer
                ? `Revisora activa: ${currentReviewer.name ?? currentReviewer.email} · ${currentReviewer.profession}`
                : 'Tu cuenta admin todavía no está designada como revisora profesional.'}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void refreshQueue()}>
            Actualizar cola
          </Button>
        </div>
        {!currentReviewer && (
          <p className="rounded-lg border border-amber-700/20 bg-amber-500/10 p-4 text-sm">
            Solo una persona designada puede registrar una decisión profesional. Usa el formulario
            tras verificar sus credenciales.
          </p>
        )}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No hay borradores pendientes.
          </p>
        ) : (
          items.map((draft) => (
            <ReviewDraft
              key={draft.id}
              draft={draft}
              canReview={Boolean(currentReviewer)}
              onDecision={() => {
                setItems((current) => current.filter((item) => item.id !== draft.id));
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}
