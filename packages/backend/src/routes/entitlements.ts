import { CheckoutCreateSchema, PLAN_PRICING, PromoCheckSchema, discountedUsd, isStripeSubscriptionRef, type Entitlement, type Space } from '@hangul-route/content-schema';
import type { Account } from '../store';
import { Hono, type Context } from 'hono';
import { dbFor, type Db } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can } from '../lib/can';
import { isDuplicateCompletion, recordBillingHistory, stripeModeOf, type StripeWebhookEvent } from '../lib/billing-events';
import { accountBrowseScope, isEntitlementActive } from '../lib/entitlement';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { recordServerEvent } from '../lib/server-events';
import { checkoutForm, createCheckoutSession, createPortalSession, entitlementFromStripeEvent, freshStripeEvent, lookupPromotionCode, mergeForStripeEvent, priceIdFor, verifyStripeSignature, type StripeEnv } from '../lib/stripe';

/** Promo lookups are guessable strings: 20 per minute per client (F-ENT-002 §3.2). */
export const PROMO_LIMIT = 20;
export const promoLimiter = createRateLimiter(PROMO_LIMIT, 60_000);

/** Which spaces each product attaches to (F-ENT-001 §3.3). */
const PLAN_SPACE_KINDS: Record<'family_lifetime' | 'group_license', readonly Space['kind'][]> = { family_lifetime: ['family'], group_license: ['class', 'school'] };

/**
 * /api/entitlements — F-ENT-001 §3.3. Stripe and contracts land in
 * `store.applyEntitlement` (store receipts: not yet, see /verify); nothing
 * here talks to a child.
 */
type Env = { Bindings: StripeEnv & { CONSOLE_URL?: string } };
export const entitlementRoutes = new Hono<Env>();

let stripeFetch: typeof fetch | null = null;
/** Test seam: the fetch used for Stripe API calls. */
export function setStripeFetchForTests(f: typeof fetch | null): void {
  stripeFetch = f;
}

async function withSpaceName(db: Db, e: Entitlement): Promise<Entitlement & { subjectName: string | null }> {
  return { ...e, subjectName: e.subjectKind === 'space' ? ((await db.getSpace(e.subjectId))?.name ?? null) : null };
}

entitlementRoutes.get('/', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const db = dbFor(c);
  const rows = [...(await db.entitlementsFor('account', account.id))];
  for (const s of await db.spacesOwnedBy(account.id)) rows.push(...(await db.entitlementsFor('space', s.id)));
  const entitlements = [];
  for (const e of rows) entitlements.push(await withSpaceName(db, e));
  return ok(c, { entitlements });
});

/**
 * Which lessons the signed-in grown-up may preview in All lessons
 * (F-BROWSE-001 section 5.2): `{ scope: 'full' | 'sampler' }`. Reads
 * memberships, spaces and entitlements only; no write besides
 * `requireAccount`'s first-sign-in upsert.
 */
entitlementRoutes.get('/browse', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  return ok(c, { scope: await accountBrowseScope(dbFor(c), account.id, new Date()) });
});

async function ownedSpace(c: Context, db: Db, account: Account, spaceId: string, kinds: readonly Space['kind'][]): Promise<Response | Space> {
  const space = await db.getSpace(spaceId);
  if (!space) return fail(c, 'not_found', 'Space not found', 404);
  if (!kinds.includes(space.kind)) return fail(c, 'bad_request', `Expected a ${kinds.join(' or ')} space`, 422);
  if (!can(await accountActor(db, account), 'space.manage', { kind: 'space', ctx: await spaceContext(db, space) })) return fail(c, 'forbidden', 'Not your space', 403);
  return space;
}

/**
 * App Store / Play receipts (F-IAP-001/002). Nothing verifies them yet, so this
 * grants nothing: 501 until real store-server verification is wired (audit
 * SEC-1 — the old dev stub accepted any JSON blob as a family purchase).
 */
entitlementRoutes.post('/verify', (c) => fail(c, 'receipt_verification_not_configured', 'receipt verification not configured', 501));

