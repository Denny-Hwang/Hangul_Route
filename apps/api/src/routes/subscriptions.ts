import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { authorizeFamily } from '../lib/auth';
import { statusFromVerification, verifyReceiptStub } from '../lib/receipt';
import { SUBSCRIPTION_EVENTS, nextStatusForEvent, type SubscriptionEvent } from '../lib/subscription-events';
import { store, type Subscription } from '../store';

export const subscriptionRoutes = new Hono();

const STATUSES: ReadonlyArray<Subscription['status']> = [
  'none',
  'trial',
  'active',
  'expired',
  'cancelled',
];
const PLANS: ReadonlyArray<NonNullable<Subscription['plan']>> = ['monthly', 'yearly'];
const STORES: ReadonlyArray<NonNullable<Subscription['store']>> = ['apple', 'google'];

function defaultSubscription(familyId: string): Subscription {
  return {
    familyId,
    status: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    updatedAt: new Date().toISOString(),
  };
}

subscriptionRoutes.get('/:familyId', async (c) => {
  const familyId = c.req.param('familyId');
  const auth = await authorizeFamily(c, familyId);
  if (typeof auth !== 'string') return auth;
  const subscription = store.subscriptions.get(familyId) ?? defaultSubscription(familyId);
  return ok(c, { subscription });
});

subscriptionRoutes.put('/:familyId', async (c) => {
  const familyId = c.req.param('familyId');
  const auth = await authorizeFamily(c, familyId);
  if (typeof auth !== 'string') return auth;

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body === null || typeof body !== 'object') {
    return fail(c, 'bad_request', 'JSON body required', 422);
  }

  const { status } = body;
  if (typeof status !== 'string' || !STATUSES.includes(status as Subscription['status'])) {
    return fail(c, 'invalid_status', `status must be one of: ${STATUSES.join(', ')}`, 422);
  }

  const plan = body.plan ?? null;
  if (plan !== null && (typeof plan !== 'string' || !PLANS.includes(plan as NonNullable<Subscription['plan']>))) {
    return fail(c, 'invalid_plan', `plan must be one of: ${PLANS.join(', ')} or null`, 422);
  }

  const subStore = body.store ?? null;
  if (
    subStore !== null &&
    (typeof subStore !== 'string' || !STORES.includes(subStore as NonNullable<Subscription['store']>))
  ) {
    return fail(c, 'invalid_store', `store must be one of: ${STORES.join(', ')} or null`, 422);
  }

  const expiresAt = body.expiresAt ?? null;
  if (expiresAt !== null && typeof expiresAt !== 'string') {
    return fail(c, 'invalid_expires_at', 'expiresAt must be an ISO string or null', 422);
  }

  const subscription: Subscription = {
    familyId,
    status: status as Subscription['status'],
    plan: plan as Subscription['plan'],
    store: subStore as Subscription['store'],
    expiresAt: expiresAt as string | null,
    updatedAt: new Date().toISOString(),
  };
  store.subscriptions.set(familyId, subscription);
  return ok(c, { subscription });
});

subscriptionRoutes.post('/:familyId/verify', async (c) => {
  const familyId = c.req.param('familyId');
  const auth = await authorizeFamily(c, familyId);
  if (typeof auth !== 'string') return auth;

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body === null || typeof body !== 'object') {
    return fail(c, 'bad_request', 'JSON body required', 422);
  }

  const purchaseStore = body.store;
  if (purchaseStore !== 'apple' && purchaseStore !== 'google') {
    return fail(c, 'invalid_store', 'store must be apple or google', 422);
  }

  const receipt = body.receipt;
  if (typeof receipt !== 'string' || receipt.length === 0) {
    return fail(c, 'invalid_receipt', 'receipt must be a non-empty string', 422);
  }

  const result = verifyReceiptStub(purchaseStore, receipt);
  if (!result.valid) {
    return fail(c, 'receipt_invalid', 'Receipt could not be verified', 422);
  }

  const now = new Date();
  const subscription: Subscription = {
    familyId,
    status: statusFromVerification(result, now),
    plan: result.plan,
    store: result.store,
    expiresAt: result.expiresAt,
    updatedAt: now.toISOString(),
  };
  store.subscriptions.set(familyId, subscription);
  return ok(c, { subscription });
});

subscriptionRoutes.post('/:familyId/event', async (c) => {
  const familyId = c.req.param('familyId');
  const auth = await authorizeFamily(c, familyId);
  if (typeof auth !== 'string') return auth;

  const existing = store.subscriptions.get(familyId);
  if (!existing) {
    return fail(c, 'no_subscription', 'No subscription to update', 422);
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body === null || typeof body !== 'object') {
    return fail(c, 'bad_request', 'JSON body required', 422);
  }

  const event = body.event;
  if (typeof event !== 'string' || !SUBSCRIPTION_EVENTS.includes(event as SubscriptionEvent)) {
    return fail(c, 'invalid_event', `event must be one of: ${SUBSCRIPTION_EVENTS.join(', ')}`, 422);
  }

  const renews = event === 'renewed' || event === 'recovered';
  const expiresAt = renews && typeof body.expiresAt === 'string' ? body.expiresAt : existing.expiresAt;

  const subscription: Subscription = {
    ...existing,
    status: nextStatusForEvent(event as SubscriptionEvent),
    expiresAt,
    updatedAt: new Date().toISOString(),
  };
  store.subscriptions.set(familyId, subscription);
  return ok(c, { subscription });
});
