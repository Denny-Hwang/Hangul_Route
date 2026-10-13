import { JOIN_HANDOFF_KEY, JoinHandoffSchema, type JoinHandoff } from '@hangul-route/content-schema';
import { browserStorage, writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import { learnerHome } from './grown-up-lock';
import { clearGrownUpTab } from './unlock';

/**
 * The family join code handed to the learner app in this tab (F-APP-001 A-5b, section 3.8):
 * `sessionStorage` `hr:shell:joinCode` = `{ v: 1, code, at }`, no name and no space id. The learner
 * app's Join screen reads it once, within 30 minutes (`JOIN_HANDOFF_MS`, A-7), and the F-SPACE-001
 * steps (consent included) follow unchanged. Behind the guarded wrapper: blocked storage writes nothing.
 */
export function writeJoinHandoff(code: string, now: number, storage: KeyValueStorage | null = browserStorage('session')): boolean {
  const record: JoinHandoff = { v: 1, code, at: now };
  if (!JoinHandoffSchema.safeParse(record).success) return false;
  return writeItem(storage, JOIN_HANDOFF_KEY, JSON.stringify(record));
}

/**
 * **Open the app on this device**: write the hand-off, clear the unlock and the console session like
 * Back to learning (section 3.9), then open the learner app (`learnerHome()`, the app host from a site origin).
 */
export function openAppWithJoinCode(input: { code: string; now: number; origin?: string; storage?: KeyValueStorage | null; assign?: (url: string) => void }): void {
  const storage = input.storage === undefined ? browserStorage('session') : input.storage;
  writeJoinHandoff(input.code, input.now, storage);
  clearGrownUpTab(storage);
  const origin = input.origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  const assign = input.assign ?? ((url: string) => window.location.assign(url));
  assign(learnerHome(origin));
}
