// @polsia:user-owned
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ProgramTutor } from '@/components/custom/program-tutor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api-client';
import {
  ProgramOverview,
  type ProgramOverview as ProgramOverviewData,
  ProgramProgressUpdateResult,
} from '@/lib/contracts/program-progress';

function formatWeek(weekNumber: number) {
  return `Semana ${String(weekNumber).padStart(2, '0')}`;
}

export function ProgramWorkspace() {
  const [program, setProgram] = useState<ProgramOverviewData | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/program', { schema: ProgramOverview })
      .then((result) => {
        if (active) setProgram(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : '';
        setLoadError(
          message.includes('(403)')
            ? 'Este espacio requiere una inscripción con pago confirmado.'
            : 'No pudimos cargar el espacio. Inténtalo de nuevo más tarde.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const completedWeeks = program?.weeks.filter((week) => week.completed).length ?? 0;
  const progressValue = Math.round((completedWeeks / 12) * 100);
  const selectedWeek = program?.weeks.find((week) => week.weekNumber === selectedWeekNumber);

  async function updateProgress() {
    if (!selectedWeek) return;
    setSaving(true);
    try {
      const saved = await apiFetch('/api/program', {
        method: 'PATCH',
        body: JSON.stringify({
          weekNumber: selectedWeek.weekNumber,
          completed: !selectedWeek.completed,
        }),
        schema: ProgramProgressUpdateResult,
      });
      setProgram((current) =>
        current
          ? {
              ...current,
              weeks: current.weeks.map((week) =>
                week.weekNumber === saved.weekNumber
                  ? { ...week, completed: saved.completed, updatedAt: saved.updatedAt }
                  : week,
              ),
            }
          : current,
      );
      toast.success(saved.completed ? 'Semana marcada como completada.' : 'Progreso actualizado.');
    } catch {
      toast.error('No se pudo guardar el progreso. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando tu espacio del programa…</p>;
  }

  if (loadError || !program) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Espacio del programa</CardTitle>
          <CardDescription role="alert">
            {loadError ?? 'El espacio no está disponible en este momento.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
          Seguimiento personal
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight">{program.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Recorre los temas a tu ritmo y actualiza tu avance cuando quieras.
        </p>
      </header>

      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
              Contenido de muestra
            </p>
            <CardTitle className="mt-2 text-lg">Propuesta de temario en revisión</CardTitle>
            <CardDescription className="mt-2 max-w-3xl leading-6">
              Los títulos, materiales y prácticas de estas semanas son ejemplos propuestos; el
              equipo debe adaptarlos al programa real antes de publicarlos como definitivos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="border-t border-border/70 pt-4 text-sm leading-6 text-muted-foreground">
          {program.disclaimer}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="font-display text-2xl">Tu recorrido</CardTitle>
            <CardDescription className="mt-2">
              {completedWeeks} de 12 semanas marcadas como completadas
            </CardDescription>
          </div>
          <span className="text-sm font-medium text-primary">{progressValue}%</span>
        </CardHeader>
        <CardContent>
          <Progress value={progressValue} aria-label={`Progreso personal: ${progressValue}%`} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Las 12 semanas</CardTitle>
            <CardDescription>Selecciona una semana para consultar su material.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {program.weeks.map((week) => (
              <Button
                key={week.weekNumber}
                type="button"
                variant={selectedWeekNumber === week.weekNumber ? 'secondary' : 'ghost'}
                className="h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left"
                aria-pressed={selectedWeekNumber === week.weekNumber}
                onClick={() => setSelectedWeekNumber(week.weekNumber)}
              >
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {formatWeek(week.weekNumber)}
                  </span>
                  <span className="block truncate font-medium">{week.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {week.completed ? 'Completada' : 'Pendiente'}
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>

        {selectedWeek ? (
          <Card>
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
                {formatWeek(selectedWeek.weekNumber)}
              </p>
              <CardTitle className="mt-2 font-display text-2xl">{selectedWeek.title}</CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                {selectedWeek.summary}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <section aria-labelledby="program-materials-heading" className="grid gap-3">
                <h2 id="program-materials-heading" className="text-sm font-semibold">
                  Materiales de muestra
                </h2>
                <ul className="grid gap-3">
                  {selectedWeek.materials.map((material) => (
                    <li
                      key={material.title}
                      className="rounded-lg border border-border/70 bg-background p-4"
                    >
                      <h3 className="font-medium">{material.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {material.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="program-practice-heading" className="grid gap-2">
                <h2 id="program-practice-heading" className="text-sm font-semibold">
                  Práctica de reflexión (muestra)
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">{selectedWeek.practice}</p>
              </section>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  El avance se guarda de forma privada en tu cuenta.
                </p>
                <Button type="button" disabled={saving} onClick={updateProgress}>
                  {saving
                    ? 'Guardando…'
                    : selectedWeek.completed
                      ? 'Desmarcar semana'
                      : 'Marcar semana como completada'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {selectedWeek ? (
        <ProgramTutor weekNumber={selectedWeek.weekNumber} weekTitle={selectedWeek.title} />
      ) : null}
    </div>
  );
}
