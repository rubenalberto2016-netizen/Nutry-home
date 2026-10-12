// @polsia:user-owned
import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPayPalPlanStatus } from '@/lib/business/paypal';
import { PayPalPlanStatusResponse } from '@/lib/contracts/paypal-plan-status';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  const status = PayPalPlanStatusResponse.parse(await getPayPalPlanStatus());
  return NextResponse.json(status);
}
