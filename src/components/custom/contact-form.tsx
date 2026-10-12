// @polsia:user-owned
'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { contactResponseSchema } from '@/lib/contact/schema';

const topics = [
  { value: 'microbioma', label: 'Microbioma y salud digestiva' },
  { value: 'sintomas', label: 'Cómo entender con prudencia los síntomas digestivos' },
  { value: 'hambre-emocional', label: 'Emociones y alimentación' },
  { value: 'programa', label: 'Formato y alcance del programa de 12 semanas' },
] as const;

const investmentOptions = [
  { value: 'considerar', label: 'Me interesa explorar ese rango' },
  { value: 'mas-informacion', label: 'Quiero conocer el precio vigente antes de decidir' },
  { value: 'no-ahora', label: 'Por ahora no contemplaría esa inversión' },
] as const;

// El mensaje conserva la información de encaje no clínica en el módulo de contacto existente.
export function ContactForm({ source = 'la portada' }: { source?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [investment, setInvestment] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    topic?: string;
    investment?: string;
  }>({});
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const selectedTopic = topics.find((option) => option.value === topic);
    const selectedInvestment = investmentOptions.find((option) => option.value === investment);
    if (!selectedTopic || !selectedInvestment) {
      setErrors({
        topic: selectedTopic ? undefined : 'Elige el tema que quieres explorar.',
        investment: selectedInvestment ? undefined : 'Elige una respuesta sobre el rango objetivo.',
      });
      setFormError('Completa las dos preguntas para que podamos valorar el encaje.');
      return;
    }
    setPending(true);
    setErrors({});
    setFormError('');
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          message: [
            `Solicitud de llamada de ajuste desde ${source}.`,
            `Tema que desea explorar: ${selectedTopic.label}.`,
            `Relación con el rango objetivo de US$1.500–2.500: ${selectedInvestment.label}.`,
          ].join('\n'),
        }),
        schema: contactResponseSchema,
      });
      setSubmitted(true);
    } catch (err) {
      const cause = (
        err as { cause?: { errors?: { name?: string; email?: string; message?: string } } }
      ).cause;
      setErrors((current) => ({
        ...current,
        name: cause?.errors?.name,
        email: cause?.errors?.email,
      }));
      setFormError(
        'No pudimos enviar la solicitud. Revisa los datos e inténtalo de nuevo más tarde.',
      );
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <output
        className="block rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6 text-foreground sm:p-6"
        aria-live="polite"
      >
        <p className="font-semibold">Solicitud enviada.</p>
        <p className="mt-2 text-muted-foreground">
          Gracias. Recibimos tu solicitud y nos pondremos en contacto para conversar sobre el ajuste
          del programa. La solicitud no reserva una fecha.
        </p>
      </output>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-3" noValidate>
      {formError ? (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 text-destructive"
          role="alert"
        >
          {formError}
        </p>
      ) : null}
      <Label htmlFor="contact-name">Tu nombre</Label>
      <Input
        id="contact-name"
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Nombre"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        required
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? 'contact-name-error' : undefined}
      />
      {errors.name ? (
        <p id="contact-name-error" className="text-sm text-destructive" role="alert">
          {errors.name}
        </p>
      ) : null}
      <Label htmlFor="contact-email">Tu correo electrónico</Label>
      <Input
        id="contact-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="nombre@ejemplo.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors((current) => ({ ...current, email: undefined }));
        }}
        required
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={errors.email ? 'contact-email-error' : undefined}
      />
      {errors.email ? (
        <p id="contact-email-error" className="text-sm text-destructive" role="alert">
          {errors.email}
        </p>
      ) : null}
      <Label htmlFor="contact-topic">¿Qué te gustaría explorar en la llamada?</Label>
      <select
        id="contact-topic"
        name="topic"
        value={topic}
        onChange={(event) => {
          setTopic(event.currentTarget.value);
          setErrors((current) => ({ ...current, topic: undefined }));
        }}
        aria-invalid={errors.topic ? true : undefined}
        aria-describedby={errors.topic ? 'contact-topic-error' : 'contact-topic-help'}
        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Elige un tema educativo</option>
        {topics.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors.topic ? (
        <p id="contact-topic-error" className="text-sm text-destructive" role="alert">
          {errors.topic}
        </p>
      ) : (
        <p id="contact-topic-help" className="text-sm leading-6 text-muted-foreground">
          No describas síntomas ni compartas información clínica.
        </p>
      )}
      <Label htmlFor="contact-investment">
        Sobre el rango objetivo de US$1.500–2.500 para 12 semanas
      </Label>
      <select
        id="contact-investment"
        name="investment"
        value={investment}
        onChange={(event) => {
          setInvestment(event.currentTarget.value);
          setErrors((current) => ({ ...current, investment: undefined }));
        }}
        aria-invalid={errors.investment ? true : undefined}
        aria-describedby={errors.investment ? 'contact-investment-error' : undefined}
        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Elige una respuesta</option>
        {investmentOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors.investment ? (
        <p id="contact-investment-error" className="text-sm text-destructive" role="alert">
          {errors.investment}
        </p>
      ) : null}
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Al enviar, solicitas que te contactemos para conversar sobre la propuesta educativa. La
        llamada no ofrece diagnóstico ni tratamiento.
      </p>
      <Button type="submit" disabled={pending} className="mt-2 min-h-12 w-full rounded-full">
        {pending ? 'Enviando solicitud…' : 'Solicitar llamada de ajuste'}
      </Button>
    </form>
  );
}
