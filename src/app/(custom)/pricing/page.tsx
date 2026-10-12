// @polsia:user-owned — condiciones y checkout de la cohorte.
import type { Metadata } from 'next';
import Link from 'next/link';
import { CohortOfferCard } from '@/components/custom/cohort-offer-card';
import { Button } from '@/components/ui/button';
import { COHORT_PRICE_RANGE_LABEL } from '@/lib/business/cohort-offer';
import { siteDescription, siteName, siteUrl } from '@/lib/site';
import { PricingJsonLd } from '@/modules/pricing-page/pricing-jsonld';

const pageDescription = `Términos de inscripción, precio total y pago de la cohorte educativa de 12 semanas de ${siteName}. ${siteDescription}`;

export const metadata: Metadata = {
  title: 'Inscripción a la cohorte de 12 semanas',
  description: pageDescription,
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: `Inscripción a la cohorte · ${siteName}`,
    description: pageDescription,
    url: '/pricing',
    type: 'website',
  },
};

export default function PricingPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-8 sm:py-20">
      <PricingJsonLd
        name="Cohorte educativa de 12 semanas"
        description="Inscripción de pago único a una propuesta educativa de 12 semanas."
        brand={siteName}
        url={`${siteUrl}/pricing`}
        currency="USD"
        offers={[]}
      />

      <header className="mx-auto grid max-w-3xl justify-items-center gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Condiciones de inscripción · USD
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-[-0.04em] text-foreground sm:text-6xl">
          Una cohorte educativa de 12 semanas.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Revisa el total, la frecuencia del cobro y las condiciones antes de iniciar el checkout.
        </p>
      </header>

      <CohortOfferCard />

      <section className="mx-auto grid max-w-4xl gap-3 border-t border-border/70 pt-5 text-center">
        <p className="text-xs leading-5 text-muted-foreground">
          El precio objetivo total está dentro del rango {COHORT_PRICE_RANGE_LABEL}; el importe
          vigente aparece arriba y puede cambiar dentro de ese rango. La inscripción y el acceso se
          vinculan a una cuenta personal.
        </p>
        <Button asChild variant="link" className="mx-auto w-fit">
          <Link href="/">Volver a {siteName}</Link>
        </Button>
      </section>
    </main>
  );
}