entitlementRoutes.post('/stripe/checkout', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const parsed = CheckoutCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid checkout body', 422, { issues: parsed.error.issues });
  const { planKey, subjectKind, subjectId, promoCode } = parsed.data;
  const db = dbFor(c);
  const space = await ownedSpace(c, db, account, subjectId, PLAN_SPACE_KINDS[planKey]);
  if (!('id' in space)) return space;
  if (planKey === 'group_license' && space.kind === 'class' && space.parentSpaceId) {
    return fail(c, 'bad_request', 'A class inside a school is covered by the school licence', 422);
  }
  // A covering subscription of this plan already renews yearly: a second one would too (BY-D4).
  // A legacy one-time sandbox row or a contract row does not block moving to the yearly plan.
  const subscriptions = (await db.entitlementsFor('space', subjectId)).filter((e) => e.planKey === planKey && e.provider === 'stripe' && isStripeSubscriptionRef(e.providerRef));
  if (subscriptions.some((e) => isEntitlementActive(e, new Date()))) return fail(c, 'already_active', 'This plan is already active', 409);

  const env = c.env ?? {};
  const priceId = priceIdFor(env, planKey);
  if (!env.STRIPE_SECRET_KEY || !priceId) return fail(c, 'stripe_not_configured', 'Checkout is not set up on this deployment yet', 500);
  const fetchImpl = stripeFetch ?? globalThis.fetch;
  // A code typed in the console is checked again here so a stale or made-up one never reaches Stripe.
  const promo = promoCode ? await lookupPromotionCode(env, promoCode, fetchImpl) : null;
  if (promoCode && !promo) return fail(c, 'promo_invalid', 'That code cannot be used right now', 422);
  const base = (env.CONSOLE_URL ?? 'https://hangulroute.com').replace(/\/$/, '');
  const session = await createCheckoutSession(
    env,
    checkoutForm({ priceId, subjectKind, subjectId, planKey, successUrl: `${base}/teach/billing?checkout=success`, cancelUrl: `${base}/teach/billing?checkout=cancel`, customerEmail: account.email, customer: subscriptions.find((e) => e.customerRef)?.customerRef ?? null, promo }),
    fetchImpl,
  );
  if (!session.ok || !session.url) return fail(c, 'stripe_error', 'Stripe did not return a checkout link', 500, { status: session.status });
  return ok(c, { url: session.url });
});

/** Check a promotion / referral code before checkout — F-ENT-002 §3.2. Returns what it is worth on the chosen plan. */
entitlementRoutes.post('/stripe/promo', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const decision = promoLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) {
    c.header('Retry-After', String(decision.retryAfterSeconds));
    return fail(c, 'too_many_attempts', 'Too many code checks — try again in a minute', 429, { retryAfterSeconds: decision.retryAfterSeconds });
  }
  const parsed = PromoCheckSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'promo_invalid', 'That does not look like a code', 422);
  const env = c.env ?? {};
  if (!env.STRIPE_SECRET_KEY) return fail(c, 'stripe_not_configured', 'Codes are not set up on this deployment yet', 500);
  const promo = await lookupPromotionCode(env, parsed.data.code, stripeFetch ?? globalThis.fetch);
  if (!promo) return fail(c, 'promo_invalid', 'That code cannot be used right now', 404);
  const listUsd = PLAN_PRICING[parsed.data.planKey].amountUsd;
  return ok(c, { promo, price: { planKey: parsed.data.planKey, listUsd, discountedUsd: discountedUsd(listUsd, promo) } });
});

