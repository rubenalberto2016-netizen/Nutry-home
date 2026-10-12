// @polsia:user-owned
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function EmailVerification({
  email,
  callbackURL = '/dashboard',
}: {
  email: string;
  callbackURL?: string;
}) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function resend() {
    setPending(true);
    setSent(false);
    setFailed(false);
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL });
      if (result.error) setFailed(true);
      else setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Verifica tu correo electrónico</h2>
      <p className="text-sm text-muted-foreground">
        Confirma {email} con el enlace de verificación. Si no recibiste el correo, puedes pedir otro
        aquí.
      </p>
      {sent ? <output>Revisa tu bandeja de entrada para abrir el enlace.</output> : null}
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          No pudimos enviar el correo de verificación. Inténtalo de nuevo en unos minutos.
        </p>
      ) : null}
      <Button type="button" onClick={resend} disabled={pending}>
        {pending ? 'Enviando…' : 'Reenviar correo de verificación'}
      </Button>
    </div>
  );
}
