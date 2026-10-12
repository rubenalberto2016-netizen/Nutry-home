// @polsia:user-owned
'use client';

import { UserPlus, UserRoundMinus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import {
  WorkspaceMemberList,
  type WorkspaceMemberList as WorkspaceMemberListData,
} from '@/lib/contracts/subscriptions';

export function WorkspaceMembers() {
  const [data, setData] = useState<WorkspaceMemberListData | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/workspace/members', { schema: WorkspaceMemberList })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('No pudimos cargar las cuentas del espacio.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setEmailError(null);
    try {
      const result = await apiFetch('/api/workspace/members', {
        method: 'POST',
        body: JSON.stringify({ email }),
        schema: WorkspaceMemberList,
      });
      setData(result);
      setEmail('');
      toast.success('La cuenta se añadió al equipo.');
    } catch (cause) {
      const errorBody = cause instanceof Error ? cause.cause : null;
      if (
        typeof errorBody === 'object' &&
        errorBody !== null &&
        'errors' in errorBody &&
        typeof errorBody.errors === 'object' &&
        errorBody.errors !== null &&
        'email' in errorBody.errors &&
        typeof errorBody.errors.email === 'string'
      ) {
        setEmailError(errorBody.errors.email);
        return;
      }
      const message =
        typeof errorBody === 'object' &&
        errorBody !== null &&
        'error' in errorBody &&
        typeof errorBody.error === 'string'
          ? errorBody.error
          : 'No se pudo añadir la cuenta.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(id: string) {
    try {
      const result = await apiFetch(`/api/workspace/members/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        schema: WorkspaceMemberList,
      });
      setData(result);
      toast.success('La cuenta se quitó del equipo.');
    } catch {
      toast.error('No se pudo quitar la cuenta del equipo.');
    }
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          Acceso al espacio
        </p>
        <CardTitle className="mt-2 font-display text-2xl">Personas del equipo</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          La persona propietaria puede añadir cuentas Vardelume existentes con correo verificado. No
          se envían invitaciones por correo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 border-t border-border/70 pt-5">
        {loading ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Cargando equipo…
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && !data?.workspaceId ? (
          <p className="text-sm leading-6 text-muted-foreground">
            El espacio se crea cuando la persona propietaria inicia el checkout. La aprobación de El
            regreso desde el checkout no habilita el acceso.
          </p>
        ) : null}
        {data?.workspaceId ? (
          <>
            <ul className="grid gap-2">
              {data.items.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 rounded-md border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.name ?? 'Cuenta Vardelume'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email ?? 'Correo no disponible'} ·{' '}
                      {member.role === 'OWNER' ? 'Propietario/a' : 'Miembro'}
                    </p>
                  </div>
                  {data.canManage && member.role === 'MEMBER' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeMember(member.id)}
                    >
                      <UserRoundMinus aria-hidden="true" />
                      Quitar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {data.canManage ? (
              <form
                className="grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                noValidate
                onSubmit={addMember}
              >
                <div className="grid gap-2">
                  <Label htmlFor="workspace-member-email">Correo de una cuenta verificada</Label>
                  <Input
                    id="workspace-member-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.currentTarget.value);
                      setEmailError(null);
                    }}
                    required
                    maxLength={320}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? 'workspace-member-email-error' : undefined}
                    placeholder="Correo de la cuenta Vardelume"
                  />
                  {emailError ? (
                    <p id="workspace-member-email-error" className="text-sm text-destructive">
                      {emailError}
                    </p>
                  ) : null}
                </div>
                <Button type="submit" disabled={saving}>
                  <UserPlus aria-hidden="true" />
                  {saving ? 'Añadiendo…' : 'Añadir cuenta'}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Solo la persona propietaria puede administrar las cuentas del equipo.
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
