// @polsia:user-owned
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type PayPalPlanStatus,
  PayPalPlanStatusResponse,
} from '@/lib/contracts/paypal-plan-status';

function statusLabel(status: PayPalPlanStatus['status']) {
  if (status === 'matched') return 'Coincide';
  if (status === 'mismatch') return 'Discrepancia';
  return 'No verificable';
}

function statusStyle(status: PayPalPlanStatus['status']) {
  if (status === 'matched')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
  if (status === 'mismatch')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300';
  return 'border-border bg-muted text-muted-foreground';
}

function observedValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? 'No informado' : String(value);
}

export function PayPalPlanStatusPanel() {
  const [result, setResult] = useState<PayPalPlanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/paypal/plan-status?check=${refresh}`, { schema: PayPalPlanStatusResponse })
      .then((status) => {
        if (active) setResult(status);
      })
      .catch(() => {
        if (active) setResult(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const mode = result ? (result.mode === 'live' ? 'Live' : 'Sandbox') : 'Pendiente de consulta';
  const observed = result?.observed;
  const frequency =
    observed?.intervalCount === 1 && observed.intervalUnit === 'MONTH'
      ? 'Cada mes'
      : observed
        ? `${observedValue(observed.intervalCount)} ${observedValue(observed.intervalUnit)}`
        : 'No informado';

  return (
    <section
      aria-labelledby="paypal-plan-status-title"
      className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 id="paypal-plan-status-title" className="font-semibold text-card-foreground">
            Verificación del plan PayPal
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Consulta de solo lectura. No crea suscripciones ni confirma compras.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
            Modo: {mode}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Volver a comprobar
          </Button>
        </div>
      </div>

      {loading ? (
        <output className="text-sm text-muted-foreground">Consultando el plan configurado…</output>
      ) : result ? (
        <div aria-live="polite" className="grid gap-4">
          <div
            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(result.status)}`}
          >
            {statusLabel(result.status)}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{result.message}</p>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Importe esperado</dt>
              <dd className="mt-1 text-sm font-medium">
                US${result.expected.amount} {result.expected.currency} / mes
              </dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Estado remoto</dt>
              <dd className="mt-1 text-sm font-medium">{observedValue(observed?.planStatus)}</dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Importe remoto</dt>
              <dd className="mt-1 text-sm font-medium">
                {observed
                  ? `${observedValue(observed.amount)} ${observedValue(observed.currency)}`
                  : 'No informado'}
              </dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Frecuencia remota</dt>
              <dd className="mt-1 text-sm font-medium">{frequency}</dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Ciclos y prueba</dt>
              <dd className="mt-1 text-sm font-medium">
                {observed
                  ? `${observed.billingCycleCount} ciclo(s); ${observed.totalCycles === 0 ? 'renovación continua' : `límite: ${observedValue(observed.totalCycles)} ciclos`}; prueba ${observed.trialPresent ? 'detectada' : 'no detectada'}`
                  : 'No informado'}
              </dd>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <dt className="text-xs text-muted-foreground">Tarifa de alta remota</dt>
              <dd className="mt-1 text-sm font-medium">
                {observed?.setupFeeAmount === null
                  ? 'No declarada'
                  : observed
                    ? `${observedValue(observed.setupFeeAmount)} ${observedValue(observed.setupFeeCurrency)}`
                    : 'No informado'}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            ID de webhook en la configuración: {result.webhookIdConfigured ? 'presente' : 'ausente'}
            . La asociación de ese webhook con la aplicación Live debe confirmarse en la cuenta
            PayPal.
          </p>
        </div>
      ) : (
        <output className="text-sm leading-6 text-muted-foreground">
          No se pudo cargar el resultado. Verifica la sesión administrativa e inténtalo de nuevo.
        </output>
      )}
    </section>
  );
}
