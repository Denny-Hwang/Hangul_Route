import { readJsonStrict, writeJson } from '../../platform/storage';
import { DECODE_SPRINT_KEY } from '../../store/decode-sprint-store';

/**
 * The Block Sprint's record on this device (F-CURR-002 section 7.1 F9, OD-8, row CM-32): read before a sprint and
 * written when one is finished. Never synced, never sent; `logic/syllable-build/sprint.ts` parses it (`parseRecord`).
 */

/** The record's read: the stored value (null when there is none or it does not parse), or not ok when storage failed. */
export type DecodeSprintRead = { ok: true; raw: unknown } | { ok: false };

/**
 * A missing key, or a value that does not parse (nothing usable to keep), is "no record yet". A failed read of the
 * storage is `{ ok: false }`: the sprint still plays, but it writes nothing and sends nothing, so a passing storage error
 * never overwrites the learner's best and sprint count, and never sends a sprint index that restarted at 1 (G9 reads it).
 */
export async function readDecodeSprint(profileId: string): Promise<DecodeSprintRead> {
  try {
    return { ok: true, raw: await readJsonStrict<unknown>(DECODE_SPRINT_KEY(profileId)) };
  } catch {
    return { ok: false };
  }
}

export async function writeDecodeSprint(profileId: string, record: unknown): Promise<void> {
  try {
    await writeJson(DECODE_SPRINT_KEY(profileId), record);
  } catch {
    // The best is a convenience: a failed write only means this sprint is not remembered.
  }
}
