import { GUEST_KEY, GuestRecordSchema, type GuestRecord, type GuestVia } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { guestPlayed, guestTelemetryAnonymous, isLiveGuest, newGuestRecord, storedIdStatus, unreadableGuestId } from '../logic/guest/guest-model';
import { makeProfileId } from '../logic/profiles/profile-model';
import { postProfilesChanged, subscribeProfilesChanged } from '../platform/profiles-channel';
import { readJsonExact, readJsonStrict, removeKey, writeJson } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { setTelemetryProfileFilter } from '../platform/telemetry-filter';
import { closeGrownUpSession } from './grown-up-session';
import { sweepProfileKeys } from './profile-key-sweep';
import { notifyProfileRemoved } from './profile-removal';
import { PROFILES_KEY, PROFILE_TOMBSTONES_KEY, useProfileStore } from './profile-store';

/**
 * [GU] The guest first quest at run time (AMENDMENTS-GUEST-FIRST-LESSON sections 5.3, 6.4, 7.2, GU-D1 to GU-D3,
 * GU-D12, GU-D15; row GU-2). The record lives in `hr:guest` through platform/storage, outside `hr:profiles`, so the
 * profile list, sync and backups never see it (CS-G7). Every write runs inside the `hr:profiles` Web Lock (OA-D19) and
 * posts `hr-profiles` `changed`, so a second tab adopts the live record (one guest per device, GU-D3). `running` is
 * memory only: this tab is in a guest run. The rules are pure in `logic/guest/guest-model.ts`; the boot's repair and
 * sweep are `store/guest-sweep.ts`. Always on: nothing here reads a switch.
 */

interface State {
  /** The device's guest record, or none. A record that does not parse reads as none (section 7.2). */
  record: GuestRecord | null;
  /** This tab is in a guest run (memory only, never stored). */
  running: boolean;
  /** `hr:guest` has been read at boot (`hydrateGuest`). */
  hydrated: boolean;
  /** The last write of the record failed (some private windows): the run goes on in memory only (section 7.2). */
  memoryOnly: boolean;
}

/** How a run is entered (section 5.3): one of the record's `via` values, or a reopen of the live record (GU-D12). */
export type GuestStart = GuestVia | 'reopen';

/** What `startGuestRun` began: the record, and whether it was the live one (`resumed`) or a new one. */
export interface GuestRunStarted {
  record: GuestRecord;
  resumed: boolean;
}

interface Actions {
  /**
   * Section 5.3, CS-G3: starts or resumes the guest run. Always first `closeGrownUpSession()` (for every `via` and for
   * a reopen), then, under the `hr:profiles` lock, adopts the live record as it is (its `lastAt` moves only with play,
   * `recordGuestPlay`, GU-D12, GU-D13), or writes a new one with a fresh id and posts `hr-profiles` `changed`; then
   * sets `running`. Never selects a profile (`profile-store.setActive` is never called). A reopen with no live record
   * starts nothing (`null`). A write that fails keeps the run in memory (`memoryOnly`). A new record written over one
   * that does not parse first removes the keys of the id that record still names (`unreadableGuestId`), as the sweep
   * would, so nothing is left under an id no record names.
   */
  startGuestRun: (via: GuestStart, now?: number) => Promise<GuestRunStarted | null>;
  /** GU-D12: a quest step entered or finished: `lastAt` moves to now, `questDone` once quest 1 is finished. */
  recordGuestPlay: (patch?: { questDone?: boolean }, now?: number) => Promise<void>;
  /** Section 5.3: the run ends (Close, leave, Not now's Close, a chooser pick, the save). The record stays. */
  endGuestRun: () => void;
  /** Section 6.4: another tab changed `hr:guest` (or saved the guest): read it again; a run whose record went ends. */
  refresh: () => Promise<void>;
  /** Section 5.4 step 3: after `promoteGuest`, `hr:guest` is deleted (under the lock) and the run ends. */
  forgetSavedGuest: (id: string) => Promise<void>;
}

