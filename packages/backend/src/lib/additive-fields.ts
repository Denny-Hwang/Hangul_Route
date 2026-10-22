import {
  CellBestSchema,
  DayLogSchema,
  SteadyWeeksSchema,
  GoalsSchema,
  LatchRecordSchema,
  ProgressSnapshotSchema,
  StreakLocalSchema,
  mergeCellBest,
  mergeDayLog,
  mergeEarliest,
  mergeGoals,
  mergeLatchRecord,
  mergeStreakBest,
  mergeStreakLocal,
} from '@hangul-route/content-schema';

/**
 * The Worker's preserve rule for additive snapshot fields.
 *
 * `SnapshotPutSchema` is a zod object, so it drops every key it does not know.
 * An older app build that re-uploads after a conflict merge has already lost
 * the newer fields and would erase them from the server copy. Each field
 * listed here is therefore kept from the stored record when the incoming one
 * does not carry it, and its summary counterpart travels with it so a summary
 * never describes data the payload no longer holds.
 *
 * One list serves every additive field (F-PLC-001 `placements`, F-VOC-005
 * `vocab`, F-PLAN-002 `selfRoute`, F-REPORT-001 `questDoneAt`, the F-CURR-002
 * section 4.8 fields and `sessions[].localDay`): a later spec
 * appends an entry, nothing else changes. Deploy the Worker before any app build that can send the field.
 */
export interface AdditiveField {
  /** Key on the stored snapshot payload. */
  readonly payloadKey: string;
  /** Key on the summary that describes it; kept together with the payload value. */
  readonly summaryKey?: string;
  /** True when the value means "the client did not send this field". */
  readonly isUnset: (value: unknown) => boolean;
  /**
   * For a monotonic field only: combines a sent value with the stored one when
   * both are set. Without it the sent value replaces the stored one.
   */
  readonly merge?: (incoming: unknown, stored: unknown) => unknown;
  /**
   * When the client sends the field but not its summary counterpart, keep the
   * stored summary instead of dropping it: for a field that a build can write
   * before it computes the summary. Without it a sent field travels with
   * exactly the summary that was sent.
   */
  readonly keepStoredSummaryWhenSent?: boolean;
}

/**
 * `placements` is append-only and defaults to `[]` after the zod parse, so an
 * empty list next to a stored non-empty one can only come from an old client.
 */
type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The fields nested in each placement result that an older build drops (its
 * `PlacementResultSchema` does not know them) and that never change once a
 * result is stored: F-CURR-001 §3.13 `catalogVersion`. A result sent without one
 * keeps the stored copy's value for the same id, so a re-upload after a conflict
 * merge never turns a result back into a version 8 one. Mirrors `mergePlacement`
 * in apps/mobile/src/logic/sync/merge.ts.
 */
const PLACEMENT_NESTED_KEYS = ['catalogVersion'] as const;

/**
 * For a list of records keyed by `id`: each sent record without one of `keys`
 * takes the stored copy's value for the same id. A sent value is never
 * overwritten, and a record the server does not hold is left alone.
 */
const keepNestedById = (keys: readonly string[]) => (incoming: unknown, stored: unknown): unknown => {
  if (!Array.isArray(incoming) || !Array.isArray(stored)) return incoming;
  const byId = new Map<unknown, Plain>();
  for (const r of stored) if (isPlain(r)) byId.set(r.id, r);
  let changed = false;
  const out = incoming.map((r) => {
    const prior = isPlain(r) ? byId.get(r.id) : undefined;
    if (!isPlain(r) || prior === undefined) return r;
    let kept: Plain = r;
    for (const key of keys) {
      if (kept[key] === undefined && prior[key] !== undefined) kept = { ...kept, [key]: prior[key] };
    }
    if (kept !== r) changed = true;
    return kept;
  });
  // The sent list itself when nothing was filled in, so an unchanged upload stays the same object.
  return changed ? out : incoming;
};

const keepPlacementFields = keepNestedById(PLACEMENT_NESTED_KEYS);

const PLACEMENTS: AdditiveField = {
  payloadKey: 'placements',
  summaryKey: 'placement',
  isUnset: (value) => value === undefined || (Array.isArray(value) && value.length === 0),
  merge: keepPlacementFields,
};

/**
 * The earlier of two latch times as instants (`Date.parse`), so an offset form
 * and a UTC form compare correctly. A value that does not parse never beats one
 * that does; two unparseable values (or a tie) fall back to the string order,
 * so the result never depends on argument order. Mirrors `mergeStageDoneAt` in
 * apps/mobile/src/logic/sync/merge.ts.
 */
