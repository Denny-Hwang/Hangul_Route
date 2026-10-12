import {
  BILLING_TELEMETRY_PREFIX,
  BrowseScopeSchema,
  BrowseSourceSchema,
  BrowseTargetSchema,
  LearnerBasisSchema,
  NOTES_MODES,
  NOTE_PRESET_IDS,
  NOTE_REACTION_IDS,
  NOTE_REPORT_REASONS,
  PlanKeySchema,
  REPORT_TELEMETRY_PAYLOAD,
  REPORT_TELEMETRY_PREFIX,
  SHELL_TELEMETRY_PAYLOADS,
  SHELL_TELEMETRY_PREFIX,
  StripeModeSchema,
  TransferInitiatorSchema,
  TransferSlotSchema,
  isTelemetryEventName,
  type TelemetryEventName,
} from '@hangul-route/content-schema';
import { id, store, type TelemetryEvent } from '../store';

/**
 * The Worker's telemetry log: the one in-memory store that POST /api/telemetry
 * (routes/telemetry.ts) writes for the learner app, and that the Worker writes
 * itself through `recordServerEvent` for surfaces with no telemetry client (the
 * console, F-REPORT-001 section 3.13). Both paths go through the same
 * codes-only filter and the same cap, so an event the Worker records never
 * carries more than the same event sent by an app.
 */

/** Cap on the in-memory log, so an isolate cannot grow without bound. */
export const MAX_EVENTS = 10_000;

type PayloadCodes = Readonly<Record<string, readonly string[]>>;
type PayloadValues = Readonly<Record<string, ReadonlySet<string>>>;

const valuesOf = (codes: PayloadCodes): PayloadValues =>
  Object.fromEntries(Object.entries(codes).map(([key, values]) => [key, new Set(values)]));

/**
 * Class-move events (F-SPACE-002 section 4.12) carry codes only: the keys
 * `initiator`, `slot` and `basis` with their known values, and no profile id,
 * so no class or learner identifier can ride along. Telemetry is never
 * evidence of consent; the D1 audit (`transfer_events`) is.
 */
const TRANSFER_EVENT_PREFIX = 'space.transfer.';
const TRANSFER_PAYLOAD_VALUES = valuesOf({
  initiator: TransferInitiatorSchema.options,
  slot: TransferSlotSchema.options,
  basis: LearnerBasisSchema.options,
});

/**
 * App-shell events (F-APP-001 section 3.18) carry codes only too: per event,
 * the keys and values in `SHELL_TELEMETRY_PAYLOADS`, and no profile id. A
 * `shell.*` name without an entry keeps no payload at all.
 */
const SHELL_PAYLOAD_VALUES: Readonly<Record<string, PayloadValues>> = Object.fromEntries(
  Object.entries(SHELL_TELEMETRY_PAYLOADS).map(([name, codes]) => [name, valuesOf(codes)]),
);

/**
 * Report events (F-REPORT-001 sections 3.10 and 3.13) keep only `scope`,
 * `space` and `period` with their enum values, and no profile id: never a
 * space id, a learner id or a name.
 */
const REPORT_PAYLOAD_VALUES = valuesOf(REPORT_TELEMETRY_PAYLOAD);

