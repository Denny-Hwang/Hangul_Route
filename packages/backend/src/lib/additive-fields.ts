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
 * `vocab`, F-PLAN-002 `selfRoute`, F-REPORT-001 `questDoneAt`): a later spec
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
}

/**
 * `placements` is append-only and defaults to `[]` after the zod parse, so an
 * empty list next to a stored non-empty one can only come from an old client.
 */
const PLACEMENTS: AdditiveField = {
  payloadKey: 'placements',
  summaryKey: 'placement',
  isUnset: (value) => value === undefined || (Array.isArray(value) && value.length === 0),
};

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);

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
 * first-finish days; a build that sends the latch sends its own
 * `summary.activity`, which is kept as sent. After a profile reset the union can
 * bring old entries back: the device counts an entry only while its quest is
 * completed (section 3.3.4 step 2), so the report still starts fresh.
 */
const QUEST_DONE_AT: AdditiveField = {
  payloadKey: 'questDoneAt',
  summaryKey: 'activity',
  isUnset: (value) => value === undefined,
  merge: unionLatch,
};

export const ADDITIVE_FIELDS: readonly AdditiveField[] = [PLACEMENTS, STAGE_DONE_AT, SELF_ROUTE, VOCAB, QUEST_DONE_AT];

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
  for (const field of fields) {
    if (field.isUnset(storedPayload[field.payloadKey])) continue;
    if (!field.isUnset(inPayload[field.payloadKey])) {
      if (field.merge) payload = { ...payload, [field.payloadKey]: field.merge(inPayload[field.payloadKey], storedPayload[field.payloadKey]) };
      continue;
    }
    payload = { ...payload, [field.payloadKey]: storedPayload[field.payloadKey] };
    const key = field.summaryKey;
    if (key && inSummary[key] === undefined && storedSummary && storedSummary[key] !== undefined) {
      summary = { ...summary, [key]: storedSummary[key] };
    }
  }
  return { payload: payload as P, summary: summary as S };
}
