import { isServerOnlyTelemetryName, isTelemetryEventName } from '@hangul-route/content-schema';
import { Hono, type Context } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { learningRollupsEnabled, rollUpEvent, type RollupEnv } from '../lib/learning-rollups';
import { clientKey } from '../lib/rate-limit';
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
 * only the Worker records them (F-BILL-002 section 10), as are `space.goal.set`
 * and `space.goal.met` (F-CURR-002 section 11.3), an F-CURR-002 name
 * (section 11.3, row CM-3) keeps its payload only when it parses against its
 * strict schema, `session.end` keeps only the CM-3 fields that fit their codes,
 * and the log is
 * capped: these rules live in lib/server-events.ts, shared with the events the
 * Worker records itself.
 * [OA] A section 15 name of AMENDMENTS-ONE-ACCOUNT-MANY-USERS (and `session.start`) is also counted in the
 * anonymous `telemetry_daily` table (section 15.1, lib/telemetry-daily.ts): written through within per-isolate
 * bounds (held and summed only past them), best effort, after the response is decided, never failing this route
 * and never retried.
 * The log stays transient diagnostics. A name on the rollup allowlist also adds
 * 1 to a few `learning_rollups` cells (F-CURR-002 section 11.2, row CM-70a,
 * lib/learning-rollups.ts) from the kept payload alone, never the profile id;
 * a failed rollup write never fails the event, and the dashboard variable
 * `LEARNING_ROLLUPS=disabled` stops the writes at once.
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

/** The Worker's execution context, or undefined where there is none (Hono throws on the getter then, as in tests). */
function executionContextOf(c: Context): { waitUntil: (p: Promise<unknown>) => void } | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

telemetryRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null;
  const name = body?.name;
  if (!isTelemetryEventName(name)) {
    return fail(c, 'bad_request', 'unknown event name', 422);
  }
  // `billing.*` (F-BILL-002 section 10) and `space.goal.*` (F-CURR-002 section 11.3) are recorded by the Worker itself: a client can never forge one.
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
  const ctx = executionContextOf(c);
  const count = countTelemetryDaily(() => dbFor(c), c.env as TelemetryDailyEnv | undefined, stored, now.getTime());
  // No execution context (tests, local dev): finish the count before answering. It never rejects.
  if (ctx) ctx.waitUntil(count);
  else await count;
  // The name and kept payload only: the profile id never reaches the rollup. After the answer when
  // the runtime allows it (waitUntil), so a slow D1 write never delays the 201 into a client retry.
  if (learningRollupsEnabled(c.env as RollupEnv | undefined)) {
    const rollup = rollUpEvent(() => dbFor(c), { name, payload: stored.payload, receivedAt, at: event.at }, clientKey((h) => c.req.header(h)));
    if (ctx) ctx.waitUntil(rollup);
    else await rollup;
  }
  return ok(c, { event: stored }, 201);
});
