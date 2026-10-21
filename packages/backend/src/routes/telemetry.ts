import { isServerOnlyTelemetryName, isTelemetryEventName } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { appendEvent, keptEventFields } from '../lib/server-events';
import { countTelemetryDaily, type TelemetryDailyEnv } from '../lib/telemetry-daily';
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
 * only the Worker records them (F-BILL-002 section 10), and the log is
 * capped: these rules live in lib/server-events.ts, shared with the events the
 * Worker records itself.
 * [OA] A section 15 name of AMENDMENTS-ONE-ACCOUNT-MANY-USERS (and `session.start`) is also counted in the
 * anonymous `telemetry_daily` table (section 15.1, lib/telemetry-daily.ts): summed in the isolate and written at
 * most once a minute within per-isolate bounds, best effort, after the response is decided, never failing this
 * route and never retried.
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
  const stored = appendEvent(event);
  const count = countTelemetryDaily(() => dbFor(c), c.env as TelemetryDailyEnv | undefined, stored, now.getTime());
  try {
    c.executionCtx.waitUntil(count);
  } catch {
    // No execution context (tests, local dev): finish the count before answering. It never rejects.
    await count;
  }
  return ok(c, { event: stored }, 201);
});
