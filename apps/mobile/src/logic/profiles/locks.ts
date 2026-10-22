import { ProfileLocksSchema, type ProfileLocks } from '@hangul-route/content-schema';
import type { GateEvent } from './gate-events';

/**
 * [OA] Locked learner profiles (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D9, sections 6.1, 6.3, 13.1, 13.2; row OA-5).
 * Pure: the store (`store/profile-locks.ts`) reads and writes `hr:profiles:locks`; these rules say what a stored
 * value means and what the next one is. Locks are local, never synced, and never inside `ProfileSchema`. They use the
 * grown-up PIN (OQ-4): a lock without a PIN is void.
 */

/** What a read of `hr:profiles:locks` gave: the locked ids, or `unread` (a failed read, or a record that does not parse). */
export type LocksRead = readonly string[] | 'unread';

/**
 * A stored value as locks: a missing key is no locks; a value that does not parse is `unread`, never "no locks"
 * (13.2). A repeated or malformed id inside a good record is dropped by `ProfileLocksSchema`, not the record.
 */
export function parseLocks(raw: unknown): LocksRead {
  if (raw === null || raw === undefined) return [];
  const parsed = ProfileLocksSchema.safeParse(raw);
  return parsed.success ? parsed.data.ids : 'unread';
}

export interface LocksView {
  /** The learner profile ids of the device. */
  profileIds: readonly string[];
  read: LocksRead;
  /** Whether a grown-up PIN is stored on the device. */
  pinSet: boolean;
}

/**
 * The ids that count as locked now. Without a PIN, none (a lock without a PIN is void, CS-4). While the record cannot
 * be read, every learner (fail closed, 13.2). Otherwise the stored ids that still name a profile (a stray id is
 * ignored).
 */
export function effectiveLocks({ profileIds, read, pinSet }: LocksView): string[] {
  if (!pinSet) return [];
  if (read === 'unread') return [...profileIds];
  const locked = new Set(read);
  return profileIds.filter((id) => locked.has(id));
}

/** Whether the screen shows `learner.who.locksUnread` instead of a caption per tile: unread, with a PIN. */
export function locksUnreadShown({ read, pinSet }: Pick<LocksView, 'read' | 'pinSet'>): boolean {
  return pinSet && read === 'unread';
}

/**
 * The record a lock or unlock writes over `current` (the stored value at the moment of the write). Over a record
 * that does not parse, the grown-up saw every learner locked (fail closed), so that view is what gets written, with
 * only the one change they made: an unlock never opens the others.
 */
export function nextLocks(current: unknown, id: string, locked: boolean, profileIds: readonly string[]): ProfileLocks {
  const read = parseLocks(current);
  const base = read === 'unread' ? profileIds : read;
  const ids = base.filter((other) => other !== id);
  return { v: 1, ids: locked ? [...ids, id] : ids };
}

/**
 * The record after `id` was removed from the device (same write sequence as the removal, 13.2), or `undefined` for
 * no write: nothing stored, the id not in it, or a record that does not parse (left for the next lock change).
 */
export function withoutLock(current: unknown, id: string): ProfileLocks | undefined {
  const read = parseLocks(current);
  if (read === 'unread' || !read.includes(id)) return undefined;
  return { v: 1, ids: read.filter((other) => other !== id) };
}

/** `profile.lock_changed` (section 15): only whether the profile is now locked; no `profileId`, no name. */
export function lockChangedEvent(locked: boolean): GateEvent {
  return { name: 'profile.lock_changed', payload: { locked } };
}
