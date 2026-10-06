import { CheckoutCreateSchema, PLAN_PRICING, PromoCheckSchema, ReceiptVerifySchema, discountedUsd, type Entitlement, type Space } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { can } from '../lib/can';
import { statusFromVerification, verifyReceiptStub } from '../lib/receipt';
import { clientKey, createRateLimiter } from '../lib/rate-limit';
import { checkoutForm, createCheckoutSession, createPortalSession, entitlementFromStripeEvent, lookupPromotionCode, priceIdFor, verifyStripeSignature, type StripeEnv, type StripeEventLike } from '../lib/stripe';

/** Promo lookups are guessable strings: 20 per minute per client (F-ENT-002 §3.2). */
export const PROMO_LIMIT = 20;
export const promoLimiter = createRateLimiter(PROMO_LIMIT, 60_000);

/** Which spaces each product attaches to (F-ENT-001 §3.3). */
const PLAN_SPACE_KINDS: Record<'family_lifetime' | 'group_license', readonly Space['kind'][]> = { family_lifetime: ['family'], group_license: ['class', 'school'] };
import { store } from '../store';

/**
 * /api/entitlements — F-ENT-001 §3.3. Receipts, Stripe and contracts all
 * land in `store.applyEntitlement`; nothing here talks to a child.
 */
type Env = { Bindings: StripeEnv & { CONSOLE_URL?: string } };
export const entitlementRoutes = new Hono<Env>();

let stripeFetch: typeof fetch | null = null;
/** Test seam: the fetch used for Stripe API calls. */
export function setStripeFetchForTests(f: typeof fetch | null): void {
  stripeFetch = f;
}

function withSpaceName(e: Entitlement): Entitlement & { subjectName: string | null } {
  return { ...e, subjectName: e.subjectKind === 'space' ? (store.spaces.get(e.subjectId)?.name ?? null) : null };
}

entitlementRoutes.get('/', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const ownedSpaces = [...store.spaces.values()].filter((s) => s.ownerAccountId === account.id);
  const entitlements = [...store.entitlementsFor('account', account.id), ...ownedSpaces.flatMap((s) => store.entitlementsFor('space', s.id))].map(withSpaceName);
  return ok(c, { entitlements });
});

function ownedSpace(c: Parameters<typeof requireAccount>[0], account: { id: string }, spaceId: string, kinds: readonly Space['kind'][]): Response | Space {
  const space = store.spaces.get(spaceId);
  if (!space) return fail(c, 'not_found', 'Space not found', 404);
  if (!kinds.includes(space.kind)) return fail(c, 'bad_request', `Expected a ${kinds.join(' or ')} space`, 422);
  if (!can(accountActor(account as never), 'space.manage', { kind: 'space', ctx: spaceContext(space) })) return fail(c, 'forbidden', 'Not your space', 403);
  return space;
}

entitlementRoutes.post('/verify', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const parsed = ReceiptVerifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid receipt body', 422, { issues: parsed.error.issues });
  const space = ownedSpace(c, account, parsed.data.spaceId, ['family']);
  if (!('id' in space)) return space;
  const result = verifyReceiptStub(parsed.data.store, parsed.data.receipt);
  if (!result.valid) return fail(c, 'receipt_invalid', 'Receipt could not be verified', 422);
  const now = new Date();
  const entitlement = store.applyEntitlement(
    { subjectKind: 'space', subjectId: space.id, planKey: 'family_lifetime', status: statusFromVerification(result, now) === 'active' ? 'active' : 'expired', provider: parsed.data.store, providerRef: null, expiresAt: result.expiresAt },
    now,
  );
  return ok(c, { entitlement: withSpaceName(entitlement) });
});

entitlementRoutes.post('/stripe/checkout', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const parsed = CheckoutCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid checkout body', 422, { issues: parsed.error.issues });
  const { planKey, subjectKind, subjectId, promoCode } = parsed.data;
  const space = ownedSpace(c, account, subjectId, PLAN_SPACE_KINDS[planKey]);
  if (!('id' in space)) return space;
  if (planKey === 'group_license' && space.kind === 'class' && space.parentSpaceId) {
    return fail(c, 'bad_request', 'A class inside a school is covered by the school licence', 422);
  }

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
    checkoutForm({ priceId, subjectKind, subjectId, planKey, successUrl: `${base}/teach/billing?checkout=success`, cancelUrl: `${base}/teach/billing?checkout=cancel`, customerEmail: account.email, promo }),
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
  if (subjectKind === 'space') {
    const space = ownedSpace(c, account, subjectId, ['family', 'school', 'class']);
    if (!('id' in space)) return space;
  }
  const customer = store.entitlementsFor(subjectKind, subjectId).find((e) => e.provider === 'stripe' && e.customerRef && e.planKey !== 'family_lifetime')?.customerRef;
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
  let event: StripeEventLike;
  try {
    event = JSON.parse(raw) as StripeEventLike;
  } catch {
    return fail(c, 'bad_request', 'Body is not JSON', 400);
  }
  if (!event || typeof event.type !== 'string' || !event.data || typeof event.data.object !== 'object') return fail(c, 'bad_request', 'Not a Stripe event', 400);
  const apply = entitlementFromStripeEvent(event);
  if (!apply) return ok(c, { received: true, applied: false });
  const entitlement = store.applyEntitlement(apply, new Date());
  return ok(c, { received: true, applied: true, entitlement: withSpaceName(entitlement) });
});
