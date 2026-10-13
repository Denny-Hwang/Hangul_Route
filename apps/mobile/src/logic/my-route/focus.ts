import type { RouteGoal } from '@hangul-route/content-schema';
import { goalReachedKey, isFirstGoalReached } from './seen';
import type { SeenRecord } from './types';

/**
 * What the Learning Route page does on a focus (AMENDMENTS-ROUTE-LEARNING-ROUTE
 * sections 5.1 and 8; F-ROUTE-001 section 3.10). The Route tab stays mounted
 * between visits, so each focus counts as one open, numbered from 1
 * (`focusKey`, 0 before the first focus):
 * - `route_map.viewed` is sent once per focus (`viewedFor` is the last focus
 *   that sent it), never again for a re-render or a new model in that focus;
 * - the seen record is read again on every focus (`seenFor` is the focus whose
 *   read has resolved) and written once per focus, only after that focus's
 *   read (`seenWrittenFor` is the last focus that wrote it);
 * - the read-only grown-up screen sends nothing and writes nothing.
 * Pure, so `MyRouteBody` only applies the answer to its refs.
 */
export interface FocusState {
  focusKey: number;
  viewedFor: number;
  seenFor: number;
  seenWrittenFor: number;
  readOnly: boolean;
  modelReady: boolean;
}

export function focusEffects(s: FocusState): { sendViewed: boolean; writeSeen: boolean } {
  if (s.readOnly || !s.modelReady || s.focusKey === 0) return { sendViewed: false, writeSeen: false };
  return {
    sendViewed: s.viewedFor !== s.focusKey,
    writeSeen: s.seenFor === s.focusKey && s.seenWrittenFor !== s.focusKey,
  };
}

/**
 * One focus's read of the seen record. It starts only after the previous
 * focus's write has settled (resolved or failed), so a quick tab switch never
 * reads the record from before that write. `isLive` is false once a newer
 * focus (or an unmount) has superseded this one: then nothing is read, or the
 * result is dropped, and the promise resolves to `null`.
 */
export async function seenReadAfter(
  pendingWrite: Promise<unknown>,
  read: () => Promise<SeenRecord | undefined>,
  isLive: () => boolean,
): Promise<{ record: SeenRecord | undefined } | null> {
  await pendingWrite.catch(() => undefined);
  if (!isLive()) return null;
  const record = await read();
  return isLive() ? { record } : null;
}

/**
 * The record the view compares against ("new quests joined", the one-time
 * fill, Hoya cheering). Only this open's record counts: between a focus and
 * its read the view shows nothing new (as on a first mount), and while the tab
 * is behind another screen it shows nothing new, so the fill never plays unseen.
 */
export function seenForView(s: { focusKey: number; seenFor: number; focused: boolean; seen: SeenRecord | undefined }): SeenRecord | undefined {
  return s.focused && s.focusKey > 0 && s.seenFor === s.focusKey ? s.seen : undefined;
}

/**
 * The first time the tab shows a reached plan goal on this device (amendment
 * section 4.3, LR-5c): Hoya cheers, the card reads "You reached your goal. Hoya
 * is proud!" for that visit, the goal's key joins `seen.goalsReached` and
 * `route_map.goal_reached` is sent. Only once this focus has read the record
 * (before that, a missing record must not read as a first time), only while
 * the tab is in front, never in read-only mode, and only for a plan goal (a
 * default goal is never reached by construction, section 4.1 rule 6).
 */
export function firstGoalReachedFor(s: {
  focusKey: number;
  seenFor: number;
  focused: boolean;
  readOnly: boolean;
  goal: RouteGoal | null;
  seen: SeenRecord | undefined;
}): boolean {
  if (s.readOnly || !s.focused || s.focusKey === 0 || s.seenFor !== s.focusKey) return false;
  if (s.goal === null || s.goal.from === 'default') return false;
  return isFirstGoalReached(s.goal, s.seen);
}

/**
 * When to record a first reached goal (its key in `seen.goalsReached`) and send
 * `route_map.goal_reached` (LR-5c): once per focus and goal (`mark`). With this
 * focus's seen write when that write happens now; on its own when the goal is
 * reached after that write, while the tab is in front; never before the write,
 * which will carry it. Null when there is nothing to record.
 */
export function goalRecordFor(s: {
  focusKey: number;
  seenWrittenFor: number;
  writeSeenNow: boolean;
  firstReached: boolean;
  goal: RouteGoal | null;
  recordedFor: string | null;
}): { mark: string; withSeenWrite: boolean } | null {
  if (!s.firstReached || s.goal === null) return null;
  const mark = `${s.focusKey}|${goalReachedKey(s.goal)}`;
  if (s.recordedFor === mark) return null;
  if (s.writeSeenNow) return { mark, withSeenWrite: true };
  return s.seenWrittenFor === s.focusKey ? { mark, withSeenWrite: false } : null;
}
