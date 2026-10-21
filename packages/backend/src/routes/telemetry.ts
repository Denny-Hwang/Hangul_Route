import { isServerOnlyTelemetryName, isTelemetryEventName } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { appendEvent, keptEventFields } from '../lib/server-events';
import { id, type TelemetryEvent } from '../store';

/**
 * POST /api/telemetry — write-only intake for the learner app
 * (apps/mobile/src/platform/telemetry.ts, F-PWA-001 §3.2). Names come from
 * the shared list in @hangul-route/content-schema. `at` is the client's
 * timestamp (offline-queued events arrive late) when it is plausible, else
 * ours; `receivedAt` is always ours.
 * Codes-only events (`space.transfer.*`, `shell.*`, `report.*`) keep only their
 * codes and never a profile id, `browse.*` and `notes.*` events keep only
 * their documented fields and never a profile id (F-BROWSE-001 section 9,
 * F-FEEDBACK-001 section 10), `billing.*` names are refused with 422 because
 * only the Worker records them (F-BILL-002 section 10), an F-CURR-002 name
 * (section 11.3, row CM-3) keeps its payload only when it parses against its
 * strict schema, `session.end` keeps only the CM-3 fields that fit their codes,
 * and the log is
 * capped: these rules live in lib/server-events.ts, shared with the events the
 * Worker records itself.
 * There is deliberately no read route (audit SEC-3).
 */
export const telemetryRoutes = new Hono();

/** ISO 8601 date-time with an explicit zone — what `new Date().toISOString()` sends. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** How far ahead of our clock a device may run (clock skew) before its time is ignored. */
const MAX_CLIENT_AHEAD_MS = 5 * 60 * 1000;
/** The oldest event an offline queue can plausibly still hold (F-PWA-001 §3.2). */
const MAX_CLIENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The client's timestamp as UTC ISO, or null when it is missing, not a real
 * date-time, or implausible against `nowMs` — more than 5 minutes ahead or
 * more than 30 days old (a wrong device clock, or an anonymous caller).
 */
function clientTimestamp(raw: unknown, nowMs: number): string | null {
  if (typeof raw !== 'string' || !ISO_DATE_TIME.test(raw)) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms) || ms > nowMs + MAX_CLIENT_AHEAD_MS || ms < nowMs - MAX_CLIENT_AGE_MS) return null;
  return new Date(ms).toISOString();
}

telemetryRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null;
  const name = body?.name;
  if (!isTelemetryEventName(name)) {
    return fail(c, 'bad_request', 'unknown event name', 422);
  }
  // `billing.*` is recorded by the Worker itself (F-BILL-002 section 10): a client can never forge one.
  if (isServerOnlyTelemetryName(name)) {
    return fail(c, 'bad_request', 'server-only event name', 422);
  }
  const now = new Date();
  const receivedAt = now.toISOString();
  const rawPayload = body?.payload;
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) ? (rawPayload as Record<string, unknown>) : undefined;
  const event: TelemetryEvent = {
    id: id('event'),
    name,
    ...keptEventFields(name, payload, body?.profileId),
    at: clientTimestamp(body?.at, now.getTime()) ?? receivedAt,
    receivedAt,
  };
  return ok(c, { event: appendEvent(event) }, 201);
});
