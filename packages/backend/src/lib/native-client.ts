import { NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE } from '@hangul-route/content-schema';
import type { Context, MiddlewareHandler } from 'hono';
import { fail } from '../envelope';
import { getAuthClaims } from './auth';

/**
 * F-AUTH-004 section 9.4 (row NS-1, defence in depth; Worker first, before any native client sends a request): the
 * native app (iOS and Android) signs grown-ups in and reads their account, and must never reach a money route
 * (App Review 3.1.1, Google Play Payments). Two Worker variables, each read on every request, so the owner changes them
 * in the dashboard in a minute without a deploy or an app build (`keep_vars = true`):
 *
 * - `NATIVE_MONEY_GUARD` (on): checkout, portal, promo, the receipts list and receipt links answer `403 not_in_app` to
 *   a native request, before the account upsert, step-up, the live guard or any Stripe call. Only `false`, `0`, `off`
 *   or `disabled` (trimmed, any case) turns the refusals off; anything else, a typo included, keeps them (fail closed).
 *   It never turns off the billing status view (`routes/billing.ts`).
 * - `NATIVE_ACCOUNT` (on): the kill switch of the native homes. Off, every account route answers a request carrying
 *   the native header with `403 native_off`, so installed builds lose the homes at once. Unset, empty, `enabled`, `on`,
 *   `true` or `1` (trimmed, any case) is on; any other value, a typo included, is off (fail closed, the
 *   `TELEMETRY_DAILY` pattern). The web never sends the header and is untouched either way.
 *
 * A native request is one that carries `X-HR-Client: native` (the app's own statement, never an authentication), or,
 * for the money routes and the billing view, one whose bearer is a verified Clerk token naming no site (`azp`): a
 * browser always gets one with `azp` (assumption U8, device check D14), so the rule catches a native call that forgot
 * the header. The dev fallback has no token to read, so there only the header counts.
 */
export interface NativeClientEnv {
  /** Dashboard text variable; unset = on. `false`, `0`, `off` or `disabled` lets native requests reach the money routes. */
  NATIVE_MONEY_GUARD?: string;
  /** Dashboard text variable; unset = on. Any value but `enabled`, `on`, `true` or `1` refuses native account requests. */
  NATIVE_ACCOUNT?: string;
}

const GUARD_OFF_WORDS: ReadonlySet<string> = new Set(['false', '0', 'off', 'disabled']);
const ACCOUNT_ON_WORDS: ReadonlySet<string> = new Set(['', 'enabled', 'on', 'true', '1']);

/** Whether the money routes refuse native requests: on unless the variable is one of the off words. */
export function nativeMoneyGuardEnabled(env: NativeClientEnv | undefined): boolean {
  const value = env?.NATIVE_MONEY_GUARD;
  return typeof value !== 'string' || !GUARD_OFF_WORDS.has(value.trim().toLowerCase());
}

/** Whether the account routes serve native requests: on when unset or one of the on words; any other value is off. */
export function nativeAccountEnabled(env: NativeClientEnv | undefined): boolean {
  const value = env?.NATIVE_ACCOUNT;
  return typeof value !== 'string' || ACCOUNT_ON_WORDS.has(value.trim().toLowerCase());
}

const NATIVE_VALUE = NATIVE_CLIENT_VALUE.toLowerCase();

/** Whether the request carries `X-HR-Client: native` (any case; a combined header counts when one of its values is `native`). */
export function hasNativeHeader(c: Context): boolean {
  const raw = c.req.header(NATIVE_CLIENT_HEADER);
  if (typeof raw !== 'string') return false;
  return raw.split(',').some((part) => part.trim().toLowerCase() === NATIVE_VALUE);
}

/**
 * Whether the request comes from the native app: the header, or a verified Clerk token with no `azp`. Reads the
 * request's claims once (`getAuthClaims` caches them per request), and throws as it does on a deployment with no
 * Clerk key and no dev fallback (503, the same answer every account route gives there).
 */
export async function isNativeRequest(c: Context): Promise<boolean> {
  if (hasNativeHeader(c)) return true;
  const claims = await getAuthClaims(c);
  return claims !== null && claims.verified && claims.azp === null;
}

/**
 * The money-route guard: `403 not_in_app` for a native request while `NATIVE_MONEY_GUARD` is on, else null. Call it
 * first in every money route (checkout, portal, promo, receipts, receipt link), before `requireAccount`. The Stripe
 * webhook is never guarded.
 */
export async function nativeMoneyRefusal(c: Context): Promise<Response | null> {
  if (!nativeMoneyGuardEnabled(c.env as NativeClientEnv | undefined)) return null;
  if (!(await isNativeRequest(c))) return null;
  return fail(c, 'not_in_app', 'This is not available in the app', 403);
}

/**
 * The `NATIVE_ACCOUNT` switch as middleware for the account routes: off, a request carrying the native header gets
 * `403 native_off` before any route runs; anything else goes on unchanged. The header alone decides, so a browser
 * request is never read for a token here.
 */
export const nativeAccountSwitch: MiddlewareHandler = async (c, next) => {
  if (hasNativeHeader(c) && !nativeAccountEnabled(c.env as NativeClientEnv | undefined)) {
    return fail(c, 'native_off', 'Grown-up accounts are not available in the app right now', 403);
  }
  await next();
};
