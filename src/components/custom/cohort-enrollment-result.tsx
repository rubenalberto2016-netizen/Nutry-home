// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import type { CohortEnrollmentState as EnrollmentState } from '@/lib/contracts/cohort';
import {
  CohortCheckoutCancellation,
  CohortEnrollmentState,
  CohortPaymentConfirmation,
} from '@/lib/contracts/cohort';

async function loadEnrollmentState(
  sessionId: string | null,
  requestId: string | null,
  cancelled: boolean,
) {
  if (sessionId) {
    return apiFetch('/api/subscriptions/confirm', {
      method: 'POST',
      body: JSON.stringify(CohortPaymentConfirmation.parse({ sessionId })),
      schema: CohortEnrollmentState,
    });
  }
  if (cancelled && requestId) {
    return apiFetch('/api/subscriptions/cancel-checkout', {
      method: 'POST',
      body: JSON.stringify(CohortCheckoutCancellation.parse({ requestId })),
      schema: CohortEnrollmentState,
    });
  }
  throw new Error('No se recibió un identificador de confirmación.');
}

const verificationError =
  'No pudimos verificar el estado de esta solicitud. El acceso permanece cerrado hasta confirmar el pago en el servidor.';

export function CohortEnrollmentResult({
  sessionId,
  requestId,
  cancelled,
}: {
  sessionId: string | null;
  requestId: string | null;
  cancelled: boolean;
}) {
  const [state, setState] = useState<EnrollmentState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    setChecking(true);
    setMessage(null);

    loadEnrollmentState(sessionId, requestId, cancelled)
      .then((result) => {
        if (active) setState(result);
      })
      .catch(() => {
        if (active) setMessage(verificationError);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId, requestId, cancelled]);

  async function retryVerification() {
    setChecking(true);
    setMessage(null);
    try {
      setState(await loadEnrollmentState(sessionId, requestId, cancelled));
    } catch {
      setMessage(verificationError);
    } finally {
      setChecking(false);
    }
  }

  const paymentLabel =
    state?.paymentStatus === 'confirmed'
      ? 'Confirmado'
      : state?.paymentStatus === 'pending'
        ? 'Pendiente'
        : state?.paymentStatus === 'unverifiable'
          ? 'No verificable todavía'
          : state?.paymentStatus === 'failed'
            ? 'Fallido'
            : state?.paymentStatus === 'cancelled'
              ? 'Cancelado'
              : 'Sin iniciar';
  const accessLabel =
    state?.accessStatus === 'enabled'
      ? 'Habilitado'
      : state?.accessStatus === 'expired'
        ? 'Finalizado'
        : 'Cerrado';

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
          Inscripción a la cohorte
        </p>
        <CardTitle className="font-display text-3xl">Estado de tu solicitud</CardTitle>
        <CardDescription>
          La solicitud y el pago se registran por separado. Volver desde el checkout no concede
          acceso.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {checking ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Verificando el pago con Polsia… El acceso sigue cerrado mientras se comprueba.
          </p>
        ) : null}

        {state ? (
          <div
            className="grid gap-3 rounded-xl border border-border p-4 text-sm"
            aria-live="polite"
          >
            <p>
              <strong>Solicitud:</strong>{' '}
              {state.requestStatus === 'received' ? 'Recibida' : 'No iniciada'}
            </p>
            <p>
              <strong>Pago:</strong> {paymentLabel}
            </p>
            <p>
              <strong>Acceso:</strong> {accessLabel}
            </p>
            <p className="border-t border-border pt-3 leading-6 text-muted-foreground">
              {state.message}
            </p>
          </div>
        ) : null}

        {message ? (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {message}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {state?.accessStatus === 'enabled' ? (
            <Button asChild>
              <Link href="/dashboard/programa">Entrar al espacio privado</Link>
            </Button>
          ) : null}
          {!checking && sessionId && state?.paymentStatus !== 'confirmed' ? (
            <Button type="button" variant="outline" onClick={retryVerification}>
              Volver a comprobar
            </Button>
          ) : null}
          {!sessionId ||
          state?.paymentStatus === 'cancelled' ||
          state?.paymentStatus === 'failed' ? (
            <Button asChild variant={state?.accessStatus === 'enabled' ? 'outline' : 'default'}>
              <Link href="/pricing">Ver inscripción</Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
