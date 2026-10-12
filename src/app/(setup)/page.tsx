// @polsia:user-owned — página pública de captación para el programa educativo.

import type { Metadata } from 'next';
import Link from 'next/link';
import { AdmissionAssistant } from '@/components/custom/admission-assistant';
import { ContactForm } from '@/components/custom/contact-form';
import { Button } from '@/components/ui/button';
import { siteDescription, siteName } from '@/lib/brand';
import { COHORT_PRICE_RANGE_LABEL } from '@/lib/business/cohort-offer';

export const metadata: Metadata = {
  title: { absolute: `${siteName} — programa educativo de 12 semanas` },
  description: siteDescription,
  alternates: { canonical: '/' },
};

const learningAreas = [
  {
    number: '01',
    title: 'Salud digestiva',
    description: 'Conocer conceptos generales y preguntas útiles para comprender mejor este campo.',
  },
  {
    number: '02',
    title: 'Alimentación',
    description:
      'Explorar principios educativos sobre alimentación, sin dietas ni indicaciones clínicas individuales.',
  },
  {
    number: '03',
    title: 'Regulación emocional',
    description:
      'Acercarse a recursos generales para observar emociones y conversar sobre su relación con el bienestar.',
  },
];

export default function HomePage() {
  return (
    <main id="inicio" className="overflow-x-clip bg-background text-foreground">
      <header className="relative z-10 border-b border-border/70 bg-background/90">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
          <Link
            href="#inicio"
            className="flex min-w-0 items-center gap-3"
            aria-label="Eje en Calma, inicio"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <svg viewBox="0 0 32 32" fill="none" className="size-6">
                <title>Ilustración botánica decorativa</title>
                <path
                  d="M16 4.5c-5.8 4-8.7 7.8-8.7 11.5s3.9 8 8.7 11.5c4.8-3.5 8.7-7.8 8.7-11.5S21.8 8.5 16 4.5Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M16 8v16M11.5 14.5c1.8.3 3.3 1.2 4.5 2.7 1.2-1.5 2.7-2.4 4.5-2.7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-semibold leading-tight sm:text-lg">
                {siteName}
              </span>
              <span className="block text-[0.68rem] leading-tight text-muted-foreground sm:text-xs">
                Nombre de trabajo
              </span>
            </span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-7 md:flex">
            <Link
              href="#programa"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              El programa
            </Link>
            <Link
              href="#formato"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Formato
            </Link>
            <Link
              href="#inversion"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Inversión
            </Link>
            <Link
              href="#asistente-admision"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Preguntas
            </Link>
            <Link
              href="/clase-magistral"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Clase magistral
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full px-3 sm:px-4">
              <Link href="/login">Participantes</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-4 sm:px-5">
              <Link href="#solicitud">Solicitar llamada</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative isolate border-b border-border/60">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -right-28 -top-36 size-[25rem] rounded-full bg-accent/70 blur-3xl sm:size-[36rem]" />
          <div className="absolute -bottom-36 -left-20 size-[23rem] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.75fr] lg:items-center lg:gap-16 lg:px-10 lg:py-28">
          <div className="min-w-0 max-w-3xl">
            <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-primary/20 bg-card/80 px-3 py-1.5 text-xs font-medium tracking-wide text-primary sm:text-sm">
              <span>Propuesta educativa</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-primary/60" />
              <span>12 semanas</span>
            </p>
            <h1 className="mt-7 max-w-3xl text-balance font-display text-4xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Salud digestiva, alimentación y emociones, en una misma conversación.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Un programa híbrido de 12 semanas para aprender sobre estos temas con una mirada
              educativa, cuidadosa y sin promesas clínicas.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" className="min-h-12 w-full rounded-full px-7 sm:w-auto">
                <Link href="#solicitud">Solicitar una llamada de ajuste</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="min-h-12 w-full rounded-full px-6 sm:w-auto"
              >
                <Link href="#programa">Conocer la propuesta</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              ¿Tienes dudas logísticas?{' '}
              <Link
                href="#asistente-admision"
                className="font-medium text-primary underline underline-offset-4"
              >
                Pregunta al asistente de admisión
              </Link>
              .
            </p>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
              Eje en Calma es un{' '}
              <strong className="font-semibold text-foreground">nombre de trabajo</strong>; la
              propuesta se presenta para conversar y ajustar su encaje.
            </p>
          </div>

          <aside className="relative mx-auto w-full max-w-md rounded-[2rem] border border-primary/15 bg-card/90 p-6 shadow-xl shadow-primary/5 backdrop-blur-sm sm:p-8">
            <div
              aria-hidden="true"
              className="absolute right-6 top-6 size-20 rounded-full border border-primary/15 sm:right-8 sm:top-8 sm:size-24"
            >
              <span className="absolute inset-3 rounded-full border border-primary/20" />
              <span className="absolute inset-7 rounded-full bg-accent" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Una mirada integrada
            </p>
            <p className="mt-14 max-w-xs font-display text-2xl leading-snug sm:text-3xl">
              Aprender, observar y hacer mejores preguntas.
            </p>
            <div className="mt-8 space-y-0 divide-y divide-border">
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-muted-foreground">Duración</span>
                <span className="text-right text-sm font-medium">12 semanas</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-muted-foreground">Enfoque</span>
                <span className="max-w-44 text-right text-sm font-medium">
                  Educación y reflexión
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-muted-foreground">Formato</span>
                <span className="text-right text-sm font-medium">Híbrido propuesto</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section
        id="programa"
        className="scroll-mt-8 mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-32"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Para quién y para qué
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
            Un espacio para aprender, no para recibir un diagnóstico.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Puede interesarte si quieres comprender mejor cómo se estudian la salud digestiva, la
            alimentación y la regulación emocional, y sumar contexto educativo a tus propias
            preguntas.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {learningAreas.map((area) => (
            <article
              key={area.number}
              className="min-w-0 rounded-3xl border border-border bg-card p-6 sm:p-7"
            >
              <span className="font-mono text-xs text-primary">{area.number}</span>
              <h3 className="mt-5 font-display text-xl font-medium sm:text-2xl">{area.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                {area.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-7 max-w-4xl rounded-2xl bg-accent/60 px-5 py-4 text-sm leading-6 text-accent-foreground sm:px-6 sm:text-base">
          El valor propuesto es educativo: ofrecer conceptos y perspectivas para comprender mejor
          estos temas y formular preguntas informadas. No se prometen cambios clínicos ni resultados
          determinados.
        </p>
      </section>

      <section className="border-y border-border/70 bg-secondary/45">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-8 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Clase magistral a demanda
            </p>
            <h2 className="mt-3 text-balance font-display text-2xl font-medium leading-tight tracking-[-0.025em] sm:text-3xl">
              Microbioma, síntomas digestivos y hambre emocional, con contexto y sin diagnósticos.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Lee la clase cuando quieras. Está disponible sin depender de una fecha de emisión.
            </p>
          </div>
          <Button asChild size="lg" className="min-h-12 w-full shrink-0 rounded-full sm:w-auto">
            <Link href="/clase-magistral">Ver la clase magistral</Link>
          </Button>
        </div>
      </section>

      <section id="formato" className="scroll-mt-8 border-y border-border/70 bg-secondary/45">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10 lg:py-28">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Cómo se combinaría
            </p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Híbrido, con contenidos para revisar y espacios de encuentro.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Esta es una propuesta inicial de formato. La frecuencia y la logística todavía no
              están definidas; se pueden conversar en la llamada de ajuste.
            </p>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Componente digital
              </p>
              <h3 className="mt-4 font-display text-xl font-medium">Recursos educativos</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Materiales digitales asincrónicos para acercarse a los conceptos y revisarlos a tu
                ritmo.
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-card p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Componente de encuentro
              </p>
              <h3 className="mt-4 font-display text-xl font-medium">Conversaciones guiadas</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Espacios de acompañamiento para recorrer los temas y plantear preguntas generales.
              </p>
            </article>
            <p className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-muted-foreground sm:col-span-2 sm:px-6">
              La combinación anterior es una propuesta de trabajo, no una agenda confirmada ni una
              oferta de atención clínica.
            </p>
          </div>
        </div>
      </section>

      <section
        id="inversion"
        className="scroll-mt-8 mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"
      >
        <div className="grid gap-8 rounded-[2rem] border border-primary/15 bg-card p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:p-12">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Inversión prevista
            </p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Un rango estimado para valorar el encaje.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              La cifra es una estimación para esta propuesta educativa; la llamada es una
              conversación de ajuste.
            </p>
          </div>
          <div className="grid justify-items-start gap-3 lg:justify-items-end">
            <p className="break-words text-left font-display text-3xl font-medium tracking-tight text-primary sm:text-4xl lg:text-right">
              {COHORT_PRICE_RANGE_LABEL}
            </p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/pricing">Ver términos y precio total</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-accent/35">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14 lg:px-10">
          <div className="max-w-4xl rounded-2xl border border-border/80 bg-background/80 p-5 sm:p-7">
            <p className="font-semibold">Alcance y cuidado</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              Este programa es educativo: no diagnostica ni sustituye la atención médica o
              psicológica. Si necesitas evaluación o tratamiento, consulta con profesionales
              habilitados.
            </p>
          </div>
        </div>
      </section>

      <AdmissionAssistant />

      <section
        id="solicitud"
        className="scroll-mt-8 mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-10 lg:py-32"
      >
        <div className="min-w-0 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Siguiente paso
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
            Solicita una llamada de ajuste.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Deja tu nombre y correo para conversar sobre la propuesta de 12 semanas y valorar si
            responde a lo que buscas.
          </p>
          <p className="mt-5 rounded-2xl bg-muted px-5 py-4 text-sm leading-6 text-muted-foreground">
            Comparte tus datos de contacto y tus intereses generales sobre la propuesta. No incluyas
            diagnósticos, síntomas ni otros datos clínicos sensibles.
          </p>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            La llamada no es una consulta clínica. El programa tampoco diagnostica ni reemplaza
            atención médica o psicológica.
          </p>
        </div>

        <div className="min-w-0 rounded-[2rem] border border-border bg-card p-5 shadow-lg shadow-primary/5 sm:p-8">
          <ContactForm source="la portada" />
        </div>
      </section>

      <footer id="landing-footer" className="border-t border-border bg-secondary/35">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>
            {siteName} <span className="text-foreground/70">· nombre de trabajo</span>
          </p>
          <Link
            className="break-all underline decoration-primary/40 underline-offset-4 hover:text-foreground"
            href="mailto:vardelume@polsia.app"
          >
            vardelume@polsia.app
          </Link>
        </div>
      </footer>
    </main>
  );
}
