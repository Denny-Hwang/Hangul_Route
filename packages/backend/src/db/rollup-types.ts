/**
 * F-CURR-002 section 11.2 (row CM-70a): one cell of the `learning_rollups` table (migration
 * 0014). Codes and counts only: never a profile id, an install key, a device id or any free text.
 * `dim` is a content id, a game kind, an experiment arm (`E1:a`) or ''; `bucket` is a bucket code
 * or ''.
 */
export interface RollupKey {
  metric: string;
  dim: string;
  bucket: string;
}

/** A stored row: the UTC day of ingest (`YYYY-MM-DD`) and how many events landed in the cell that day. */
export interface RollupRow extends RollupKey {
  day: string;
  events: number;
}

/** The cell a key names inside one day; the separator cannot occur in a metric, a dim or a bucket. */
export const rollupCellKey = (k: RollupKey): string => `${k.metric}\n${k.dim}\n${k.bucket}`;

/** Each cell once, first occurrence kept: one event adds at most 1 to a cell. */
export function uniqueRollupKeys(keys: readonly RollupKey[]): RollupKey[] {
  const seen = new Set<string>();
  const out: RollupKey[] = [];
  for (const k of keys) {
    const cell = rollupCellKey(k);
    if (seen.has(cell)) continue;
    seen.add(cell);
    out.push({ metric: k.metric, dim: k.dim, bucket: k.bucket });
  }
  return out;
}
