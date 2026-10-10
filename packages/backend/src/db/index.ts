import { devFallbacksAllowed, notConfigured, type RuntimeEnv } from '../lib/runtime';
import { D1Db, type D1Like } from './d1';
import { MemoryDb } from './memory';
import type { Db } from './types';

export type { Db, StoredRelink } from './types';
export { D1Db, MemoryDb };

/** The dev / test backend when no D1 binding is present (only where dev fallbacks are opted in — lib/runtime). */
export const memoryDb = new MemoryDb();

let fallback: Db = memoryDb;

/** Tests only: route requests without an `env.DB` binding to this backend (e.g. the SQLite shim). */
export function setFallbackDb(db: Db): void {
  fallback = db;
}
export function fallbackDb(): Db {
  return fallback;
}

const byBinding = new WeakMap<object, D1Db>();

/**
 * The `Db` for this request: `env.DB` (D1, F-INFRA-003), or the fallback
 * (in-memory by default) when the deployment opted in to dev fallbacks.
 * Otherwise a missing binding throws 503 `db_not_configured` (audit SEC-2) —
 * production must never answer from an isolate's memory.
 */
export function dbFor(c: { env?: unknown }): Db {
  const env = c.env as (RuntimeEnv & { DB?: D1Like }) | undefined;
  const binding = env?.DB;
  if (!binding || typeof binding !== 'object') {
    if (!devFallbacksAllowed(env)) throw notConfigured('db_not_configured', 'Storage is not configured on this deployment');
    return fallback;
  }
  let db = byBinding.get(binding);
  if (!db) {
    db = new D1Db(binding);
    byBinding.set(binding, db);
  }
  return db;
}
