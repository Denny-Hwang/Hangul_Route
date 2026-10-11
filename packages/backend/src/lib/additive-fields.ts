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
 * `vocab`, F-PLAN-002 `selfRoute`): a later spec appends an entry, nothing else
 * changes. Deploy the Worker before any app build that can send the field.
 */
export interface AdditiveField {
  /** Key on the stored snapshot payload. */
  readonly payloadKey: string;
  /** Key on the summary that describes it; kept together with the payload value. */
  readonly summaryKey?: string;
  /** True when the value means "the client did not send this field". */
  readonly isUnset: (value: unknown) => boolean;
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

/**
 * `stageDoneAt` (F-ROUTE-001 section 3.15) is the stage latch: a record that
 * only gains keys on the client (union merge, earliest time wins). A missing
 * key or an empty record next to a stored non-empty one can only come from a
 * client that predates it, so an earned "Complete" is never erased. It has no
 * summary counterpart.
 */
const STAGE_DONE_AT: AdditiveField = {
  payloadKey: 'stageDoneAt',
  isUnset: (value) =>
    value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0),
};

export const ADDITIVE_FIELDS: readonly AdditiveField[] = [PLACEMENTS, STAGE_DONE_AT];

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface SnapshotParts<P, S> {
  payload: P;
  summary: S;
}

/**
 * Returns the payload and summary to store: the incoming ones, with every
 * additive field the client left out filled from `stored`. The inputs are not
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
    if (!field.isUnset(inPayload[field.payloadKey]) || field.isUnset(storedPayload[field.payloadKey])) continue;
    payload = { ...payload, [field.payloadKey]: storedPayload[field.payloadKey] };
    const key = field.summaryKey;
    if (key && inSummary[key] === undefined && storedSummary && storedSummary[key] !== undefined) {
      summary = { ...summary, [key]: storedSummary[key] };
    }
  }
  return { payload: payload as P, summary: summary as S };
}