export function earlierLatchTime(a: string, b: string): string {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  const fa = Number.isFinite(ta);
  const fb = Number.isFinite(tb);
  if (fa && fb && ta !== tb) return ta < tb ? a : b;
  if (fa !== fb) return fa ? a : b;
  return a <= b ? a : b;
}

/**
 * Unions two latch records (key -> ISO time): every key of either side, the
 * earlier time where both have one (`earlierLatchTime`), keys sorted. A side
 * that is not a record, and a value that is not a string, contribute nothing.
 */
function unionLatch(incoming: unknown, stored: unknown): Record<string, string> {
  const out = new Map<string, string>();
  for (const side of [stored, incoming]) {
    if (!isPlain(side)) continue;
    for (const [key, at] of Object.entries(side)) {
      if (typeof at !== 'string') continue;
      const prev = out.get(key);
      out.set(key, prev === undefined ? at : earlierLatchTime(prev, at));
    }
  }
  return Object.fromEntries([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * `stageDoneAt` (F-ROUTE-001 section 3.15) is the stage latch: a record that
 * only ever gains keys. A missing key or an empty record next to a stored
 * non-empty one can only come from a client that predates it, so the stored
 * latch is kept. A sent record is unioned with the stored one (earliest time
 * wins) rather than replacing it: a device that synced on an old build and then
 * upgraded holds a fresh rev without another device's latch, and a replace
 * would erase that earned "Complete". It has no summary counterpart.
 */
const STAGE_DONE_AT: AdditiveField = {
  payloadKey: 'stageDoneAt',
  isUnset: (value) => value === undefined || (isPlain(value) && Object.keys(value).length === 0),
  merge: unionLatch,
};

/**
 * `selfRoute` (F-PLAN-002 section 3.5) defaults to null after the zod parse. A
 * stopped route is archived (`archivedAt`), never set to null, so an incoming
 * null next to a stored route can only come from a client that predates the
 * field: the stored route and `summary.selfRoute` are kept. A sent route
 * replaces the stored one (the device keeps the newest `updatedAt`).
 */
const SELF_ROUTE: AdditiveField = {
  payloadKey: 'selfRoute',
  summaryKey: 'selfRoute',
  isUnset: (value) => value === undefined || value === null,
};

/**
 * `vocab` (F-VOC-005 section 3.3, P6) is optional with no default, so only an
 * absent key means "an old build sent this". An explicit empty slice
 * `{ v: 1, items: [], topics: [] }` is a value (a profile reset) and replaces
 * the stored one. `summary.vocab` is kept only when the slice is.
 */
const VOCAB: AdditiveField = {
  payloadKey: 'vocab',
  summaryKey: 'vocab',
  isUnset: (value) => value === undefined,
};

/**
 * `questDoneAt` (F-REPORT-001 section 3.3.1) is the quest latch, the twin of
 * `stageDoneAt`: quest id -> the time the quest was first finished. Builds from
 * RP-3a on always send the key, an empty record included, so only an **absent**
 * key means "an old build sent this" (the VOCAB rule): an old build that
 * re-uploads keeps the stored latch and `summary.activity`, also for a learner
 * with sessions but no finished quest (stored `{}` is a value). A sent record is
 * unioned with the stored one, earliest time wins (the stage-latch merge), so a
 * device that upgraded after another device synced never erases that device's
 * first-finish days. A sent `summary.activity` is kept as sent; a sent latch
 * without one (a build with the RP-3a writer but not the RP-4 builder, or an
 * activity the schema dropped as malformed) keeps the stored activity, which
 * carries its own `asOf`, so such a device never erases what another device
 * computed. After a profile reset the union brings old entries back; the device
 * counts an entry only while its quest is completed (section 3.3.4 step 2), so
 * the report starts fresh, but a quest finished again keeps its pre-reset first
 * finish (a known approximation, spec section 8 M5).
 */
const QUEST_DONE_AT: AdditiveField = {
  payloadKey: 'questDoneAt',
  summaryKey: 'activity',
  isUnset: (value) => value === undefined,
  merge: unionLatch,
  keepStoredSummaryWhenSent: true,
};

/**
 * `sessions[].localDay` (F-CURR-002 section 4.8) is written once, when the
 * session is logged. An older build's schema drops it on every re-upload, so a
 * sent session without it keeps the stored copy's day. `sessions` itself is
 * always sent; this entry only fills the nested key and never adds or removes
 * a session (a sent empty list stays empty).
 */
const SESSIONS: AdditiveField = {
  payloadKey: 'sessions',
  isUnset: (value) => !Array.isArray(value),
  merge: keepNestedById(['localDay']),
};

/** Lenient read (never throws: the F-CURR-002 schemas catch) of the stored and sent values, then the shared merge. */
interface LenientSchema<T> {
  parse: (value: unknown) => T | undefined;
}
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const lenientMerge =
  <T>(schema: LenientSchema<T>, merge: (a: T | undefined, b: T | undefined) => T | undefined) =>
  (incoming: unknown, stored: unknown): unknown => {
    const merged = merge(schema.parse(incoming), schema.parse(stored));
    // The sent value itself when the stored one adds nothing, so an unchanged upload stays the same object.
    return sameJson(merged, incoming) ? incoming : merged;
  };

/**
 * An F-CURR-002 section 4.8 field: optional with no default, so only an absent
 * key means "an older build sent this" and the stored value is kept; missing
 * keys are never cleared. A sent value is merged with the stored one by the
 * rule both the app and the Worker share (`progress-merge.ts` in
 * content-schema), so a device that synced on an older build never lowers a
 * level, a best run or a day's points, and never moves a first time later.
 */
const curr002 = <T>(payloadKey: string, schema: LenientSchema<T>, merge: (a: T | undefined, b: T | undefined) => T | undefined): AdditiveField => ({
  payloadKey,
  isUnset: (value) => value === undefined,
  merge: lenientMerge(schema, merge),
});

const shape = ProgressSnapshotSchema.shape;
const CURR_002_FIELDS: readonly AdditiveField[] = [
  curr002('cellBest', CellBestSchema, mergeCellBest),
  curr002('cellCheckAt', LatchRecordSchema, mergeLatchRecord),
  curr002('stageCheckAt', LatchRecordSchema, mergeLatchRecord),
  curr002('testedOut', LatchRecordSchema, mergeLatchRecord),
  curr002('goals', GoalsSchema, mergeGoals),
  curr002('dayLog', DayLogSchema, mergeDayLog),
  curr002('streakLocal', StreakLocalSchema, mergeStreakLocal),
  curr002('streakBest', shape.streakBest, mergeStreakBest),
  curr002('stamps', LatchRecordSchema, mergeLatchRecord),
  /*
   * `summary.memory` travels with the seeding marker: a build that writes the
   * memory block has seeded, so an older build that sends neither keeps the
   * stored block, and a sent marker without a block (one the schema dropped as
   * malformed) keeps it too, as `summary.activity` does.
   */
  { ...curr002('memSeededAt', shape.memSeededAt, mergeEarliest), summaryKey: 'memory', keepStoredSummaryWhenSent: true },
  /* The steady-weeks latch (row CM-17): union of keys, earliest per key, so the Home headline never drops. */
  curr002('steadyWeeks', SteadyWeeksSchema, mergeLatchRecord),
];

export const ADDITIVE_FIELDS: readonly AdditiveField[] = [PLACEMENTS, STAGE_DONE_AT, SELF_ROUTE, VOCAB, QUEST_DONE_AT, SESSIONS, ...CURR_002_FIELDS];

export interface SnapshotParts<P, S> {
  payload: P;
  summary: S;
}

/**
 * Returns the payload and summary to store: the incoming ones, with every
 * additive field the client left out filled from `stored`, and every field
 * with a `merge` combined with the stored value when both are set. The inputs are not
 * mutated; when nothing needs preserving the incoming objects are returned as is.
 */
export function preserveAdditiveFields<P extends object, S extends object>(
  incoming: SnapshotParts<P, S>,
  stored: SnapshotParts<unknown, unknown> | null,
  fields: readonly AdditiveField[] = ADDITIVE_FIELDS,
): SnapshotParts<P, S> {
  if (!stored || !isPlain(stored.payload)) return incoming;
  const storedPayload = stored.payload;
  const storedSummary = isPlain(stored.summary) ? stored.summary : null;
  const inPayload = incoming.payload as Plain;
  const inSummary = incoming.summary as Plain;

  let payload: Plain = inPayload;
  let summary: Plain = inSummary;
  /** Fills the summary counterpart from `stored` when the client sent none. */
  const keepStoredSummary = (key: string | undefined): void => {
    if (key && inSummary[key] === undefined && storedSummary && storedSummary[key] !== undefined) {
      summary = { ...summary, [key]: storedSummary[key] };
    }
  };
  for (const field of fields) {
    if (field.isUnset(storedPayload[field.payloadKey])) continue;
    if (!field.isUnset(inPayload[field.payloadKey])) {
      if (field.merge) {
        const merged = field.merge(inPayload[field.payloadKey], storedPayload[field.payloadKey]);
        if (merged !== inPayload[field.payloadKey]) payload = { ...payload, [field.payloadKey]: merged };
      }
      if (field.keepStoredSummaryWhenSent) keepStoredSummary(field.summaryKey);
      continue;
    }
    payload = { ...payload, [field.payloadKey]: storedPayload[field.payloadKey] };
    keepStoredSummary(field.summaryKey);
  }
  return { payload: payload as P, summary: summary as S };
}
