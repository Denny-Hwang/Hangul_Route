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
