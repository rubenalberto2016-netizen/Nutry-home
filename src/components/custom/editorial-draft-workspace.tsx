// @polsia:user-owned
'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import type { EditorialDraft, EditorialSource } from '@/lib/contracts/editorial-content';
import {
  EditorialDraftList,
  EditorialDraft as EditorialDraftSchema,
  EditorialSourceList,
  EditorialSource as EditorialSourceSchema,
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

function sourceLabel(source: EditorialSource) {
  return source.kind === 'web_search'
    ? 'Resultado de búsqueda web'
    : 'Material aportado por el equipo';
}

function SourceCard({
  source,
  selected,
  onToggle,
}: {
  source: EditorialSource;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <input
          id={`source-${source.id}`}
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 size-4 accent-primary"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`source-${source.id}`}
            className="cursor-pointer font-medium text-foreground"
          >
            {source.title}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{sourceLabel(source)}</p>
          {source.url ? (
            <a
              className="mt-2 inline-block break-all text-sm text-primary underline underline-offset-4"
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir fuente original
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              El extracto original aportado se conserva aquí para revisión.
            </p>
          )}
          {source.checkedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Consultado: {new Date(source.checkedAt).toLocaleDateString('es-ES')}
            </p>
          )}
          <details className="mt-3 text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Ver extracto guardado
            </summary>
            <p className="mt-2 whitespace-pre-wrap">{source.excerpt}</p>
          </details>
        </div>
      </div>
    </article>
  );
}

