import { BrowseKeptPassSchema, type AdultPersona, type BrowseKeptPass, type BrowsePass } from '@hangul-route/content-schema';
import { passActive, resolvePass, type ResolvedPass } from '../logic/browse/pass';
import { readSessionPass, removeSessionPass } from './browse';
import { readLastPersona } from './shell-store';
import { readJson, removeKey } from './storage';

/**
 * The browse root's pass at boot (F-BROWSE-001 section 4.3). The tab's session
 * pass is read synchronously, before first paint: an active one decides alone.
 * Without one the kept pass (IndexedDB, keep switch only) and the last grown-up
 * persona (read only, F-APP-001 shell store) are read, `resolvePass` decides,
 * and what it names for removal is removed. Browse reads no other key here.
 */

/** The kept pass and Lesson display settings (section 5.3), written only while the keep switch is on (BR-7). */
export const BROWSE_KEPT_PASS_KEY = 'browse:pass';
export const BROWSE_PREFS_KEY = 'browse:prefs';

export interface BrowseBoot {
  /** The tab's session pass as read (an expired one stays for the Access screen's source); `null` when none or removed. */
  session: BrowsePass | null;
  resolved: ResolvedPass;
  lastPersona: AdultPersona | null;
}

/** An active session pass, resolved without waiting; `null` when the kept pass must be read first. */
export function resolveSessionNow(now: number): { session: BrowsePass; resolved: ResolvedPass } | null {
  const session = readSessionPass();
  if (!session || !passActive(session, now)) return null;
  return { session, resolved: resolvePass({ session, kept: null, now }) };
}

/** Removes the kept pass and its settings (switch off, expired, or corrupt). A refusing store is left as it is. */
export async function removeKeptPass(): Promise<void> {
  await Promise.all([removeKey(BROWSE_KEPT_PASS_KEY), removeKey(BROWSE_PREFS_KEY)]).catch(() => undefined);
}

/** The kept pass, or `null`. A value that is not a `BrowseKeptPass` is removed (with its settings) and reads as absent. */
export async function readKeptPass(): Promise<BrowseKeptPass | null> {
  let value: unknown;
  try {
    value = await readJson<unknown>(BROWSE_KEPT_PASS_KEY);
  } catch {
    return null;
  }
  if (value === null || value === undefined) return null;
  const parsed = BrowseKeptPassSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  await removeKeptPass();
  return null;
}

/** The full boot resolution: session pass, kept pass, persona, and the removals `resolvePass` names. */
export async function resolveBrowseBoot(now: number): Promise<BrowseBoot> {
  const fast = resolveSessionNow(now);
  if (fast) return { ...fast, lastPersona: await readLastPersona() };
  const session = readSessionPass();
  const [kept, lastPersona] = await Promise.all([readKeptPass(), readLastPersona()]);
  const resolved = resolvePass({ session, kept, now });
  if (resolved.removeSession) removeSessionPass();
  if (resolved.removeKept) await removeKeptPass();
  return { session: resolved.removeSession ? null : session, resolved, lastPersona };
}
