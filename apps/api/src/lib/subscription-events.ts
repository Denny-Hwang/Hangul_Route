import type { Subscription } from '../store';

export type SubscriptionEvent = 'renewed' | 'recovered' | 'cancelled' | 'expired' | 'refunded';

export const SUBSCRIPTION_EVENTS: ReadonlyArray<SubscriptionEvent> = [
  'renewed',
  'recovered',
  'cancelled',
  'expired',
  'refunded',
];

/**
 * Pure: map a normalized store lifecycle event to the next subscription status.
 * `cancelled` means auto-renew is off but the row stays valid until expiry —
 * entitlement honors `expiresAt`, so access is not revoked here.
 */
export function nextStatusForEvent(event: SubscriptionEvent): Subscription['status'] {
  switch (event) {
    case 'renewed':
    case 'recovered':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
    case 'refunded':
      return 'expired';
  }
}