function DraftCard({
  draft,
  onSaved,
}: {
  draft: EditorialDraft;
  onSaved: (draft: EditorialDraft) => void;
}) {
  const [title, setTitle] = useState(draft.title);
  const [sections, setSections] = useState(draft.sections);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const editable = draft.status === 'pending_review' || draft.status === 'changes_requested';

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const updated = await apiFetch(`/api/editorial-drafts/${draft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, sections }),
        schema: EditorialDraftSchema,
      });
      onSaved(updated);
      setMessage('Guardado y enviado de nuevo a revisión profesional.');
    } catch (error) {
      setMessage(errorText(error, 'No se pudo guardar el borrador.'));
    } finally {
      setBusy(false);
    }
  }

  const badgeText =
    draft.status === 'approved'
      ? 'Aprobado · privado'
      : draft.status === 'changes_requested'
        ? 'Cambios solicitados'
        : 'Pendiente de revisión';
  return (
    <Card className="border-border/80 bg-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editable ? (
            <div className="grid gap-2 text-sm font-medium">
              <label htmlFor={`draft-title-${draft.id}`}>Título del borrador</label>
              <Input
                id={`draft-title-${draft.id}`}
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          ) : (
            <CardTitle className="font-display text-2xl">{draft.title}</CardTitle>
          )}
          <p className="mt-2 text-sm text-muted-foreground">Encargo: {draft.brief}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Actualizado: {new Date(draft.updatedAt).toLocaleString('es-ES')}
          </p>
        </div>
        <Badge variant={draft.status === 'approved' ? 'default' : 'secondary'}>{badgeText}</Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        {sections.map((section, index) => (
          <section key={section.id} className="grid gap-3 border-t border-border pt-4">
            <h3 className="font-display text-xl font-semibold">{section.heading}</h3>
            {editable ? (
              <div className="grid gap-2 text-sm font-medium">
                <label htmlFor={`draft-section-${draft.id}-${section.id}`}>
                  Texto de la sección
                </label>
                <Textarea
                  id={`draft-section-${draft.id}-${section.id}`}
                  value={section.body}
                  rows={5}
                  maxLength={1600}
                  onChange={(event) =>
                    setSections((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, body: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-7 text-foreground">{section.body}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.sources
                .filter((source) => section.sourceIds.includes(source.id))
                .map((source) => (
                  <div key={source.id} className="rounded-lg bg-muted/70 p-3 text-sm">
                    <p className="font-medium">Respaldo: {source.title}</p>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-primary underline underline-offset-4"
                      >
                        Abrir referencia
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Material interno aportado
                      </p>
                    )}
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                      {source.excerpt}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        ))}
        <div className="rounded-lg border border-primary/20 bg-accent/50 p-4 text-sm text-accent-foreground">
          Este borrador es privado y no se publica desde esta herramienta. Su aprobación tampoco lo
          publica automáticamente.
          {draft.approvedBySnapshot && (
            <p className="mt-2 font-medium">
              Aprobado por: {draft.approvedBySnapshot}
              {draft.approvedAt && ` · ${new Date(draft.approvedAt).toLocaleString('es-ES')}`}
            </p>
          )}
          {draft.latestReviewNote && (
            <p className="mt-2">Nota profesional: {draft.latestReviewNote}</p>
          )}
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            {message && <output className="text-sm text-muted-foreground">{message}</output>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EditorialDraftWorkspace() {
  const [sources, setSources] = useState<EditorialSource[]>([]);
  const [drafts, setDrafts] = useState<EditorialDraft[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('salud integrativa programa Vardelume');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialText, setMaterialText] = useState('');
  const [draftTitle, setDraftTitle] = useState('Borrador sobre el programa de salud integrativa');
  const [brief, setBrief] = useState(
    'Explica el enfoque y el contenido del programa usando solo hechos respaldados por las fuentes elegidas.',
  );
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    const [sourceList, draftList] = await Promise.all([
      apiFetch('/api/editorial-sources', { schema: EditorialSourceList }),
      apiFetch('/api/editorial-drafts', { schema: EditorialDraftList }),
    ]);
    setSources(sourceList.items);
    setDrafts(draftList.items);
  }, []);

  useEffect(() => {
    reload()
      .catch(() =>
        setMessage(
          'No se pudo cargar el espacio de borradores. Comprueba tu sesión e inténtalo de nuevo.',
        ),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  async function searchSources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('Buscando fuentes…');
    try {
      const result = await apiFetch('/api/editorial-sources/search', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery }),
        schema: EditorialSourceList,
      });
      setSources((current) => [...result.items, ...current]);
      setSelected((current) => [
        ...new Set([...current, ...result.items.map((source) => source.id)]),
      ]);
      setMessage(
        result.items.length
          ? `Se guardaron ${result.items.length} resultados del buscador con sus URL y extractos.`
          : 'La búsqueda no devolvió extractos utilizables.',
      );
    } catch (error) {
      setMessage(
        errorText(error, 'La búsqueda web no está disponible. Puedes añadir materiales internos.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function addMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const source = await apiFetch('/api/editorial-sources', {
        method: 'POST',
        body: JSON.stringify({ title: materialTitle, excerpt: materialText }),
        schema: EditorialSourceSchema,
      });
      setSources((current) => [source, ...current]);
      setSelected((current) => [...current, source.id]);
      setMaterialTitle('');
      setMaterialText('');
      setMessage('Material guardado en el espacio privado.');
    } catch (error) {
      setMessage(errorText(error, 'No se pudo guardar el material.'));
    } finally {
      setBusy(false);
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('Preparando un borrador respaldado por las fuentes…');
    try {
      const draft = await apiFetch('/api/editorial-drafts', {
        method: 'POST',
        body: JSON.stringify({ title: draftTitle, brief, sourceIds: selected }),
        schema: EditorialDraftSchema,
      });
      setDrafts((current) => [draft, ...current]);
      setMessage('Borrador guardado como pendiente de revisión profesional.');
    } catch (error) {
      setMessage(errorText(error, 'No se pudo generar el borrador.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Cargando fuentes y borradores…</p>;
  return (
    <div className="grid min-w-0 gap-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Vardelume · espacio privado</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-normal text-foreground">
          Borradores con fuentes
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Prepara contenido informativo sobre el programa a partir de materiales del equipo o
          extractos web guardados. Cada sección conserva sus respaldos para una revisión
          profesional.
        </p>
      </header>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">1. Buscar referencias web</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cada resultado conserva el título, la URL exacta, el extracto y la fecha de consulta
              del buscador.
            </p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={searchSources}>
              <label htmlFor="source-query" className="text-sm font-medium">
                Tema o consulta
              </label>
              <Input
                id="source-query"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                maxLength={300}
                minLength={4}
                required
              />
              <Button type="submit" variant="outline" disabled={busy}>
                Buscar y guardar resultados
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Añadir material del equipo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pega aquí texto de un documento existente. Se conservará completo como material
              aportado, no como verificación externa.
            </p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={addMaterial}>
              <label htmlFor="material-title" className="text-sm font-medium">
                Nombre del documento o material
              </label>
              <Input
                id="material-title"
                value={materialTitle}
                onChange={(event) => setMaterialTitle(event.target.value)}
                maxLength={300}
                required
              />
              <label htmlFor="material-text" className="text-sm font-medium">
                Extracto fuente
              </label>
              <Textarea
                id="material-text"
                value={materialText}
                onChange={(event) => setMaterialText(event.target.value)}
                minLength={20}
                maxLength={8000}
                rows={4}
                required
              />
              <Button type="submit" variant="outline" disabled={busy}>
                Guardar material privado
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">2. Elegir fuentes y generar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Las secciones generadas deben citar únicamente estos registros guardados. Las
            afirmaciones sin respaldo o que parezcan consejo clínico se omiten o se rechazan.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5">
          {sources.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              Aún no hay fuentes. Busca referencias o añade un extracto de material existente.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  selected={selected.includes(source.id)}
                  onToggle={() =>
                    setSelected((current) =>
                      current.includes(source.id)
                        ? current.filter((id) => id !== source.id)
                        : [...current, source.id],
                    )
                  }
                />
              ))}
            </div>
          )}
          <form className="grid gap-3 border-t border-border pt-5" onSubmit={generate}>
            <label htmlFor="draft-title" className="text-sm font-medium">
              Título de trabajo
            </label>
            <Input
              id="draft-title"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={160}
              required
            />
            <label htmlFor="draft-brief" className="text-sm font-medium">
              Qué debe explicar el borrador
            </label>
            <Textarea
              id="draft-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              minLength={10}
              maxLength={1500}
              rows={4}
              required
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy || selected.length === 0}>
                {busy ? 'Procesando…' : 'Generar borrador pendiente'}
              </Button>
              <p className="text-sm text-muted-foreground">
                {selected.length} fuente(s) seleccionada(s)
              </p>
            </div>
          </form>
          {message && (
            <output
              aria-live="polite"
              className="rounded-lg bg-muted p-3 text-sm text-muted-foreground"
            >
              {message}
            </output>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold">Borradores del espacio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Privados para este espacio; ninguno se muestra en páginas públicas.
          </p>
        </div>
        {drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Todavía no hay borradores guardados.
          </p>
        ) : (
          drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onSaved={(updated) =>
                setDrafts((current) =>
                  current.map((item) => (item.id === updated.id ? updated : item)),
                )
              }
            />
          ))
        )}
      </section>
    </div>
  );
}
