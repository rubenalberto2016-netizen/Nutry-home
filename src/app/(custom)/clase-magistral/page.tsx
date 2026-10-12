// @polsia:user-owned — clase magistral educativa a demanda.

import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/custom/contact-form';
import { Button } from '@/components/ui/button';
import { siteName } from '@/lib/brand';
import { COHORT_PRICE_RANGE_LABEL } from '@/lib/business/cohort-offer';

export const metadata: Metadata = {
  title: `Clase magistral a demanda: microbioma y salud digestiva | ${siteName}`,
  description:
    'Clase magistral educativa sobre microbioma, síntomas digestivos y hambre emocional, disponible a demanda y sin diagnósticos ni promesas clínicas.',
  alternates: { canonical: '/clase-magistral' },
  openGraph: {
    title: `Clase magistral a demanda | ${siteName}`,
    description:
      'Una lectura educativa y prudente sobre microbioma, síntomas digestivos y hambre emocional.',
    url: '/clase-magistral',
    type: 'article',
  },
};

const references = [
  {
    title: 'NIDDK: síntomas y causas del gas en el aparato digestivo',
    href: 'https://www.niddk.nih.gov/health-information/digestive-diseases/gas-digestive-tract/symptoms-causes',
  },
  {
    title: 'NIDDK: síntomas y causas del síndrome del intestino irritable',
    href: 'https://www.niddk.nih.gov/health-information/digestive-diseases/irritable-bowel-syndrome/symptoms-causes',
  },
  {
    title: 'Consenso internacional sobre pruebas del microbioma en la práctica clínica',
    href: 'https://pubmed.ncbi.nlm.nih.gov/39647502/',
  },
];

