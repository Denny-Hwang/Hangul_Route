import { OA_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { effectiveLocks, lockChangedEvent, locksUnreadShown, nextLocks, parseLocks, withoutLock } from '../locks';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-5 (OA-D9, sections 13.1, 13.2, 15; CS-4): what a stored locks value
// means and what the next one is.

const ids = ['profile:mina', 'profile:jun', 'profile:sora'];

describe('[OA] parseLocks (13.2)', () => {
  it('a missing key is no locks; a good record gives its ids, a repeat once and a malformed id dropped', () => {
    expect(parseLocks(null)).toEqual([]);
    expect(parseLocks(undefined)).toEqual([]);
    expect(parseLocks({ v: 1, ids: [] })).toEqual([]);
    expect(parseLocks({ v: 1, ids: ['profile:sora', 'profile:sora', 'Sora'] })).toEqual(['profile:sora']);
  });

  it('a record that does not parse is a failed read, never "no locks"', () => {
    for (const junk of [{ v: 2, ids: [] }, { ids: ['profile:sora'] }, 'profile:sora', 7, [], { v: 1, ids: 'profile:sora' }]) {
      expect(parseLocks(junk), JSON.stringify(junk)).toBe('unread');
    }
  });
});

describe('[OA] effectiveLocks (OA-D9, CS-4)', () => {
  it('the stored ids that name a profile; a stray id is ignored', () => {
    expect(effectiveLocks({ profileIds: ids, read: ['profile:sora', 'profile:gone'], pinSet: true })).toEqual(['profile:sora']);
  });

  it('a lock without a PIN is void, read or not', () => {
    expect(effectiveLocks({ profileIds: ids, read: ['profile:sora'], pinSet: false })).toEqual([]);
    expect(effectiveLocks({ profileIds: ids, read: 'unread', pinSet: false })).toEqual([]);
  });

  it('fails closed: unread with a PIN locks every learner', () => {
    expect(effectiveLocks({ profileIds: ids, read: 'unread', pinSet: true })).toEqual(ids);
  });

  it('the locksUnread line shows only for unread with a PIN', () => {
    expect(locksUnreadShown({ read: 'unread', pinSet: true })).toBe(true);
    expect(locksUnreadShown({ read: 'unread', pinSet: false })).toBe(false);
    expect(locksUnreadShown({ read: [], pinSet: true })).toBe(false);
  });
});

describe('[OA] nextLocks and withoutLock (the write sequence)', () => {
  it('a lock adds the id once; an unlock takes it out; the others stay', () => {
    expect(nextLocks(null, 'profile:sora', true, ids)).toEqual({ v: 1, ids: ['profile:sora'] });
    expect(nextLocks({ v: 1, ids: ['profile:sora'] }, 'profile:sora', true, ids)).toEqual({ v: 1, ids: ['profile:sora'] });
    expect(nextLocks({ v: 1, ids: ['profile:jun', 'profile:sora'] }, 'profile:sora', false, ids)).toEqual({ v: 1, ids: ['profile:jun'] });
    expect(nextLocks({ v: 1, ids: [] }, 'profile:sora', false, ids)).toEqual({ v: 1, ids: [] });
  });

  it('over a broken record, the fail-closed view is written with only the one change: an unlock never opens the others', () => {
    expect(nextLocks({ v: 9 }, 'profile:sora', false, ids)).toEqual({ v: 1, ids: ['profile:mina', 'profile:jun'] });
    expect(nextLocks('junk', 'profile:sora', true, ids)).toEqual({ v: 1, ids: ['profile:mina', 'profile:jun', 'profile:sora'] });
  });

  it('a removed id leaves the record; nothing to write when it was not there, nothing stored, or the record is broken', () => {
    expect(withoutLock({ v: 1, ids: ['profile:jun', 'profile:sora'] }, 'profile:sora')).toEqual({ v: 1, ids: ['profile:jun'] });
    expect(withoutLock({ v: 1, ids: ['profile:jun'] }, 'profile:sora')).toBeUndefined();
    expect(withoutLock(null, 'profile:sora')).toBeUndefined();
    expect(withoutLock({ v: 9 }, 'profile:sora')).toBeUndefined();
  });
});

describe('[OA] profile.lock_changed (section 15)', () => {
  it('carries only locked, and parses against the Worker rule', () => {
    for (const locked of [true, false]) {
      const event = lockChangedEvent(locked);
      expect(event).toEqual({ name: 'profile.lock_changed', payload: { locked } });
      expect(OA_TELEMETRY_PAYLOADS['profile.lock_changed'].safeParse(event.payload).success).toBe(true);
    }
  });
});
