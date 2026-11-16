import type { Context } from 'hono';
import type { Db } from '../db';
import { clientKey } from './rate-limit';
import { rescuePepper, type RuntimeEnv } from './runtime';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-16 (audit SEC-5): per-client limits that last. The in-memory limiter of
 * lib/rate-limit counts per isolate, so a recycled isolate or another region starts from zero. These limits count
 * in the D1 table `rate_hits` (migration 0005, the table the class-move and note limits already use), so every
 * isolate sees the same count. Same rolling window and the same decision shape as the in-memory limiter.
 *
 * The counter key never holds the client's address: it is `rl:<limit name>:<hash>`, where the hash is the first
 * 32 hex characters of SHA-256 over the limit name and the client key (`clientKey`: the connecting IP), keyed with
 * the RESCUE_PEPPER secret when the deployment has one. Rows older than a day are removed by the daily purge
 * (lib/note-retention), like every other `rate_hits` row.
 */
export interface DurableLimit {
  /** Short name in the counter key, e.g. `claim`. Lower-case letters and hyphens. */
  name: string;
  /** Hits allowed per window. */
  limit: number;
  windowMs: number;
}

/** `retryAfterSeconds` is 0 when allowed, else the seconds until an attempt can pass again. */
export interface DurableDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

const ALLOWED: DurableDecision = { allowed: true, retryAfterSeconds: 0 };

const encoder = new TextEncoder();

/** The counter key of one client under one limit. Never the address itself. */
export async function durableRateKey(rule: DurableLimit, client: string, pepper: string | undefined): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${pepper ?? ''}\n${rule.name}\n${client}`));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `rl:${rule.name}:${hex.slice(0, 32)}`;
}

/** The counter key of this request's client. */
export function requestRateKey(c: Context, rule: DurableLimit): Promise<string> {
  return durableRateKey(rule, clientKey((n) => c.req.header(n)), rescuePepper(c.env as RuntimeEnv | undefined));
}

/** Seconds until the oldest hit in the window leaves it: when the next attempt can pass. At least 1. */
async function retryAfterSeconds(db: Db, rule: DurableLimit, key: string, now: Date): Promise<number> {
  const oldest = await db.oldestRateHit(key, new Date(now.getTime() - rule.windowMs));
  const opensAt = oldest === null ? now.getTime() : Date.parse(oldest) + rule.windowMs;
  return Math.max(1, Math.ceil((opensAt - now.getTime()) / 1000));
}

/**
 * Counts one attempt: allowed while fewer than `rule.limit` hits are in the window, and then the hit is recorded
 * in the same statement (two isolates cannot both take the last slot). A blocked attempt writes nothing.
 */
export async function takeDurableHit(db: Db, rule: DurableLimit, key: string, now: Date = new Date()): Promise<DurableDecision> {
  if (await db.takeRateHit(key, now, new Date(now.getTime() - rule.windowMs), rule.limit)) return ALLOWED;
  return { allowed: false, retryAfterSeconds: await retryAfterSeconds(db, rule, key, now) };
}

/**
 * Reads the limit without counting: for a brake that counts only failed attempts (a wrong join code). The caller
 * records a failure with `db.recordRateHit(key, now)`.
 */
export async function peekDurableLimit(db: Db, rule: DurableLimit, key: string, now: Date = new Date()): Promise<DurableDecision> {
  if ((await db.countRateHits(key, new Date(now.getTime() - rule.windowMs))) < rule.limit) return ALLOWED;
  return { allowed: false, retryAfterSeconds: await retryAfterSeconds(db, rule, key, now) };
}

/** The 429 these limits have always answered: `too_many_attempts` with `details.retryAfterSeconds`. */
export function tooManyAttempts(c: Context, decision: DurableDecision): Response {
  return c.json({ ok: false, error: { code: 'too_many_attempts', message: 'Too many attempts — try again later', details: { retryAfterSeconds: decision.retryAfterSeconds } } }, 429);
}
