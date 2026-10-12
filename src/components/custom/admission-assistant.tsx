// @polsia:user-owned — interfaz pública de consultas para admisión.
'use client';

import { ArrowUp, Bot, CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type AdmissionAssistantResponse,
  admissionAssistantResponseSchema,
} from '@/lib/contracts/admission-assistant';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const suggestedQuestions = [
  '¿Cuánto dura el programa?',
  '¿Qué formato tiene?',
  '¿Qué puedo preparar para la llamada?',
];

export function AdmissionAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || pending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setPending(true);

    try {
      const result = await apiFetch<AdmissionAssistantResponse>('/api/admission-assistant', {
        method: 'POST',
        body: JSON.stringify({ question: trimmed }),
        schema: admissionAssistantResponseSchema,
      });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: result.answer },
      ]);
    } catch {
      toast.error('No se pudo consultar el asistente. Puedes preguntar en la llamada de ajuste.');
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Ahora no puedo responder. Puedes plantear la duda en la llamada de ajuste.',
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="asistente-admision"
      className="scroll-mt-8 border-y border-border/70 bg-secondary/35"
      aria-labelledby="admission-assistant-title"
    >
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16 lg:px-10 lg:py-24">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            <Bot className="size-4" aria-hidden="true" />
            Asistente de admisión
          </p>
          <h2
            id="admission-assistant-title"
            className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl"
          >
            Resuelve dudas logísticas y prepara tu llamada.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Responde con la información pública confirmada sobre la propuesta de 12 semanas. Si un
            dato no está confirmado, te lo dirá.
          </p>
          <div className="mt-6 rounded-2xl border border-primary/15 bg-background/80 p-5 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">Alcance educativo</p>
            <p className="mt-2">
              No diagnostica, no da orientación clínica ni hace triaje. Para síntomas, medicación o
              una situación de riesgo, consulta con un profesional de salud. Si hay peligro
              inmediato, contacta con los servicios de emergencia de tu zona.
            </p>
          </div>
          <p className="mt-5 flex gap-2 text-sm leading-6 text-muted-foreground">
            <CircleHelp className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
            No hace falta compartir información médica, síntomas, nombre ni datos de contacto para
            preparar la llamada. Si una pregunta no coincide con una respuesta directa, el texto
            puede pasar al servicio de IA solo para clasificarla; la respuesta siempre se elige de
            datos públicos. La app no guarda la conversación ni la añade a una cuenta o solicitud.
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[2rem] border border-border bg-card shadow-lg shadow-primary/5">
          <div className="border-b border-border/70 px-5 py-4 sm:px-7">
            <p className="font-display text-lg font-medium">Preguntas sobre admisión</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pregunta por duración, formato, temas, rango estimado o llamada.
            </p>
          </div>

          <div
            role="log"
            aria-label="Conversación de admisión; se borra al salir de esta página"
            aria-live="polite"
            className="flex min-h-40 max-h-96 flex-col gap-3 overflow-y-auto px-5 py-5 sm:px-7"
          >
            {messages.length === 0 ? (
              <>
                <p className="max-w-lg rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
                  Puedo ayudarte con datos logísticos publicados y con ideas generales para preparar
                  la llamada. No compartas datos personales ni médicos.
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {suggestedQuestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-auto rounded-full whitespace-normal text-left"
                      onClick={() => void ask(suggestion)}
                      disabled={pending}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              messages.map((message) => (
                <p
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'ml-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground'
                      : 'mr-auto max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground'
                  }
                >
                  {message.content}
                </p>
              ))
            )}
            {pending ? (
              <p className="mr-auto rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                Revisando la pregunta…
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-border/70 p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
          >
            <label htmlFor="admission-question" className="sr-only">
              Pregunta logística sobre la admisión
            </label>
            <div className="flex items-end gap-2">
              <Textarea
                id="admission-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Escribe una pregunta logística breve…"
                className="max-h-32 min-h-12 resize-y rounded-2xl bg-background"
                disabled={pending}
              />
              <Button
                type="submit"
                size="icon"
                className="size-12 shrink-0 rounded-full"
                disabled={pending || question.trim().length < 2}
                aria-label="Enviar pregunta"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-3 flex flex-col justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
              <span>Hasta 500 caracteres. No envíes datos personales o clínicos.</span>
              <Link
                href="#solicitud"
                className="font-medium text-primary underline underline-offset-4"
              >
                Preparar la llamada
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
