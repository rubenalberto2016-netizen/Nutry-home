// @polsia:user-owned — seeded by polsia/modules/better-auth; restyle freely.
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';

export function AuthNav() {
  const { data: session, isPending } = useSession();

  // Render nothing until the session resolves — avoids a Sign-in→Profile flash.
  if (isPending) return null;

  if (!session?.user) {
    return (
      <nav aria-label="Acceso a la cuenta" className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </nav>
    );
  }

  return null;
}
