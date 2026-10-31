import { readJsonStrict, writeJson } from '../../platform/storage';
import { WEEK_DROP_KEY } from '../../store/week-drop-store';

/*
 * The weeks whose "This week in Korea" drop a learner finished on this device (F-CURR-002 §5.7, row CM-48;
 * design/wireframes/home/this-week-in-korea.md A2 and D): the Mondays, newest last, at most `KEPT_WEEKS`. Only the
 * Home card reads them (A2's "Done for this week"); nothing counts them, shows them or sends them, and a week not done
 * is never named anywhere. A value that does not parse reads as no week done, and the next done mark replaces it with
 * a clean list (only these device-local marks are at stake); a storage read that fails writes nothing.
 */

/** About a year of weeks: the card reads only this week's, the rest keep the value small. */
export const KEPT_WEEKS = 60;
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The kept list of a stored value: valid Mondays only, sorted, without repeats, the newest `KEPT_WEEKS`. */
export function doneWeeksOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value.filter((w): w is string => typeof w === 'string' && WEEK_RE.test(w)) : [];
  return [...new Set(list)].sort().slice(-KEPT_WEEKS);
}

export async function readDoneWeeks(profileId: string): Promise<string[]> {
  try {
    return doneWeeksOf(await readJsonStrict<unknown>(WEEK_DROP_KEY(profileId)));
  } catch {
    return [];
  }
}

/** Marks a week done; a storage read that fails writes nothing (a value it could not see is never replaced). */
export async function markWeekDone(profileId: string, week: string): Promise<void> {
  let current: unknown;
  try {
    current = await readJsonStrict<unknown>(WEEK_DROP_KEY(profileId));
  } catch {
    return;
  }
  const weeks = doneWeeksOf(current);
  if (weeks.includes(week)) return;
  await writeJson(WEEK_DROP_KEY(profileId), doneWeeksOf([...weeks, week])).catch(() => undefined);
}
