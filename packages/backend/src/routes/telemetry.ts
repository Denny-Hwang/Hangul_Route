import {
  LearnerBasisSchema,
  SHELL_TELEMETRY_PAYLOADS,
  SHELL_TELEMETRY_PREFIX,
  TransferInitiatorSchema,
  TransferSlotSchema,
  isTelemetryEventName,
} from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { fail, ok } from '../envelope';
import { id, store, type TelemetryEvent } from '../store';

/**
 * POST /api/telemetry — write-only intake for the learner app
 * (apps/mobile/src/platform/telemetry.ts, F-PWA-001 §3.2). Names come from
 * the shared list in @hangul-route/content-schema. `at` is the client's
 * timestamp (offline-queued events arrive late) when it is plausible, else
 * ours; `receivedAt` is always ours.
 * There is deliberately no read route (audit SEC-3).
 */
export const telemetryRoutes = new Hono();

const MAX_EVENTS = 10_000;

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

/**
 * Class-move events (F-SPACE-002 section 4.12) carry codes only: the keys
 * `initiator`, `slot` and `basis` with their known values, and no profile id,
 * so no class or learner identifier can ride along. Telemetry is never
 * evidence of consent; the D1 audit (`transfer_events`) is.
 */
type PayloadValues = Readonly<Record<string, ReadonlySet<string>>>;

const TRANSFER_EVENT_PREFIX = 'space.transfer.';
const TRANSFER_PAYLOAD_VALUES: PayloadValues = {
  initiator: new Set(TransferInitiatorSchema.options),
  slot: new Set(TransferSlotSchema.options),
  basis: new Set(LearnerBasisSchema.options),
};

/**
 * App-shell events (F-APP-001 section 3.18) carry codes only too: per event,
 * the keys and values in `SHELL_TELEMETRY_PAYLOADS`, and no profile id. A
 * `shell.*` name without an entry keeps no payload at all.
 */
const SHELL_PAYLOAD_VALUES: Readonly<Record<string, PayloadValues>> = Object.fromEntries(
  Object.entries(SHELL_TELEMETRY_PAYLOADS).map(([name, codes]) => [
    name,
    Object.fromEntries(Object.entries(codes).map(([key, values]) => [key, new Set(values)])),
  ]),
);

/** The only payload keys and values kept for a codes-only event, or `null` for an ordinary event. */
function codesOnlyValues(name: string): PayloadValues | null {
  if (name.startsWith(TRANSFER_EVENT_PREFIX)) return TRANSFER_PAYLOAD_VALUES;
  if (name.startsWith(SHELL_TELEMETRY_PREFIX)) return SHELL_PAYLOAD_VALUES[name] ?? {};
  return null;
}

function codesOnlyPayload(
  payload: Record<string, unknown> | undefined,
  values: PayloadValues,
): Record<string, unknown> | undefined {
  const kept: Record<string, unknown> = {};
  for (const [key, allowed] of Object.entries(values)) {
    const value = payload?.[key];
    if (typeof value === 'string' && allowed.has(value)) kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

telemetryRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null;
  const name = body?.name;
  if (!isTelemetryEventName(name)) {
    return fail(c, 'bad_request', 'unknown event name', 422);
  }
  const now = new Date();
  const receivedAt = now.toISOString();
  const rawPayload = body?.payload;
  const payload = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload) ? (rawPayload as Record<string, unknown>) : undefined;
  const codesOnly = codesOnlyValues(name);
  const event: TelemetryEvent = {
    id: id('event'),
    name,
    profileId: !codesOnly && typeof body?.profileId === 'string' ? body.profileId : undefined,
    payload: codesOnly ? codesOnlyPayload(payload, codesOnly) : payload,
    at: clientTimestamp(body?.at, now.getTime()) ?? receivedAt,
    receivedAt,
  };
  store.events.push(event);
  // Cap the in-memory log so an isolate cannot grow without bound.
  if (store.events.length > MAX_EVENTS) store.events.splice(0, store.events.length - MAX_EVENTS);
  return ok(c, { event }, 201);
});
