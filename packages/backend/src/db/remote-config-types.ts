/**
 * Remote config (F-CURR-002 section 12.2, row CM-2): the rows of `remote_config` (migration 0013) and the
 * public shape `GET /api/config` serves. The table holds switch values only, never an identifier.
 */

/** One stored row. `on` false or a lower `pct` only ever narrows a feature on the device (remote can only reduce). */
export interface RemoteConfigRow {
  flag: string;
  on: boolean;
  /** 0-100, the share of profiles (bucketed per profile on the device) that get the feature. */
  pct: number;
  updatedAt: string;
  /** The last change's note (the owner's, or the guardrail evaluator's in CM-70b). Never served. */
  reason: string | null;
}

/** What one flag looks like in the public response. */
export interface PublicRemoteFlag {
  on: boolean;
  pct: number;
}

/**
 * A servable flag name: a camelCase switch (`dailyReview`), optionally with one lower-case key (`pack.k-food`,
 * `game.cloze_pick`). A row whose name does not match is not served, so a typo in the console cannot reach a device
 * as an odd key, and a name such as `__proto__` can never be one.
 */
export const REMOTE_FLAG_NAME = /^[a-z][A-Za-z0-9]{0,47}(\.[a-z0-9][a-z0-9_-]{0,47})?$/;

/** A stored `pct` as served: an integer in 0-100; anything that is not a finite number is 0 (fails toward off). */
export function clampPct(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.floor(n)));
}

/** A stored `on` as served: only exactly 1 (or true) is on; anything else is off. */
export function readOn(raw: unknown): boolean {
  return raw === 1 || raw === true || raw === '1';
}

/** The public `flags` object: valid names only, `on` and `pct` only (never `reason` or `updated_at`). */
export function publicFlags(rows: readonly RemoteConfigRow[]): Record<string, PublicRemoteFlag> {
  const out: Record<string, PublicRemoteFlag> = {};
  for (const row of rows) {
    if (!REMOTE_FLAG_NAME.test(row.flag)) continue;
    out[row.flag] = { on: row.on === true, pct: clampPct(row.pct) };
  }
  return out;
}
