import { Hono } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { clientKey, createRateLimiter } from '../lib/rate-limit';

/**
 * POST /api/waitlist — first-party launch-invite signup. Public: no account,
 * no Clerk, CORS from the /api/* middleware in app.ts. It stores an address
 * for launch news and nothing else (no IP, no user agent), never echoes it,
 * and answers a repeat, a honeypot hit and a first signup identically, so the
 * reply cannot be used to probe who is on the list. Nothing is sent from here.
 * There is deliberately no read route; the owner exports with wrangler
 * (docs/launch/waitlist.md). No log line is written, so no address reaches logs.
 */
export const waitlistRoutes = new Hono();

/** Names the consent line the visitor saw; bump it when that wording changes. Mirrors apps/web WaitlistForm. */
export const CONSENT_TEXT_VERSION = 'launch-news-v1';

export const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const MAX_BODY_BYTES = 2048;

/**
 * Per client key, per isolate (lib/rate-limit, the limiter /api/recovery/claim
 * uses). Not durable across isolates, so it blunts a script hammering one
 * edge location rather than a distributed one; a D1 counter can replace it
 * later without changing this route. Every request counts, valid or not.
 */
export const WAITLIST_LIMIT = 10;
export const WAITLIST_WINDOW_MS = 60 * 60 * 1000;
export const waitlistLimiter = createRateLimiter(WAITLIST_LIMIT, WAITLIST_WINDOW_MS);

// Deliberately narrower than RFC 5322: ASCII only, a conservative local part that cannot start
// with = + - @ (spreadsheet formula characters, since the owner exports a CSV), no quotes or comments.
const LOCAL = /^[a-z0-9][a-z0-9._%+'-]*$/;
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const TLD = /^([a-z]{2,24}|xn--[a-z0-9-]{2,20})$/;

/** Trimmed, lower-cased address, or null when it is not a plausible one. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts as [string, string];
  if (local.length > MAX_LOCAL_LENGTH || !LOCAL.test(local) || local.endsWith('.') || local.includes('..')) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((l) => l.length === 0 || l.length > 63 || !LABEL.test(l))) return null;
  return TLD.test(labels[labels.length - 1] as string) ? email : null;
}

const SOURCE = /^[a-z0-9_-]{1,32}$/;
const LOCALES: ReadonlySet<string> = new Set(['en', 'ko', 'es']);

const cleanSource = (raw: unknown): string | null => (typeof raw === 'string' && SOURCE.test(raw) ? raw : null);
const cleanLocale = (raw: unknown): string | null => (typeof raw === 'string' && LOCALES.has(raw) ? raw : null);

/** The one success body: the same for a new address, a repeat and a honeypot hit. */
function subscribed(c: Parameters<typeof ok>[0]): Response {
  c.header('Cache-Control', 'no-store');
  return ok(c, { subscribed: true });
}

waitlistRoutes.post('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  const decision = waitlistLimiter.check(clientKey((n) => c.req.header(n)));
  if (!decision.allowed) {
    c.header('Retry-After', String(decision.retryAfterSeconds));
    return fail(c, 'too_many_requests', 'Too many attempts — try again later', 429, { retryAfterSeconds: decision.retryAfterSeconds });
  }

  const declared = Number(c.req.header('content-length') ?? 0);
  const text = declared > MAX_BODY_BYTES ? null : await c.req.text().catch(() => '');
  if (text === null || text.length > MAX_BODY_BYTES) return fail(c, 'payload_too_large', 'Request body is too large', 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(c, 'bad_request', 'Body must be JSON', 400);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fail(c, 'bad_request', 'Body must be a JSON object', 400);
  const body = parsed as Record<string, unknown>;

  // Honeypot: a person never sees `website`. Anything in it is a script, which gets the normal
  // answer and no row — before any validation, so a bot learns nothing from an error either.
  if (body.website !== undefined && body.website !== '') return subscribed(c);

  const email = normaliseEmail(body.email);
  if (!email) return fail(c, 'invalid_email', 'Please enter a valid email address', 422);

  await dbFor(c).addWaitlist({
    email,
    createdAt: new Date().toISOString(),
    source: cleanSource(body.source),
    locale: cleanLocale(body.locale),
    consentTextVersion: CONSENT_TEXT_VERSION,
  });
  return subscribed(c);
});
