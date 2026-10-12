// @polsia:user-owned
export type StoredSubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'SUSPENDED'
  | 'EXPIRED';

export type WorkspaceSubscriptionState = {
  status: string;
  paidThrough: Date | null;
};

export function subscriptionHasAccess(
  subscription: WorkspaceSubscriptionState | null | undefined,
  now = new Date(),
): boolean {
  if (!subscription || !['ACTIVE', 'CANCELLED'].includes(subscription.status)) return false;
  return subscription.paidThrough !== null && subscription.paidThrough.getTime() > now.getTime();
}

export function publicSubscriptionStatus(
  subscription: WorkspaceSubscriptionState | null | undefined,
  now = new Date(),
): 'none' | 'pending' | 'active' | 'cancelled' | 'payment_failed' | 'suspended' | 'expired' {
  if (!subscription) return 'none';
  if (subscription.status === 'PAYMENT_FAILED') return 'payment_failed';
  if (subscription.status === 'SUSPENDED') return 'suspended';
  if (subscription.status === 'PENDING') return 'pending';
  if (subscription.status === 'EXPIRED') return 'expired';
  if (subscription.status === 'ACTIVE' && !subscription.paidThrough) return 'pending';
  if (
    ['ACTIVE', 'CANCELLED'].includes(subscription.status) &&
    subscription.paidThrough &&
    subscription.paidThrough.getTime() <= now.getTime()
  ) {
    return 'expired';
  }
  if (subscription.status === 'CANCELLED') return 'cancelled';
  return 'active';
}

export function transitionSubscriptionEvent(
  current: WorkspaceSubscriptionState,
  eventType: string,
  paypalStatus: string,
  nextBillingTime: Date | null,
): WorkspaceSubscriptionState {
  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      if (paypalStatus === 'SUSPENDED')
        return { status: 'SUSPENDED', paidThrough: current.paidThrough };
      if (paypalStatus === 'CANCELLED') {
        return {
          status: 'CANCELLED',
          paidThrough:
            current.status === 'ACTIVE' || current.status === 'CANCELLED'
              ? current.paidThrough
              : null,
        };
      }
      return {
        status: 'ACTIVE',
        paidThrough:
          current.status === 'PAYMENT_FAILED' || current.status === 'SUSPENDED'
            ? null
            : current.paidThrough,
      };
    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      return { status: 'PAYMENT_FAILED', paidThrough: current.paidThrough };
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      return {
        status: 'CANCELLED',
        paidThrough:
          current.status === 'ACTIVE' || current.status === 'CANCELLED'
            ? current.paidThrough
            : null,
      };
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      return { status: 'SUSPENDED', paidThrough: current.paidThrough };
    case 'PAYMENT.SALE.COMPLETED':
      if (paypalStatus === 'ACTIVE')
        return { status: 'ACTIVE', paidThrough: nextBillingTime ?? current.paidThrough };
      if (paypalStatus === 'CANCELLED')
        return { status: 'CANCELLED', paidThrough: nextBillingTime ?? current.paidThrough };
      return { status: current.status, paidThrough: current.paidThrough };
    default:
      return current;
  }
}
