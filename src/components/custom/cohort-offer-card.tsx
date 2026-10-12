// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import { CohortCheckoutRequest, CohortOffer } from '@/lib/contracts/cohort';
import {
  CheckoutUrl,
  type SubscriptionOverview as Overview,
  SubscriptionOverview,
} from '@/lib/contracts/subscriptions';

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && typeof error.cause === 'object' && error.cause !== null) {
    const body = error.cause as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  }
  return 'No se pudo iniciar el checkout integrado. Inténtalo de nuevo.';
}

export function CohortOfferCard() {
  const { data: session, isPending: sessionPending } = useSession();
  const [offer, setOffer] = useState<ReturnType<typeof CohortOffer.parse> | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/cohort/offer', { schema: CohortOffer })
      .then((value) => {
        if (active) setOffer(value);
      })
      .catch(() => {
        if (active) setOfferError('No se pudo consultar el precio vigente.');
      })
      .finally(() => {
        if (active) setOfferLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      setOverview(null);
      setOverviewLoading(false);
      return;
    }
    let active = true;
    setOverviewLoading(true);
    setOverviewError(null);
    apiFetch('/api/subscriptions', { schema: SubscriptionOverview })
      .then((value) => {
        if (active) setOverview(value);
      })
      .catch(() => {
        if (active) setOverviewError('No se pudo consultar tu solicitud y el estado del acceso.');
      })
      .finally(() => {
        if (active) setOverviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionPending, session?.user]);

  async function startCheckout() {
    const displayedTotalUsd =
      overview &&
      ['pending', 'unverifiable'].includes(overview.paymentStatus) &&
      overview.checkoutTotalUsd !== null
        ? overview.checkoutTotalUsd
        : offer?.totalUsd;
    if (displayedTotalUsd === undefined || displayedTotalUsd === null) return;
    setSubmitting(true);
    try {
      const { url } = await apiFetch('/api/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify(CohortCheckoutRequest.parse({ displayedTotalUsd })),
        schema: CheckoutUrl,
      });
      window.location.assign(url);
    } catch (error) {
      toast.error(errorMessage(error));
      apiFetch('/api/cohort/offer', { schema: CohortOffer })
        .then(setOffer)
        .catch(() => undefined);
      apiFetch('/api/subscriptions', { schema: SubscriptionOverview })
        .then(setOverview)
        .catch(() => undefined);
      setSubmitting(false);
    }
  }

  const savedCheckoutTotal =
    overview && ['pending', 'unverifiable'].includes(overview.paymentStatus)
      ? overview.checkoutTotalUsd
      : null;
  const hasExistingCheckout = savedCheckoutTotal !== null;
  const displayedTotalUsd = savedCheckoutTotal ?? offer?.totalUsd;

  const statusLabel =
    overview?.paymentStatus === 'pending'
      ? 'Pago pendiente de confirmación'
      : overview?.paymentStatus === 'unverifiable'
        ? 'Pago aún no verificable'
        : overview?.paymentStatus === 'failed'
          ? 'Pago fallido'
          : overview?.paymentStatus === 'cancelled'
            ? 'Checkout cancelado'
            : overview?.paymentStatus === 'confirmed'
              ? 'Pago confirmado'
              : null;

  return (
    <Card className="mx-auto w-full max-w-4xl border-primary/20 shadow-lg shadow-primary/5">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
            Cohorte educativa · 12 semanas
          </p>
          <CardTitle className="font-display text-2xl sm:text-3xl">Inscripción y pago</CardTitle>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Precio total propuesto, editable por administración dentro del rango autorizado.
          </p>
        </div>
        <div className="grid gap-1 sm:justify-items-end sm:text-right">
          {offerLoading ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Consultando el precio…
            </p>
          ) : displayedTotalUsd !== undefined ? (
            <>
              <p className="font-display text-4xl font-medium tracking-tight text-foreground">
                {formatUsd(displayedTotalUsd)}
              </p>
              <p className="text-sm font-medium text-primary">Total · un solo cobro</p>
              {hasExistingCheckout ? (
                <p className="max-w-56 text-xs leading-5 text-muted-foreground sm:text-right">
                  Importe conservado en tu solicitud de pago pendiente.
                </p>
              ) : null}
            </>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              {offerError ?? 'Precio no disponible.'}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 border-y border-border/70 py-5 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">Términos de la inscripción</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Acceso al espacio privado durante 12 semanas desde la confirmación del pago.</li>
              <li>El precio es el total en USD y se cobra una sola vez.</li>
              <li>No hay cobros recurrentes ni pagos en cuotas para esta oferta.</li>
              <li>
                La solicitud se recibe al iniciar el checkout; el acceso solo se habilita después de
                verificar el pago en el servidor.
              </li>
            </ul>
          </div>
          <div className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
            <h2 className="font-semibold text-foreground">Alcance y calendario</h2>
            <p className="mt-2">
              Programa educativo de salud digestiva, alimentación y regulación emocional. No es
              atención clínica ni sustituye la orientación de profesionales habilitados.
            </p>
            <p className="mt-2">
              La fecha de inicio y la agenda de encuentros están pendientes de confirmación.
            </p>
          </div>
        </div>

        {overview?.requestStatus === 'received' ? (
          <div className="rounded-lg border border-border px-4 py-3 text-sm" aria-live="polite">
            <p>
              <strong>Solicitud:</strong> recibida
            </p>
            <p className="mt-1">
              <strong>Pago:</strong> {statusLabel ?? 'sin iniciar'}
            </p>
            <p className="mt-1">
              <strong>Acceso:</strong>{' '}
              {overview.accessStatus === 'enabled'
                ? 'habilitado'
                : overview.accessStatus === 'expired'
                  ? 'finalizado'
                  : 'cerrado'}
            </p>
          </div>
        ) : null}

        {offer && !sessionPending && !session?.user ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup">Crear cuenta para inscribirme</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/login">Ya tengo una cuenta</Link>
            </Button>
          </div>
        ) : null}

        {sessionPending || overviewLoading ? (
          <Button type="button" size="lg" disabled className="w-full sm:w-fit">
            Consultando la solicitud…
          </Button>
        ) : null}

        {overviewError ? (
          <p role="alert" className="text-sm text-destructive">
            {overviewError}
          </p>
        ) : null}

        {overview?.accessStatus === 'enabled' ? (
          <Button asChild size="lg" className="w-full sm:w-fit">
            <Link href="/dashboard/programa">Entrar al espacio privado</Link>
          </Button>
        ) : overview?.role === 'MEMBER' ? (
          <p className="text-sm leading-6 text-muted-foreground">
            La persona propietaria de este espacio debe completar la inscripción.
          </p>
        ) : session?.user && offer ? (
          <Button
            type="button"
            size="lg"
            disabled={submitting || overviewLoading || Boolean(overviewError)}
            onClick={startCheckout}
            className="w-full sm:w-fit"
          >
            {submitting
              ? 'Abriendo checkout…'
              : ['pending', 'unverifiable'].includes(overview?.paymentStatus ?? '')
                ? 'Continuar con el pago'
                : overview?.paymentStatus === 'cancelled'
                  ? 'Volver a iniciar el pago'
                  : overview?.paymentStatus === 'failed'
                    ? 'Intentar pagar de nuevo'
                    : 'Inscribirme y pagar'}
          </Button>
        ) : null}

        {displayedTotalUsd !== undefined ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Importe presentado y enviado al checkout: {formatUsd(displayedTotalUsd)} USD, en un
            único cobro. El servidor vuelve a contrastar el total confirmado antes de conceder
            acceso.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
