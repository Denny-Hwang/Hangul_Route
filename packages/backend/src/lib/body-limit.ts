import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { fail } from '../envelope';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-16 (audit SEC-6): every route refuses a request body over a set size with 413
 * `payload_too_large`, before the route reads it. A declared Content-Length over the cap is refused unread; a body
 * with no declared length is read up to the cap and no further.
 *
 * Default: 256 KB. The largest ordinary bodies are far below it (a plan with its curriculum items, a note, a
 * telemetry event). The waitlist keeps its own smaller cap of 2 KB inside this one.
 *
 * Two routes take a body from a source this API does not size, and get 2 MB:
 * - `PUT /api/sync/learners/:id/snapshot`: the whole progress record of a learner, which only grows. 2 MB is also
 *   D1's own ceiling for one stored value, so no upload that could be saved before is refused now; an older app
 *   build keeps syncing as it did.
 * - `POST /api/entitlements/stripe/webhook`: Stripe sets the size of its events, and a refused event is retried
 *   and then dropped, which would leave a paid plan switched off.
 *
 * One route is left to its own cap: `POST /api/sync/learners/:id/memory` already reads its body up to 64 KB and
 * no further, and its 413 carries the caps a device needs to split its queue (F-CURR-002 section 4.8).
 */
export const BODY_LIMIT_BYTES = 256 * 1024;
export const LARGE_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

const SNAPSHOT_PATH = /^\/api\/sync\/learners\/[^/]+\/snapshot$/;
const STRIPE_WEBHOOK_PATH = '/api/entitlements/stripe/webhook';
const MEMORY_PUSH_PATH = /^\/api\/sync\/learners\/[^/]+\/memory$/;

/**
 * The cap of a request, by method and path; null for the route that enforces its own smaller cap. A path spelled
 * another way (percent-encoded) gets the default.
 */
export function bodyLimitBytesFor(method: string, path: string): number | null {
  if (method === 'POST' && MEMORY_PUSH_PATH.test(path)) return null;
  if (method === 'PUT' && SNAPSHOT_PATH.test(path)) return LARGE_BODY_LIMIT_BYTES;
  if (method === 'POST' && path === STRIPE_WEBHOOK_PATH) return LARGE_BODY_LIMIT_BYTES;
  return BODY_LIMIT_BYTES;
}

const tooLarge = (c: Context): Response => fail(c, 'payload_too_large', 'Request body is too large', 413);

const defaultLimit = bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: tooLarge });
const largeLimit = bodyLimit({ maxSize: LARGE_BODY_LIMIT_BYTES, onError: tooLarge });

/** The middleware for every route (app.ts). */
export const requestBodyLimit: MiddlewareHandler = (c, next) => {
  const cap = bodyLimitBytesFor(c.req.method, c.req.path);
  if (cap === null) return next();
  return (cap === LARGE_BODY_LIMIT_BYTES ? largeLimit : defaultLimit)(c, next);
};
