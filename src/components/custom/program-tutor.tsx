// @polsia:user-owned — lector y asistente educativo del espacio del programa.
'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  ProgramTutorMaterialsResponse,
  ProgramTutorResponse,
  type ProgramTutorResponse as ProgramTutorResponseData,
} from '@/lib/contracts/program-tutor';

interface ProgramTutorProps {
  weekNumber: number;
  weekTitle: string;
}

interface TutorTurn {
  id: number;
  question: string;
  response: ProgramTutorResponseData;
}

export function ProgramTutor({ weekNumber, weekTitle }: ProgramTutorProps) {
  const [materials, setMaterials] = useState<ProgramTutorMaterialsResponse['materials'] | null>(
    null,
  );
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [pending, setPending] = useState(false);
  const nextTurnId = useRef(0);

  useEffect(() => {
    let active = true;
    setMaterials(null);
    setMaterialsError(null);
    setTurns([]);
    setQuestion('');
    apiFetch(`/api/program/tutor?weekNumber=${weekNumber}`, {
      schema: ProgramTutorMaterialsResponse,
    })
      .then((result) => {
        if (active) setMaterials(result.materials);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : '';
        setMaterialsError(
          message.includes('(403)')
            ? 'Necesitas acceso activo al programa para consultar estos materiales.'
            : 'No se pudieron cargar los materiales aprobados. Inténtalo de nuevo más tarde.',
        );
      });
    return () => {
      active = false;
    };
  }, [weekNumber]);

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || question.trim().length < 2) return;
    const submittedQuestion = question.trim();
    setPending(true);
    setQuestion('');
    try {
      const response = await apiFetch('/api/program/tutor', {
        method: 'POST',
        body: JSON.stringify({ weekNumber, question: submittedQuestion }),
        schema: ProgramTutorResponse,
      });
      nextTurnId.current += 1;
      setTurns((current) => [
        ...current,
        { id: nextTurnId.current, question: submittedQuestion, response },
      ]);
    } catch {
      setQuestion(submittedQuestion);
      toast.error('No se pudo enviar la pregunta. Inténtalo de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
          Ayuda educativa · Semana {String(weekNumber).padStart(2, '0')}
        </p>
        <CardTitle className="mt-2 font-display text-xl">Entiende el material aprobado</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          Consulta los documentos de «{weekTitle}». Las explicaciones se limitan a esas fuentes; las
          consultas clínicas se derivan a un profesional.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section aria-label="Materiales educativos aprobados" className="grid gap-3">
          <h3 className="text-sm font-semibold">Materiales de esta semana</h3>
          {materials === null ? (
            <p className="text-sm text-muted-foreground">Cargando materiales…</p>
          ) : materialsError ? (
            <p className="text-sm text-destructive" role="alert">
              {materialsError}
            </p>
          ) : materials.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
              El equipo todavía no ha publicado materiales aprobados para esta semana. El asistente
              no usará los ejemplos del temario en revisión.
            </p>
          ) : (
            <ul className="grid gap-3">
              {materials.map((material) => (
                <li key={material.id} className="rounded-lg border border-border/70 p-4">
                  <h4 className="font-medium">{material.title}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {material.content}
                  </p>
                  <Link
                    href={material.sourceHref}
                    className="mt-3 inline-flex text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Abrir material completo
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Conversación educativa" className="grid gap-3">
          <div aria-live="polite" className="grid max-h-96 gap-3 overflow-y-auto">
            {turns.map((turn) => (
              <article key={turn.id} className="grid gap-2">
                <p className="ml-auto max-w-[90%] rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                  {turn.question}
                </p>
                <div className="mr-auto max-w-[95%] rounded-lg border border-border/70 bg-background px-3 py-3 text-sm leading-6">
                  <p className="whitespace-pre-wrap">{turn.response.answer}</p>
                  {turn.response.citations.length > 0 ? (
                    <p className="mt-2 flex flex-wrap gap-x-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                      Fuente:{' '}
                      {turn.response.citations.map((citation, index) => (
                        <span key={citation.id}>
                          {index > 0 ? ', ' : null}
                          <Link
                            href={citation.sourceHref}
                            className="text-primary underline underline-offset-2"
                          >
                            {citation.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
            {pending ? (
              <p className="mr-auto rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Revisando los materiales aprobados…
              </p>
            ) : null}
          </div>

          <form className="grid gap-3 border-t border-border/70 pt-4" onSubmit={askQuestion}>
            <label className="text-sm font-medium" htmlFor={`program-tutor-question-${weekNumber}`}>
              Tu pregunta sobre esta semana
            </label>
            <Textarea
              id={`program-tutor-question-${weekNumber}`}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="¿Qué idea del material te gustaría entender mejor?"
              aria-describedby={`program-tutor-note-${weekNumber}`}
            />
            <p
              id={`program-tutor-note-${weekNumber}`}
              className="text-xs leading-5 text-muted-foreground"
            >
              No incluyas datos personales. El asistente no diagnostica ni ofrece consejos clínicos.
            </p>
            <Button
              type="submit"
              className="w-full sm:w-fit"
              disabled={pending || question.trim().length < 2}
            >
              {pending ? 'Consultando…' : 'Consultar material'}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}
