// @polsia:user-owned
'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { isCohortPrice } from '@/lib/business/cohort-offer';
import { CohortOffer, CohortPriceUpdate } from '@/lib/contracts/cohort';

export function CohortOfferEditor() {
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/cohort/offer', { schema: CohortOffer })
      .then((offer) => {
        if (active) setPrice(String(offer.totalUsd));
      })
      .catch(() => {
        if (active) setLoadError('No se pudo consultar el precio actual.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const totalUsd = Number(price);
    if (!isCohortPrice(totalUsd)) {
      toast.error('El precio debe ser un entero entre US$1.500 y US$2.500.');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch('/api/cohort/offer', {
        method: 'PATCH',
        body: JSON.stringify(CohortPriceUpdate.parse({ totalUsd })),
        schema: CohortOffer,
      });
      setPrice(String(updated.totalUsd));
      toast.success('Precio de cohorte actualizado.');
    } catch {
      toast.error('No se pudo guardar el precio. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">
          Oferta · pago único
        </p>
        <CardTitle>Precio de la cohorte</CardTitle>
        <CardDescription>
          Este total se muestra en la página de inscripción y se usa en el checkout integrado de
          Polsia. El acceso se concede tras verificar el mismo importe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={savePrice} className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cohort-total-usd">Total en dólares estadounidenses</Label>
            <Input
              id="cohort-total-usd"
              type="number"
              min={1500}
              max={2500}
              step={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={loading || saving}
              aria-describedby="cohort-price-range"
            />
            <p id="cohort-price-range" className="text-xs text-muted-foreground">
              Elige un total entero entre US$1.500 y US$2.500. El cobro no es recurrente ni admite
              cuotas.
            </p>
          </div>
          {loadError ? (
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
          ) : null}
          <Button type="submit" disabled={loading || saving || !isCohortPrice(Number(price))}>
            {loading ? 'Cargando precio…' : saving ? 'Guardando…' : 'Guardar precio'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
