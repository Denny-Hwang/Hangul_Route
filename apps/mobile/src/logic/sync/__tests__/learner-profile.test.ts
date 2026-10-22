import type { Profile } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { changedServerFields, hasFields, mergePending, queueRepair, sendableFields, serverFieldsOf, serverName, serverProfileChanges, shouldPullServerProfile } from '../learner-profile';

const profile: Profile = { id: 'profile:a', displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't', learnerType: 'self' };

describe('logic/sync/learner-profile (F-PROF-001)', () => {
  it('serverFieldsOf and changedServerFields carry only name, level and avatar', () => {
    expect(serverFieldsOf(profile)).toEqual({ displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange' });
    // A legacy record an older bundle wrote may still carry a per-profile PIN hash (row OA-10): it is never a server field.
    expect(changedServerFields(profile, { ...profile, learnerType: 'child', parentPinHash: 'x' } as Profile)).toEqual({});
    expect(changedServerFields(profile, { ...profile, displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-blue' })).toEqual({ displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-blue' });
  });

  it('hasFields', () => {
    expect(hasFields({})).toBe(false);
    expect(hasFields({ avatar: 'hoya-blue' })).toBe(true);
  });

  it('mergePending folds a newer edit over the waiting one and drops anything else', () => {
    const first = mergePending(null, { displayName: 'A' }, 't1');
    expect(first).toEqual({ fields: { displayName: 'A' }, at: 't1' });
    const extra = { learnerType: 'self' } as unknown as Record<string, never>;
    expect(mergePending(first, { displayName: 'B', ageGroup: '8-9', ...extra }, 't2')).toEqual({ fields: { displayName: 'B', ageGroup: '8-9' }, at: 't2' });
  });

  it('queueRepair queues the current values as repair values, except fields a waiting edit carries', () => {
    expect(queueRepair(null, { displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange' }, 't1')).toEqual({ fields: {}, at: 't1', repair: { displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange' } });
    expect(queueRepair({ fields: { displayName: 'Sungjoo' }, at: 't0' }, { displayName: 'Sungjoo', ageGroup: '5-7' }, 't1')).toEqual({ fields: { displayName: 'Sungjoo' }, at: 't1', repair: { ageGroup: '5-7' } });
    expect(queueRepair({ fields: { displayName: 'Sungjoo' }, at: 't0' }, { displayName: 'Sungjoo' }, 't1')).toEqual({ fields: { displayName: 'Sungjoo' }, at: 't1' });
  });

  it('mergePending moves an edited field out of the repair values and keeps the rest', () => {
    const repaired = queueRepair(null, { displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange' }, 't1');
    expect(mergePending(repaired, { ageGroup: '8-9' }, 't2')).toEqual({ fields: { ageGroup: '8-9' }, at: 't2', repair: { displayName: 'Sungjoo', avatar: 'hoya-orange' } });
    expect(mergePending({ fields: {}, at: 't1', repair: { avatar: 'hoya-orange' } }, { avatar: 'hoya-blue' }, 't2')).toEqual({ fields: { avatar: 'hoya-blue' }, at: 't2' });
  });

  it('serverProfileChanges skips a level the server row has as null', () => {
    expect(serverProfileChanges(profile, { displayName: 'test', ageGroup: null, avatar: 'hoya-orange' })).toEqual({});
  });

  it('serverName is the Worker rule (legacy, 1-20, no control, zero-width or direction characters), trimmed', () => {
    for (const name of ['Sungjoo', 'Alexandria Mae', 'Mina_K', 'A'.repeat(20)]) expect(serverName(name), name).toBe(name);
    expect(serverName('  Sungjoo  ')).toBe('Sungjoo');
    for (const name of ['', '   ', 'A'.repeat(21), 'Sun\nJoo', 'Sun\u202EJoo', 'Sun\u200BJoo']) expect(serverName(name), JSON.stringify(name)).toBeNull();
  });

  it('sendableFields keeps only values the Worker accepts, trimmed; a legacy name still goes up', () => {
    expect(sendableFields({ displayName: ' Sungjoo ', ageGroup: '8-9', avatar: 'hoya-blue' })).toEqual({ displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-blue' });
    expect(sendableFields({ displayName: 'Alexandria Mae' })).toEqual({ displayName: 'Alexandria Mae' });
    expect(sendableFields({ displayName: 'A'.repeat(21), ageGroup: 'adult' as never, avatar: 'x' as never })).toEqual({});
  });

  it('serverProfileChanges takes differing values that pass the local rules', () => {
    expect(serverProfileChanges(profile, { displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-blue' })).toEqual({ displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-blue' });
    expect(serverProfileChanges(profile, { displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange' })).toEqual({});
    expect(serverProfileChanges(profile, { displayName: 'Sun\u202EJoo', ageGroup: 'adult', avatar: 'nope' })).toEqual({});
    expect(serverProfileChanges(profile, { displayName: 'Alexandria Mae', ageGroup: '5-7', avatar: 'hoya-orange' })).toEqual({ displayName: 'Alexandria Mae' });
  });

  it('shouldPullServerProfile: only a server edit newer than ours, never over a waiting edit', () => {
    const at = '2026-10-14T10:00:00.000Z';
    expect(shouldPullServerProfile({ profileUpdatedAt: at, pending: null, profileAt: null })).toBe(true);
    expect(shouldPullServerProfile({ profileUpdatedAt: at, pending: { fields: {}, at: 't' }, profileAt: null })).toBe(false);
    expect(shouldPullServerProfile({ profileUpdatedAt: null, pending: null, profileAt: null })).toBe(false);
    expect(shouldPullServerProfile({ profileUpdatedAt: 'garbage', pending: null, profileAt: null })).toBe(false);
    expect(shouldPullServerProfile({ profileUpdatedAt: at, pending: null, profileAt: at })).toBe(false);
    expect(shouldPullServerProfile({ profileUpdatedAt: at, pending: null, profileAt: '2026-10-14T11:00:00.000Z' })).toBe(false);
    expect(shouldPullServerProfile({ profileUpdatedAt: at, pending: null, profileAt: '2026-10-14T09:00:00.000Z' })).toBe(true);
    expect(shouldPullServerProfile({ profileUpdatedAt: at, pending: null, profileAt: 'garbage' })).toBe(true);
  });
});