export default function ClaseMagistralPage() {
  return (
    <main className="overflow-x-clip bg-background text-foreground">
      <section className="border-b border-border/70 bg-secondary/35">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-24">
          <div className="max-w-4xl">
            <p className="inline-flex rounded-full border border-primary/20 bg-background px-3 py-1.5 text-sm font-medium text-primary">
              Clase magistral · disponible a demanda
            </p>
            <h1 className="mt-6 text-balance font-display text-4xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Microbioma, síntomas digestivos y hambre emocional: entender sin diagnosticar.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Una lectura educativa para poner estos temas en contexto, reconocer los límites de lo
              que puede concluirse y preparar preguntas informadas. Puedes recorrerla cuando
              quieras; no depende de una fecha de emisión ni de una sesión en directo.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="min-h-12 w-full rounded-full px-6 sm:w-auto">
                <Link href="#solicitud">Solicitar una llamada de ajuste</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 rounded-full px-6">
                <Link href="/pricing">Ver el precio vigente del programa</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="min-h-12 rounded-full px-6">
                <Link href="/#asistente-admision">Preguntas de admisión</Link>
              </Button>
            </div>
          </div>
          <aside className="max-w-sm rounded-3xl border border-primary/15 bg-background p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Recorrido de la clase
            </p>
            <ol className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
              <li>01 · Microbiota, microbioma y límites de las pruebas</li>
              <li>02 · Síntomas digestivos y explicaciones posibles</li>
              <li>03 · Emociones, alimentación y preguntas sin juicio</li>
            </ol>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-20 lg:px-10 lg:py-24">
        <article className="min-w-0 max-w-4xl">
          <section
            id="microbioma"
            className="scroll-mt-24 border-b border-border/70 pb-12 sm:pb-14"
          >
            <p className="font-mono text-xs text-primary">01 · El ecosistema intestinal</p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Microbioma: una comunidad, no una etiqueta clínica.
            </h2>
            <div className="mt-6 grid gap-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              <p>
                La microbiota suele nombrar a los microorganismos que viven en un entorno. La
                palabra microbioma se usa para hablar de esa comunidad y, según el contexto, también
                de sus genes y del ambiente en que interactúa. Son conceptos relacionados; no
                describen por sí solos el estado de salud de una persona.
              </p>
              <p>
                La investigación estudia cómo se relacionan estas comunidades con distintos procesos
                del organismo. Una asociación observada entre grupos no demuestra por sí sola qué
                causa un síntoma ni qué ocurre en un individuo. No existe aquí una conclusión
                automática que permita diagnosticar “disbiosis” a partir de una lista de
                microorganismos.
              </p>
              <p>
                El consenso internacional sobre pruebas del microbioma señala que la evidencia sobre
                su utilidad clínica todavía es limitada y recomienda cautela con pruebas directas al
                consumidor. Esta clase no interpreta resultados de laboratorio ni propone pruebas
                para autodiagnóstico.
              </p>
            </div>
          </section>

          <section id="sintomas" className="scroll-mt-24 border-b border-border/70 py-12 sm:py-14">
            <p className="font-mono text-xs text-primary">02 · Señales y contexto</p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Un síntoma digestivo merece contexto, no una causa prefabricada.
            </h2>
            <div className="mt-6 grid gap-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              <p>
                Gases, distensión, dolor abdominal o cambios al evacuar son experiencias que pueden
                tener más de una explicación. El síntoma, por sí solo, no confirma disbiosis ni
                identifica qué tratamiento —si alguno— necesita una persona.
              </p>
              <p>
                Algunos trastornos digestivos se estudian considerando la comunicación entre el
                intestino y el cerebro, junto con otros factores. Eso no vuelve imaginario un
                síntoma ni permite concluir que una emoción sea su causa. Una evaluación individual
                corresponde a profesionales habilitados, con la historia y el contexto pertinentes.
              </p>
              <p>
                Si algo persiste, empeora, es nuevo o requiere diagnóstico o tratamiento, busca
                orientación de un profesional de salud. La clase y el programa no sustituyen esa
                evaluación ni ofrecen atención individualizada.
              </p>
            </div>
          </section>

          <section
            id="hambre-emocional"
            className="scroll-mt-24 border-b border-border/70 py-12 sm:py-14"
          >
            <p className="font-mono text-xs text-primary">03 · Emoción y alimentación</p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              “Hambre emocional” no explica por sí sola una conducta.
            </h2>
            <div className="mt-6 grid gap-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              <p>
                La expresión puede servir para conversar sobre momentos en que comer y sentir una
                emoción coinciden. No es un diagnóstico, no distingue una necesidad “real” de otra
                “falsa” y no demuestra una causa única. Las experiencias con comida, apetito y
                emociones varían de una persona a otra.
              </p>
              <p>
                Como ejercicio educativo, puedes notar el contexto con curiosidad: ¿qué estaba
                ocurriendo?, ¿qué emociones estaban presentes?, ¿qué otras necesidades o
                circunstancias importaban? No hace falta responder aquí ni compartir información
                personal. Estas preguntas no sirven para diagnosticar, prescribir una dieta o
                reemplazar apoyo psicológico o nutricional individualizado.
              </p>
            </div>
          </section>

          <section id="limites" className="scroll-mt-24 pt-12 sm:pt-14">
            <p className="font-mono text-xs text-primary">04 · Alcance</p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Educación general; atención clínica fuera del programa.
            </h2>
            <div className="mt-6 rounded-3xl border border-primary/15 bg-accent/45 p-5 text-sm leading-6 text-foreground sm:p-7 sm:text-base sm:leading-7">
              <p>
                La clase y el programa de 12 semanas ofrecen contenido educativo y conversación
                general. No diagnostican disbiosis, no interpretan pruebas, no prescriben dietas o
                tratamientos y no prometen curas ni resultados clínicos.
              </p>
              <p className="mt-4">
                Si necesitas una evaluación, tratamiento o acompañamiento individualizado que exceda
                este alcance, consulta por separado con un profesional de salud habilitado. La
                llamada de ajuste sirve para conversar sobre el encaje educativo; no es una consulta
                clínica.
              </p>
            </div>
          </section>

          <section className="mt-12 border-t border-border/70 pt-8" aria-labelledby="fuentes-title">
            <h2 id="fuentes-title" className="font-semibold">
              Lecturas de referencia
            </h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6">
              {references.map((reference) => (
                <li key={reference.href}>
                  <Link
                    href={reference.href}
                    className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  >
                    {reference.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </article>

        <aside className="grid h-fit gap-5 rounded-3xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Propuesta educativa
            </p>
            <h2 className="mt-3 font-display text-2xl font-medium">12 semanas</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              El rango objetivo total es {COHORT_PRICE_RANGE_LABEL}. Consulta en la página de
              inscripción el precio vigente y las condiciones.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 rounded-full">
            <Link href="/pricing">Ver precio y condiciones</Link>
          </Button>
          <p className="border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
            La propuesta es educativa. No incluye diagnóstico, tratamiento ni resultados clínicos
            prometidos.
          </p>
        </aside>
      </div>

      <section id="solicitud" className="scroll-mt-16 border-y border-border/70 bg-secondary/35">
        <div className="mx-auto grid max-w-7xl gap-9 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Siguiente paso
            </p>
            <h2 className="mt-4 text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Solicita una llamada de ajuste.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Cuéntanos qué tema educativo te interesa y cómo encaja el rango objetivo de{' '}
              {COHORT_PRICE_RANGE_LABEL} para la propuesta de 12 semanas. Esta información ayuda a
              conversar sobre el encaje sin solicitar datos clínicos.
            </p>
            <p className="mt-5 rounded-2xl border border-border bg-background/80 px-5 py-4 text-sm leading-6 text-muted-foreground">
              No incluyas diagnósticos, síntomas ni información médica. Si necesitas diagnóstico,
              tratamiento o atención individualizada, busca apoyo profesional externo.
            </p>
          </div>
          <div className="min-w-0 rounded-[2rem] border border-border bg-background p-5 shadow-lg shadow-primary/5 sm:p-8">
            <ContactForm source="la clase magistral a demanda" />
          </div>
        </div>
      </section>
    </main>
  );
}
