import { readJsonStrict, writeJson } from '../../platform/storage';
import { DECODE_SPRINT_KEY } from '../../store/decode-sprint-store';

/**
 * The Block Sprint's record on this device (F-CURR-002 section 7.1 F9, OD-8, row CM-32): read before a sprint and
 * written when one is finished. Never synced, never sent; `logic/syllable-build/sprint.ts` parses it (`parseRecord`).
 */

/** The stored value, or null when there is none or it cannot be read (the sprint then starts a record of its own). */
export async function readDecodeSprint(profileId: string): Promise<unknown> {
  try {
    return await readJsonStrict<unknown>(DECODE_SPRINT_KEY(profileId));
  } catch {
    return null;
  }
}

export async function writeDecodeSprint(profileId: string, record: unknown): Promise<void> {
  try {
    await writeJson(DECODE_SPRINT_KEY(profileId), record);
  } catch {
    // The best is a convenience: a failed write only means this sprint is not remembered.
  }
}
