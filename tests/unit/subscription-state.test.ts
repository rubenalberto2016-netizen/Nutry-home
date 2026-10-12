// @polsia:user-owned
import { describe, expect, it } from 'vitest';
import {
  publicSubscriptionStatus,
  subscriptionHasAccess,
  transitionSubscriptionEvent,
} from '@/lib/business/subscription-state';

describe('transiciones de suscripción del espacio', () => {
  const now = new Date('2026-10-02T12:00:00.000Z');
  const paidThrough = new Date('2026-11-02T12:00:00.000Z');

  it('no abre acceso por aprobar o activar una suscripción sin pago', () => {
    const activated = transitionSubscriptionEvent(
      { status: 'PENDING', paidThrough: null },
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'ACTIVE',
      paidThrough,
    );
    expect(activated).toEqual({ status: 'ACTIVE', paidThrough: null });
    expect(subscriptionHasAccess(activated, now)).toBe(false);
    expect(publicSubscriptionStatus(activated, now)).toBe('pending');
  });

  it('habilita el período reportado por PayPal y mantiene el mismo resultado al repetir el evento', () => {
    const initial = { status: 'PENDING', paidThrough: null };
    const first = transitionSubscriptionEvent(initial, 'PAYMENT.SALE.COMPLETED', 'ACTIVE', paidThrough);
    const repeated = transitionSubscriptionEvent(first, 'PAYMENT.SALE.COMPLETED', 'ACTIVE', paidThrough);
    expect(first).toEqual({ status: 'ACTIVE', paidThrough });
    expect(repeated).toEqual(first);
    expect(subscriptionHasAccess(first, now)).toBe(true);
  });

  it('cierra inmediatamente por fallo o suspensión', () => {
    const current = { status: 'ACTIVE', paidThrough };
    expect(
      transitionSubscriptionEvent(current, 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'ACTIVE', null).status,
    ).toBe('PAYMENT_FAILED');
    expect(
      transitionSubscriptionEvent(current, 'BILLING.SUBSCRIPTION.SUSPENDED', 'SUSPENDED', null).status,
    ).toBe('SUSPENDED');
  });

  it('conserva acceso cancelado solo hasta la fecha pagada reportada', () => {
    const cancelled = transitionSubscriptionEvent(
      { status: 'ACTIVE', paidThrough },
      'BILLING.SUBSCRIPTION.CANCELLED',
      'CANCELLED',
      new Date('2026-12-02T12:00:00.000Z'),
    );
    expect(subscriptionHasAccess(cancelled, now)).toBe(true);
    expect(subscriptionHasAccess(cancelled, paidThrough)).toBe(false);
    expect(publicSubscriptionStatus(cancelled, paidThrough)).toBe('expired');
  });

  it('una venta posterior confirmada puede restaurar el acceso', () => {
    const failed = { status: 'PAYMENT_FAILED', paidThrough };
    const restored = transitionSubscriptionEvent(failed, 'PAYMENT.SALE.COMPLETED', 'ACTIVE', paidThrough);
    expect(restored.status).toBe('ACTIVE');
    expect(subscriptionHasAccess(restored, now)).toBe(true);
  });

  it('activar o cancelar después de un fallo no restaura acceso sin otra venta', () => {
    const failed = { status: 'PAYMENT_FAILED', paidThrough };
    const activated = transitionSubscriptionEvent(failed, 'BILLING.SUBSCRIPTION.ACTIVATED', 'ACTIVE', paidThrough);
    const cancelled = transitionSubscriptionEvent(activated, 'BILLING.SUBSCRIPTION.CANCELLED', 'CANCELLED', paidThrough);
    expect(subscriptionHasAccess(activated, now)).toBe(false);
    expect(subscriptionHasAccess(cancelled, now)).toBe(false);
  });
});