/** The only payload keys and values kept for a codes-only event, or `null` for an ordinary event. */
function codesOnlyValues(name: string): PayloadValues | null {
  if (name.startsWith(TRANSFER_EVENT_PREFIX)) return TRANSFER_PAYLOAD_VALUES;
  if (name.startsWith(SHELL_TELEMETRY_PREFIX)) return SHELL_PAYLOAD_VALUES[name] ?? {};
  if (name.startsWith(REPORT_TELEMETRY_PREFIX)) return REPORT_PAYLOAD_VALUES;
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

/**
 * All lessons events (F-BROWSE-001 sections 5.2 and 9) carry no profile id
 * and, per name, only the documented keys in their documented shapes: codes
 * from their enums, booleans, `minutes` a whole number 0-60, and `itemId` a
 * content id of the event's own `kind`. A value of any other shape is
 * dropped, so no account, learner or space identifier can be stored.
 */
const BROWSE_EVENT_PREFIX = 'browse.';

/** Whether a payload value may be stored; `payload` is the whole payload (`itemId` checks `kind`). */
type FieldRule = (value: unknown, payload: Record<string, unknown>) => boolean;

const oneOf = (values: readonly string[]): FieldRule => {
  const allowed: ReadonlySet<string> = new Set(values);
  return (value) => typeof value === 'string' && allowed.has(value);
};
const isBoolean: FieldRule = (value) => typeof value === 'boolean';
const isMinutes: FieldRule = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 60;
/** A content id that is a valid target of the payload's `kind`, which must itself be one of `kinds`. */
const contentIdOf = (kinds: readonly string[]): FieldRule => {
  const kindOk = oneOf(kinds);
  return (value, payload) => kindOk(payload.kind, payload) && typeof value === 'string' && BrowseTargetSchema.safeParse({ kind: payload.kind, id: value }).success;
};

const ITEM_KINDS = ['episode', 'quest', 'story', 'vocab-topic', 'card'] as const;
const PREVIEW_KINDS = ['quest', 'story', 'vocab-topic'] as const;

const BROWSE_PAYLOAD_RULES: Readonly<Record<string, Readonly<Record<string, FieldRule>>>> = {
  'browse.opened': {
    source: oneOf(BrowseSourceSchema.options),
    scope: oneOf(BrowseScopeSchema.options),
    passFrom: oneOf(['account', 'kept', 'gate', 'none']),
    offlineReady: isBoolean,
  },
  'browse.item_viewed': { kind: oneOf(ITEM_KINDS), itemId: contentIdOf(ITEM_KINDS), access: oneOf(['open', 'closed']) },
  'browse.preview_started': { kind: oneOf(PREVIEW_KINDS), itemId: contentIdOf(PREVIEW_KINDS) },
  'browse.preview_ended': { kind: oneOf(PREVIEW_KINDS), itemId: contentIdOf(PREVIEW_KINDS), reachedEnd: isBoolean, minutes: isMinutes },
  'browse.plans_tapped': { kind: oneOf(PREVIEW_KINDS) },
};

/**
 * Notes events (F-FEEDBACK-001 section 10) carry no profile id, so the server
 * holds no per-learner log of which notes were opened, and, per name, only the
 * documented keys: codes from the shared notes lists, booleans, and counts that
 * are whole numbers 0-30 (the inbox delivers at most 30 notes, section 6.8
 * rule 7). Note text, a note, batch, space or account id, a sender label, a
 * learner name and a profile id are never stored, whatever a client sends.
 */
const NOTES_EVENT_PREFIX = 'notes.';

const NOTE_COUNT_MAX = 30;
const isNoteCount: FieldRule = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= NOTE_COUNT_MAX;
const fromRole = oneOf(['teacher', 'family']);

const NOTES_PAYLOAD_RULES: Readonly<Record<string, Readonly<Record<string, FieldRule>>>> = {
  'notes.card_shown': { unread: isNoteCount },
  'notes.list_viewed': { notes: isNoteCount, unread: isNoteCount },
  'notes.note_opened': { presetId: oneOf(NOTE_PRESET_IDS), fromRole, hasText: isBoolean, hasSuggest: isBoolean, suggestOpen: isBoolean },
  'notes.reaction_picked': { reaction: oneOf(NOTE_REACTION_IDS), fromRole, changed: isBoolean },
  'notes.suggest_started': { fromRole },
  'notes.report_sent': { reason: oneOf(NOTE_REPORT_REASONS), via: oneOf(['note_page', 'grown_up_zone']) },
  'notes.prefs_changed': { classes: oneOf(NOTES_MODES) },
};

/**
 * Billing events (F-BILL-002 section 10) are recorded by the Worker only (a
 * client sending a `billing.*` name gets 422, routes/telemetry.ts) and carry
 * codes only: the plan key, the Stripe mode, and per name one flag. Never an
 * account, space or learner id, an amount, a currency, a promo code or a URL,
 * and never a profile id. B-5 and B-4 add their names' rows here.
 */
const planKey = oneOf(PlanKeySchema.options);
const stripeMode = oneOf(StripeModeSchema.options);

const BILLING_PAYLOAD_RULES: Readonly<Record<string, Readonly<Record<string, FieldRule>>>> = {
  'billing.checkout_completed': { planKey, mode: stripeMode, duplicate: isBoolean },
  'billing.payment_failed': { planKey, mode: stripeMode },
  'billing.refund_recorded': { planKey, full: isBoolean, mode: stripeMode },
};

/** Only the payload fields that fit their rule; a name without rules keeps none. */
function ruledPayload(
  rules: Readonly<Record<string, FieldRule>> | undefined,
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const kept: Record<string, unknown> = {};
  for (const [key, fits] of Object.entries(rules ?? {})) {
    if (fits(payload[key], payload)) kept[key] = payload[key];
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/**
 * The profile id and payload stored for an event: an ordinary event keeps a
 * string profile id and its payload as given; a codes-only event keeps only its
 * codes and never a profile id; a `browse.*` event keeps only its documented
 * fields (F-BROWSE-001 section 9) and never a profile id; so does a `notes.*`
 * event (F-FEEDBACK-001 section 10) and a `billing.*` event (F-BILL-002 section 10).
 */
export function keptEventFields(
  name: TelemetryEventName,
  payload: Record<string, unknown> | undefined,
  profileId: unknown,
): Pick<TelemetryEvent, 'profileId' | 'payload'> {
  if (name.startsWith(BROWSE_EVENT_PREFIX)) return { profileId: undefined, payload: ruledPayload(BROWSE_PAYLOAD_RULES[name], payload) };
  if (name.startsWith(NOTES_EVENT_PREFIX)) return { profileId: undefined, payload: ruledPayload(NOTES_PAYLOAD_RULES[name], payload) };
  if (name.startsWith(BILLING_TELEMETRY_PREFIX)) return { profileId: undefined, payload: ruledPayload(BILLING_PAYLOAD_RULES[name], payload) };
  const codesOnly = codesOnlyValues(name);
  if (codesOnly) return { profileId: undefined, payload: codesOnlyPayload(payload, codesOnly) };
  return { profileId: typeof profileId === 'string' ? profileId : undefined, payload };
}

/** Appends an event to the log and trims the oldest ones past `MAX_EVENTS`. */
export function appendEvent(event: TelemetryEvent): TelemetryEvent {
  store.events.push(event);
  if (store.events.length > MAX_EVENTS) store.events.splice(0, store.events.length - MAX_EVENTS);
  return event;
}

/**
 * Records an event the Worker observes itself (F-REPORT-001 section 3.13: the
 * report routes record `report.viewed`, because the console has no telemetry
 * client). The name is checked against the shared list; the payload goes
 * through the same codes-only filter as POST /api/telemetry, and a server event
 * never carries a profile id. Returns the stored event, or `null` (nothing
 * stored) for a name that is not on the list, so a telemetry slip never fails
 * the request that records it.
 */
export function recordServerEvent(name: TelemetryEventName, payload?: Record<string, unknown>): TelemetryEvent | null {
  if (!isTelemetryEventName(name)) return null;
  const at = new Date().toISOString();
  return appendEvent({ id: id('event'), name, payload: keptEventFields(name, payload, undefined).payload, at, receivedAt: at });
}