entitlementRoutes.post('/stripe/portal', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const body = (await c.req.json().catch(() => ({}))) as { subjectKind?: string; subjectId?: string };
  const subjectKind = body.subjectKind === 'space' ? 'space' : 'account';
  const subjectId = typeof body.subjectId === 'string' ? body.subjectId : account.id;
  if (subjectKind === 'account' && subjectId !== account.id) return fail(c, 'forbidden', 'Not your account', 403);
  const db = dbFor(c);
  if (subjectKind === 'space') {
    const space = await ownedSpace(c, db, account, subjectId, ['family', 'school', 'class']);
    if (!('id' in space)) return space;
  }
  // Any Stripe subscription can be managed: the Family Plan and the Group License both renew
  // yearly (BY-D6). A legacy one-time sandbox row (payment intent or session ref) has nothing to manage.
  const customer = (await db.entitlementsFor(subjectKind, subjectId)).find((e) => e.provider === 'stripe' && e.customerRef && isStripeSubscriptionRef(e.providerRef))?.customerRef;
  if (!customer) return fail(c, 'not_found', 'No Stripe subscription for this subject', 404);
  const env = c.env ?? {};
  if (!env.STRIPE_SECRET_KEY) return fail(c, 'stripe_not_configured', 'Billing portal is not set up on this deployment yet', 500);
  const base = (env.CONSOLE_URL ?? 'https://hangulroute.com').replace(/\/$/, '');
  const session = await createPortalSession(env, customer, `${base}/teach/billing`, stripeFetch ?? globalThis.fetch);
  if (!session.ok || !session.url) return fail(c, 'stripe_error', 'Stripe did not return a portal link', 500, { status: session.status });
  return ok(c, { url: session.url });
});

entitlementRoutes.post('/stripe/webhook', async (c) => {
  const env = c.env ?? {};
  if (!env.STRIPE_WEBHOOK_SECRET) return fail(c, 'stripe_not_configured', 'Webhook secret not bound', 500);
  const raw = await c.req.text();
  if (!(await verifyStripeSignature(c.req.header('stripe-signature'), raw, env.STRIPE_WEBHOOK_SECRET))) {
    return fail(c, 'bad_signature', 'Signature check failed', 400);
  }
  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(raw) as StripeWebhookEvent;
  } catch {
    return fail(c, 'bad_request', 'Body is not JSON', 400);
  }
  if (!event || typeof event.type !== 'string' || !event.data || typeof event.data.object !== 'object' || event.data.object === null) return fail(c, 'bad_request', 'Not a Stripe event', 400);
  const fetchImpl = stripeFetch ?? globalThis.fetch;
  const db = dbFor(c);
  const now = new Date();
  const mode = stripeModeOf(event);
  const current = await freshStripeEvent(env, event, fetchImpl);
  const apply = entitlementFromStripeEvent(current);
  let entitlement: Entitlement | null = null;
  let duplicate = false;
  if (apply) {
    // Checked before the completion lands: two checkouts paid in two tabs (F-BILL-002 §4.4).
    duplicate = event.type === 'checkout.session.completed' && (await isDuplicateCompletion(db, apply, now));
    entitlement = await db.applyEntitlement(apply, now, mergeForStripeEvent(current));
  }
  // Payment history (F-BILL-002 §5.4): recorded only; it never changes an entitlement (BY-D8).
  const history = await recordBillingHistory(db, env, event, fetchImpl, now);
  // A refund that cannot be matched yet: Stripe delivers it again rather than it being lost.
  if (history.outcome === 'retry') {
    return history.reason === 'lookup'
      ? fail(c, 'stripe_unavailable', 'Stripe could not be reached to match this refund; retry', 503)
      : fail(c, 'payment_not_recorded', 'The payment this refund belongs to is not recorded yet; retry', 503);
  }
  // Telemetry last, once everything above has succeeded, so a request that fails and is retried sends it once.
  if (apply && event.type === 'checkout.session.completed') recordServerEvent('billing.checkout_completed', { planKey: apply.planKey, mode, duplicate });
  if (history.outcome === 'recorded' && history.fresh) {
    if (history.event.kind === 'failed') recordServerEvent('billing.payment_failed', { planKey: history.event.planKey, mode });
    if (history.event.kind === 'refund') recordServerEvent('billing.refund_recorded', { planKey: history.event.planKey, full: history.full, mode });
  }
  const recorded = history.outcome === 'recorded' ? { recorded: true } : {};
  if (!entitlement) return ok(c, { received: true, applied: history.outcome === 'recorded', ...recorded });
  return ok(c, { received: true, applied: true, ...recorded, entitlement: await withSpaceName(db, entitlement) });
});
