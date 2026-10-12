import { HTTPException } from 'hono/http-exception';
import { failResponse } from '../envelope';
import { notesSendEnabled } from './notes-switch';
import { billingLiveAllowed, stripeMode } from './stripe';

/**
 * Deployment posture (audit SEC-2). The Worker fails closed: the dev
 * fallbacks — the bearer string taken as the account id (F-AUTH-001) and the
 * in-memory Db when no D1 binding is present (F-INFRA-003) — run only when a
 * deployment opts in with ENVIRONMENT=development|test or ALLOW_DEV_AUTH=true.
 * ENVIRONMENT unset means production, and ENVIRONMENT=production can never
 * opt in. Without the opt-in, a missing Clerk key or D1 binding answers 503.
 */
export interface RuntimeEnv {
  ENVIRONMENT?: string;
  ALLOW_DEV_AUTH?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  DB?: unknown;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** "true" opens live payments (F-BILL-002 section 4.9); unset = a live key is refused. */
  BILLING_LIVE_ALLOWED?: string;
  /** Optional Worker secret: keys the stored Rescue Code hash (HMAC) — SEC-5, see lib/rescue-hash. */
  RESCUE_PEPPER?: string;
  /** Browser origins allowed on /api/* (lib/cors), and the Clerk `authorizedParties` for sign-in tokens (F-APP-001 A-9). */
  ALLOWED_ORIGINS?: string;
  /** Dashboard text variable: `enabled` lets adults send notes (F-FEEDBACK-001 section 7.8); unset = off. */
  NOTES_SEND?: string;
}

const DEV_ENVIRONMENTS: ReadonlySet<string> = new Set(['development', 'test']);

/** What an env that does not decide gets. Off on the Worker; the vitest setup file turns it on. */
let undecidedDefault = false;

/** Tests only: the answer for requests whose env neither opts in nor names production. */
export function setDevFallbacksDefaultForTests(allowed: boolean): void {
  undecidedDefault = allowed;
}

function declaredEnvironment(env: RuntimeEnv | undefined): string {
  return typeof env?.ENVIRONMENT === 'string' ? env.ENVIRONMENT.trim().toLowerCase() : '';
}

/** The deployment's name, lower-cased; unset or blank is production. */
export function environmentName(env: RuntimeEnv | undefined): string {
  return declaredEnvironment(env) || 'production';
}

/** May this request use the dev fallbacks (bearer = user id, in-memory Db)? */
export function devFallbacksAllowed(env: RuntimeEnv | undefined): boolean {
  const declared = declaredEnvironment(env);
  if (declared === 'production') return false;
  if (DEV_ENVIRONMENTS.has(declared)) return true;
  if (env?.ALLOW_DEV_AUTH === 'true') return true; // any deployment but production may opt in, staging included
  if (declared) return false; // a named non-dev deployment (e.g. staging) without ALLOW_DEV_AUTH stays closed
  return undecidedDefault;
}

/** A 503 carrying the JSON error envelope; Hono's error handler returns its response as is. */
export function notConfigured(code: string, message: string): HTTPException {
  return new HTTPException(503, { res: failResponse(code, message, 503) });
}

/**
 * The Rescue Code pepper, when this deployment has one: the non-empty string
 * of the `RESCUE_PEPPER` secret, else undefined (codes are then stored under
 * plain SHA-256, as before SEC-5). Once set it must never change or go away.
 */
export function rescuePepper(env: RuntimeEnv | undefined): string | undefined {
  const pepper = env?.RESCUE_PEPPER;
  return typeof pepper === 'string' && pepper.length > 0 ? pepper : undefined;
}

export interface HealthReport {
  status: 'ok' | 'misconfigured';
  environment: string;
  devFallbacks: boolean;
  bindings: { db: boolean; clerk: boolean; stripe: boolean; stripeWebhook: boolean; rescuePepper: boolean; stripeLive: boolean; billingLiveAllowed: boolean };
  /** Switches the owner sets in the dashboard, so a monitor can see they took effect (F-FEEDBACK-001 section 7.8). */
  features: { notesSend: boolean };
}

/**
 * GET /health: which bindings are present — booleans only, never a value.
 * Healthy when Clerk and D1 are both bound, or when a named non-production
 * deployment runs the dev fallbacks. An unnamed (production) deployment with
 * ALLOW_DEV_AUTH=true and a missing binding is the "production trusting
 * bearers" state SEC-2 closes, so it reports misconfigured for a monitor.
 */
export function healthReport(env: RuntimeEnv | undefined): HealthReport {
  const bindings = {
    db: typeof env?.DB === 'object' && env.DB !== null,
    clerk: Boolean(env?.CLERK_SECRET_KEY || env?.CLERK_JWT_KEY),
    stripe: Boolean(env?.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(env?.STRIPE_WEBHOOK_SECRET),
    // Optional, so it never makes a deployment misconfigured — but a monitor can see it vanish.
    rescuePepper: rescuePepper(env) !== undefined,
    // F-BILL-002 section 4.9: is the bound Stripe key live, and has the owner opened live payments?
    stripeLive: stripeMode(env) === 'live',
    billingLiveAllowed: billingLiveAllowed(env),
  };
  const devFallbacks = devFallbacksAllowed(env);
  const environment = environmentName(env);
  const ready = (bindings.db && bindings.clerk) || (devFallbacks && environment !== 'production');
  return { status: ready ? 'ok' : 'misconfigured', environment, devFallbacks, bindings, features: { notesSend: notesSendEnabled(env) } };
}