type StoredRead = { ok: true; raw: unknown } | { ok: false };

/**
 * The stored `hr:guest`, exactly: `null` when missing, `undefined` when present but not JSON. `ok: false` when the
 * storage could not be read (nothing is decided or written over data that was not seen).
 */
export async function readStoredGuest(): Promise<StoredRead> {
  try {
    return { ok: true, raw: await readJsonExact<unknown>(GUEST_KEY) };
  } catch {
    try {
      // The exact read threw: a value that is not JSON reads as null here, a failed read throws again.
      await readJsonStrict<unknown>(GUEST_KEY);
      return { ok: true, raw: undefined };
    } catch {
      return { ok: false };
    }
  }
}

/** The stored record when it parses, else none. */
const parsedRecord = (raw: unknown): GuestRecord | null => {
  const parsed = GuestRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

/** A fresh ordinary profile id (GU-D2) that no profile here holds. */
function freshGuestId(): string {
  const taken = new Set(useProfileStore.getState().profiles.map((p) => p.id));
  for (;;) {
    const id = makeProfileId(Math.random().toString(36).slice(2, 10).padEnd(8, '0'));
    if (!taken.has(id)) return id;
  }
}

/**
 * Section 7.2, GU-D13: before a start writes over a stored record that does not parse, the id it still names loses
 * its keys (every per-profile store forgets it, then the OA-7a key sweep), as the boot's sweep would remove them. Only
 * when the stored profile list and tombstones read exactly and neither holds the id (a saved or removed learner's
 * keys are never touched). Never throws.
 */
async function sweepUnreadable(raw: unknown, profiles: readonly { id: string }[]): Promise<void> {
  const id = unreadableGuestId(raw, profiles);
  if (id === null) return;
  try {
    const [rawProfiles, rawTombstones] = await Promise.all([readJsonExact<unknown>(PROFILES_KEY), readJsonExact<unknown>(PROFILE_TOMBSTONES_KEY)]);
    if (storedIdStatus(id, rawProfiles, rawTombstones) !== 'unknown') return;
    hideGuestIdWhile(id, () => notifyProfileRemoved(id));
    await sweepProfileKeys([id]);
  } catch {
    // A list that cannot be read decides nothing: the keys stay.
  }
}

/** Writes the record; answers whether it is stored. Never throws. */
async function store(record: GuestRecord): Promise<boolean> {
  try {
    await writeJson(GUEST_KEY, record);
    return true;
  } catch {
    return false;
  }
}

export const useGuestStore = create<State & Actions>((set, get) => ({
  record: null,
  running: false,
  hydrated: false,
  memoryOnly: false,

  startGuestRun: async (via, now = Date.now()) => {
    // CS-G3: a grown-up session never continues into a guest run, from any entry.
    closeGrownUpSession();
    return withTabLock(PROFILES_LOCK, async () => {
      const read = await readStoredGuest();
      const profiles = useProfileStore.getState().profiles;
      const stored = read.ok ? parsedRecord(read.raw) : null;
      // The live record: the stored one; else this tab's own when storage could not be read or it is held in memory only.
      const held = get().record;
      const ownHeld = (!read.ok || get().memoryOnly) && isLiveGuest(held, profiles) ? held : null;
      const live = isLiveGuest(stored, profiles) ? stored : ownHeld;
      if (live !== null) {
        // Adopted as it is: nothing is written, and a run held in memory stays there.
        set({ record: live, running: true, memoryOnly: live !== stored });
        return { record: live, resumed: true };
      }
      if (via === 'reopen') return null;
      const record = newGuestRecord(freshGuestId(), via, now);
      if (read.ok && read.raw !== null && stored === null) await sweepUnreadable(read.raw, profiles);
      // A record storage could not read is never written over (the run goes on in memory).
      const saved = read.ok ? await store(record) : false;
      set({ record, running: true, memoryOnly: !saved });
      if (saved) postProfilesChanged();
      return { record, resumed: false };
    });
  },

  recordGuestPlay: async (patch = {}, now = Date.now()) => {
    await withTabLock(PROFILES_LOCK, async () => {
      const current = get().record;
      if (current === null || !isLiveGuest(current, useProfileStore.getState().profiles)) return;
      const record = guestPlayed(current, now, patch.questDone === true);
      set({ record });
      if (get().memoryOnly) return;
      const saved = await store(record);
      if (saved) postProfilesChanged();
      else set({ memoryOnly: true });
    });
  },

  endGuestRun: () => {
    if (get().running) set({ running: false });
  },

  refresh: async () => {
    if (!get().hydrated) return;
    const read = await readStoredGuest();
    if (!read.ok) return;
    const profiles = useProfileStore.getState().profiles;
    const stored = parsedRecord(read.raw);
    const record = isLiveGuest(stored, profiles) ? stored : null;
    const { record: current, running, memoryOnly } = get();
    // A record held in memory only stays this tab's while storage holds no live record of its own.
    if (record === null && memoryOnly && isLiveGuest(current, profiles)) return;
    // Section 6.4: the record went (saved, removed or swept in another tab), or is another run: this tab's run ends.
    const same = record !== null && current !== null && record.id === current.id;
    set({ record, running: running && same, memoryOnly: memoryOnly && same });
  },

  forgetSavedGuest: async (id) => {
    await withTabLock(PROFILES_LOCK, async () => {
      const read = await readStoredGuest();
      const stored = read.ok ? parsedRecord(read.raw) : null;
      // Only the saved guest's record goes (or one that does not parse); another run started since is kept.
      if (read.ok && read.raw !== null && (stored === null || stored.id === id)) await removeKey(GUEST_KEY).catch(() => undefined);
      if (get().record?.id === id) set({ record: null, running: false, memoryOnly: false });
      postProfilesChanged();
    });
  },
}));

/** The live guest's id while one exists on this device (a record whose id is not a profile here), else null. */
export function liveGuestId(): string | null {
  const { record } = useGuestStore.getState();
  return isLiveGuest(record, useProfileStore.getState().profiles) ? record.id : null;
}

/** Whether `learnerId` is the live guest's id: no profile record, never synced, never in a backup (CS-G7). */
export function isLiveGuestId(learnerId: string): boolean {
  return liveGuestId() === learnerId;
}

/**
 * Section 6.4: another tab wrote `hr:guest` or `hr:profiles` (on `hr-profiles`, and when the page is back in front):
 * read the record again. Bound once by App.tsx; returns the unsubscribe.
 */
export function followGuestChanges(): () => void {
  return subscribeProfilesChanged(() => {
    useGuestStore.getState().refresh().catch(() => undefined);
  });
}

/** The guest id a sweep is removing (the record is no longer in the store), so `track()` still keeps it out. */
let removing: string | null = null;

/**
 * GU-D15: runs `step` with `guestId` treated as the live guest's by the telemetry filter, for the sweep's removal (the
 * record is gone from the store by then): an event a removal listener sends with the id goes without it.
 */
export function hideGuestIdWhile<T>(guestId: string, step: () => T): T {
  const before = removing;
  removing = guestId;
  try {
    return step();
  } finally {
    removing = before;
  }
}

// GU-D15, CS-G7: every event `track()` sends passes the guest rule first (no `profileId` in a guest run or for the live
// guest's id; no experiment exposure for a guest). Registered when this module loads, which the learner boot does.
setTelemetryProfileFilter((event) => {
  const { record, running } = useGuestStore.getState();
  const profiles = useProfileStore.getState().profiles;
  if (removing !== null && event.profileId === removing) return guestTelemetryAnonymous({ event, guest: null, profiles, running: true });
  return guestTelemetryAnonymous({ event, guest: record, profiles, running });
});
