import { keptPassActive, keptPassFor } from '../logic/browse/pass';
import { parsePrefs, type BrowsePrefs } from '../logic/browse/prefs';
import { readSessionPass } from './browse';
import { BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY, readKeptPass, removeKeptPass } from './browse-boot';
import { readJson, removeKey, requestPersistence, writeJson } from './storage';

/**
 * Keep on this device (F-BROWSE-001 section 4.3, OD-4; mock
 * `design/screens/browse/home.md`, the keep switch). Off by default. On, it
 * writes `{ v: 1, scope, keptAt }` to `browse:pass` and the Lesson display
 * settings to `browse:prefs`, and asks for persistent storage once (the only
 * time All lessons asks, section 4.12). It keeps only the tab's session pass
 * while it is still active (`keptPassFor`: an account pass that is not a
 * fallback). Off, it removes both keys; the tab keeps the pass it resolved in
 * memory until it closes or reloads (`BrowseApp`). Both keys are on the
 * browse write fence's allow-list; nothing here reads or writes a learner key.
 */

let persistenceAsked = false;

/** Turns the switch on: `true` once the pass and the settings are written. */
export async function keepOn(now: number, prefs: BrowsePrefs): Promise<boolean> {
  const session = readSessionPass();
  const kept = session ? keptPassFor(session, now) : null;
  if (!kept) return false;
  try {
    await writeJson(BROWSE_KEPT_PASS_KEY, kept);
    await writeJson(BROWSE_PREFS_KEY, prefs);
  } catch {
    return false;
  }
  if (!persistenceAsked) {
    persistenceAsked = true;
    void requestPersistence();
  }
  return true;
}

/** Turns the switch off: removes the kept pass and its settings. */
export function keepOff(): Promise<void> {
  return removeKeptPass();
}

/** Writes the Lesson display settings, only while the switch is on (section 4.9). */
export async function savePrefs(kept: boolean, prefs: BrowsePrefs): Promise<void> {
  if (!kept) return;
  await writeJson(BROWSE_PREFS_KEY, prefs).catch(() => undefined);
}

/**
 * Whether the switch is on (an active kept pass on this device) and, when it
 * is, the kept settings. An expired kept pass is removed with its settings;
 * corrupt settings are removed and read as none.
 */
export async function readKeepState(now: number): Promise<{ kept: boolean; prefs: BrowsePrefs | null }> {
  const pass = await readKeptPass();
  if (!pass) return { kept: false, prefs: null };
  if (!keptPassActive(pass, now)) {
    await removeKeptPass();
    return { kept: false, prefs: null };
  }
  const raw = await readJson<unknown>(BROWSE_PREFS_KEY);
  if (raw === null || raw === undefined) return { kept: true, prefs: null };
  const prefs = parsePrefs(raw);
  if (!prefs) await removeKey(BROWSE_PREFS_KEY).catch(() => undefined);
  return { kept: true, prefs };
}
