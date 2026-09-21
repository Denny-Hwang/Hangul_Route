import type { BillingInterval, EntitlementApply, EntitlementStatus, PlanKey } from '@hangul-route/content-schema';

/**
 * Stripe without the SDK — F-ENT-001 §3.3. Webhook signatures are HMAC-SHA256
 * over `t.body`; Checkout and Portal sessions are plain form posts.
 */
export interface StripeEnv {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_FAMILY_PREMIUM_MONTHLY?: string;
  STRIPE_PRICE_FAMILY_PREMIUM_YEARLY?: string;
  STRIPE_PRICE_TEACHER_PRO_MONTHLY?: string;
  STRIPE_PRICE_TEACHER_PRO_YEARLY?: string;
  STRIPE_PRICE_SCHOOL_LICENSE_MONTHLY?: string;
  STRIPE_PRICE_SCHOOL_LICENSE_YEARLY?: string;
}

export const SIGNATURE_TOLERANCE_SEC = 300;

export function parseStripeSignature(header: string | undefined | null): { t: number; v1: string[] } | null {
  if (!header) return null;
  let t = Number.NaN;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k?.trim() === 't' && v) t = Number(v.trim());
    if (k?.trim() === 'v1' && v) v1.push(v.trim());
  }
  return Number.isFinite(t) && v1.length > 0 ? { t, v1 } : null;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Build the header Stripe would send (tests, local tooling). */
export async function signStripePayload(secret: string, body: string, timestampSec: number): Promise<string> {
  return `t=${timestampSec},v1=${await hmacSha256Hex(secret, `${timestampSec}.${body}`)}`;
}

export async function verifyStripeSignature(header: string | undefined | null, body: string, secret: string, nowMs = Date.now()): Promise<boolean> {
  const parsed = parseStripeSignature(header);
  if (!parsed) return false;
  if (Math.abs(nowMs / 1000 - parsed.t) > SIGNATURE_TOLERANCE_SEC) return false;
  const expected = await hmacSha256Hex(secret, `${parsed.t}.${body}`);
  return parsed.v1.some((sig) => constantTimeEquals(sig, expected));
}

export function mapStripeStatus(status: unknown): EntitlementStatus | null {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'cancelled';
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'expired';
    default:
      return null;
  }
}

export interface StripeEventLike {
  type: string;
  data: { object: Record<string, unknown> };
}

function subjectFrom(meta: unknown): Pick<EntitlementApply, 'subjectKind' | 'subjectId' | 'planKey'> | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const kind = m.subjectKind === 'account' || m.subjectKind === 'space' ? m.subjectKind : null;
  const planKey = m.planKey === 'family_premium' || m.planKey === 'teacher_pro' || m.planKey === 'school_license' || m.planKey === 'school_seat' ? m.planKey : null;
  return kind && planKey && typeof m.subjectId === 'string' ? { subjectKind: kind, subjectId: m.subjectId, planKey } : null;
}

function isoFromUnix(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

/** What an event means for the table, or null when it is not ours. */
export function entitlementFromStripeEvent(event: StripeEventLike): EntitlementApply | null {
  const obj = event.data.object;
  const subject = subjectFrom(obj.metadata);
  if (!subject) return null;
  if (event.type === 'checkout.session.completed') {
    return {
      ...subject,
      status: 'active',
      provider: 'stripe',
      providerRef: typeof obj.subscription === 'string' ? obj.subscription : typeof obj.id === 'string' ? obj.id : null,
      customerRef: typeof obj.customer === 'string' ? obj.customer : null,
      expiresAt: null,
    };
  }
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const status = event.type === 'customer.subscription.deleted' ? 'expired' : mapStripeStatus(obj.status);
    if (!status) return null;
    return {
      ...subject,
      status,
      provider: 'stripe',
      providerRef: typeof obj.id === 'string' ? obj.id : null,
      customerRef: typeof obj.customer === 'string' ? obj.customer : null,
      expiresAt: isoFromUnix(obj.current_period_end),
    };
  }
  return null;
}

export function priceIdFor(env: StripeEnv, planKey: Exclude<PlanKey, 'school_seat'>, interval: BillingInterval): string | null {
  const key = `STRIPE_PRICE_${planKey.toUpperCase()}_${interval.toUpperCase()}` as keyof StripeEnv;
  return env[key] ?? null;
}

export interface StripeSessionResult {
  ok: boolean;
  url: string | null;
  status: number;
}

async function stripePost(env: StripeEnv, path: string, form: Record<string, string>, fetchImpl: typeof fetch): Promise<StripeSessionResult> {
  try {
    const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY ?? ''}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    const body = (await res.json().catch(() => ({}))) as { url?: unknown };
    return { ok: res.ok, url: typeof body.url === 'string' ? body.url : null, status: res.status };
  } catch {
    return { ok: false, url: null, status: -1 };
  }
}

export function checkoutForm(input: { priceId: string; subjectKind: string; subjectId: string; planKey: string; successUrl: string; cancelUrl: string; customerEmail?: string | null }): Record<string, string> {
  const form: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': input.priceId,
    'line_items[0][quantity]': '1',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    'metadata[subjectKind]': input.subjectKind,
    'metadata[subjectId]': input.subjectId,
    'metadata[planKey]': input.planKey,
    'subscription_data[metadata][subjectKind]': input.subjectKind,
    'subscription_data[metadata][subjectId]': input.subjectId,
    'subscription_data[metadata][planKey]': input.planKey,
  };
  if (input.customerEmail) form.customer_email = input.customerEmail;
  return form;
}

export function createCheckoutSession(env: StripeEnv, form: Record<string, string>, fetchImpl: typeof fetch = globalThis.fetch): Promise<StripeSessionResult> {
  return stripePost(env, 'checkout/sessions', form, fetchImpl);
}

export function createPortalSession(env: StripeEnv, customer: string, returnUrl: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<StripeSessionResult> {
  return stripePost(env, 'billing_portal/sessions', { customer, return_url: returnUrl }, fetchImpl);
}
