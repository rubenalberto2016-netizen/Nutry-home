// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import {
  CancellationResult,
  SubscriptionOverview,
  type SubscriptionOverview as SubscriptionOverviewData,
} from '@/lib/contracts/subscriptions';

function dateLabel(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(value));
}

function paymentLabel(status: SubscriptionOverviewData['paymentStatus']) {
  switch (status) {
    case 'not_started':
      return 'Sin iniciar';
    case 'pending':
      return 'Pendiente de confirmación';
    case 'unverifiable':
      return 'No verificable todavía';
    case 'failed':
      return 'Fallido';
    case 'cancelled':
      return 'Cancelado';
    case 'confirmed':
      return 'Confirmado';
  }
}

function accessLabel(status: SubscriptionOverviewData['accessStatus']) {
  if (status === 'enabled') return 'Habilitado';
  if (status === 'expired') return 'Finalizado';
  return 'Cerrado';
}

function statusDescription(overview: SubscriptionOverviewData | null) {
  if (!overview || overview.requestStatus === 'not_started') {
    return 'La solicitud se registra al iniciar el checkout. El acceso solo se habilita después de que Polsia verifique el pago.';
  }
  if (overview.paymentStatus === 'pending') {
    return 'Solicitud recibida. Polsia todavía no confirma el pago y el acceso permanece cerrado.';
  }
  if (overview.paymentStatus === 'unverifiable') {
    return 'Solicitud recibida. El pago no se pudo verificar todavía y el acceso permanece cerrado.';
  }
  if (overview.paymentStatus === 'failed') {
    return 'Solicitud recibida, pero el pago falló o no coincidió con el total. El acceso permanece cerrado.';
  }
  if (overview.paymentStatus === 'not_started') {
    return 'Solicitud recibida. El checkout no llegó a iniciar el pago y el acceso permanece cerrado; puedes volver a intentarlo.';
  }
  if (overview.paymentStatus === 'cancelled') {
    return 'Solicitud recibida; el checkout se canceló y el acceso permanece cerrado.';
  }
  if (overview.accessStatus === 'enabled') {
    return 'Pago confirmado. El espacio privado del programa está habilitado.';
  }
  if (overview.accessStatus === 'expired') {
    return 'El pago se confirmó, pero el período de acceso de 12 semanas terminó.';
  }
  return 'El pago fue confirmado. El espacio todavía no está habilitado; vuelve a comprobar el estado.';
}

export function WorkspaceSubscriptionPanel() {
  const [overview, setOverview] = useState<SubscriptionOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const value = await apiFetch('/api/subscriptions', { schema: SubscriptionOverview });
    setOverview(value);
    setError(null);
  }

  useEffect(() => {
    let active = true;
    apiFetch('/api/subscriptions', { schema: SubscriptionOverview })
      .then((value) => {
        if (active) setOverview(value);
      })
      .catch(() => {
        if (active) setError('No pudimos consultar el estado de la inscripción.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function cancelRenewal() {
    setCanceling(true);
    try {
      await apiFetch('/api/subscriptions/cancel', {
        method: 'POST',
        schema: CancellationResult,
      });
      await refresh();
      toast.success('La renovación se canceló.');
    } catch {
      toast.error('No se pudo cancelar la renovación. Inténtalo de nuevo.');
    } finally {
      setCanceling(false);
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            Solicitud · pago · acceso
          </p>
          <CardTitle className="mt-2 font-display text-2xl">Estado de la cohorte</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">
            {loading ? 'Consultando el estado…' : (error ?? statusDescription(overview))}
          </CardDescription>
        </div>
        {overview?.canCancel ? (
          <Button type="button" variant="outline" disabled={canceling} onClick={cancelRenewal}>
            {canceling ? 'Cancelando…' : 'Cancelar renovación'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 border-t border-border/70 pt-4 text-sm text-muted-foreground">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide">Solicitud</dt>
            <dd className="mt-1 font-medium text-foreground">
              {overview?.requestStatus === 'received' ? 'Recibida' : 'No iniciada'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Pago</dt>
            <dd className="mt-1 font-medium text-foreground">
              {paymentLabel(overview?.paymentStatus ?? 'not_started')}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Acceso</dt>
            <dd className="mt-1 font-medium text-foreground">
              {accessLabel(overview?.accessStatus ?? 'closed')}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p>{overview?.workspaceName ?? 'Espacio privado de la cohorte'}</p>
            {overview?.paidThrough ? (
              <p className="mt-1">Acceso hasta {dateLabel(overview.paidThrough)}.</p>
            ) : null}
            {overview?.role === 'MEMBER' ? (
              <p className="mt-1">La persona propietaria gestiona la inscripción y el pago.</p>
            ) : null}
          </div>
          {overview?.isOwner && overview.accessStatus !== 'enabled' ? (
            <Button asChild variant="outline">
              <Link href="/pricing">
                {overview.requestStatus === 'received'
                  ? 'Continuar inscripción'
                  : 'Ver términos y precio'}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
