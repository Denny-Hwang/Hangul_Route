import { isTelemetryEventName } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { id, store, type TelemetryEvent } from '../store';

/**
 * POST /api/telemetry — write-only intake for the learner app
 * (apps/mobile/src/platform/telemetry.ts, F-PWA-001 §3.2). Names come from
 * the shared list in @hangul-route/content-schema. `at` is the client's
 * timestamp (offline-queued events arrive late); `receivedAt` is ours.
 * There is deliberately no read route (audit SEC-3).
 */
export const telemetryRoutes = new Hono();

const MAX_EVENTS = 10_000;

/** ISO 8601 date-time with an explicit zone — what `new Date().toISOString()` sends. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** The client's timestamp as UTC ISO, or null when it is missing or not a real date-time. */
function clientTimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string' || !ISO_DATE_TIME.test(raw)) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

telemetryRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null;
  const name = body?.name;
  if (!isTelemetryEventName(name)) {
    return fail(c, 'bad_request', 'unknown event name', 422);
  }
  const receivedAt = new Date().toISOString();
  const payload = body?.payload;
  const event: TelemetryEvent = {
    id: id('event'),
    name,
    profileId: typeof body?.profileId === 'string' ? body.profileId : undefined,
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : undefined,
    at: clientTimestamp(body?.at) ?? receivedAt,
    receivedAt,
  };
  store.events.push(event);
  // Cap the in-memory log so an isolate cannot grow without bound.
  if (store.events.length > MAX_EVENTS) store.events.splice(0, store.events.length - MAX_EVENTS);
  return ok(c, { event }, 201);
});
