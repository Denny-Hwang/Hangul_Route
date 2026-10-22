import { GUEST_REOPEN_MS, GUEST_TTL_MS, GUEST_TTL_SHARED_MS, type GuestRecord } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  gateProfiles,
  guestEntry,
  guestExpired,
  guestOnlyGate,
  guestPlayed,
  guestReopens,
  guestResultsActions,
  guestSaveGate,
  guestTelemetryAnonymous,
  guestTtlDays,
  guestTtlMs,
  isLiveGuest,
  newGuestRecord,
  promotionPlan,
  storedGuestAction,
  storedGuestMayLive,
} from '../guest-model';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.3 to 5.5, 6.1, 8.2, 9.2, 12, GU-D9 to GU-D15 (row GU-2, section 19):
 * every pure rule of the guest first quest.
 */
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number): string => new Date(ms).toISOString();

const guest = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: 'profile:guest001', startedAt: iso(T0), lastAt: iso(T0), via: 'site', questDone: false, ...patch });
const child = { id: 'profile:mina0001', role: 'learner' as const };
const self = { id: 'profile:self0001', role: 'learner' as const, learnerType: 'self' as const };
const parent = { id: 'profile:parent01', role: 'parent' as const };

describe('isLiveGuest', () => {
  it('a record whose id is not a profile is live; none, or an id on the list (a saved guest), is not', () => {
    expect(isLiveGuest(guest(), [child])).toBe(true);
    expect(isLiveGuest(null, [child])).toBe(false);
    expect(isLiveGuest(undefined, [])).toBe(false);
    expect(isLiveGuest(guest(), [{ ...self, id: 'profile:guest001' }])).toBe(false);
  });
});

describe('gateProfiles (GU-D14)', () => {
  it('a live guest is one more learner with an unset learnerType (read as a child)', () => {
    expect(gateProfiles([self], guest())).toEqual([self, { id: 'profile:guest001', role: 'learner' }]);
    expect(gateProfiles([], guest())).toEqual([{ id: 'profile:guest001', role: 'learner' }]);
  });

  it('no guest, or a saved one, leaves the list as it is (the same array)', () => {
    const list = [self];
    expect(gateProfiles(list, null)).toBe(list);
    expect(gateProfiles(list, undefined)).toBe(list);
    const saved = [{ ...self, id: 'profile:guest001' }];
    expect(gateProfiles(saved, guest())).toBe(saved);
  });
});

describe('guestOnlyGate (section 9.2)', () => {
  it('a self-only device without a PIN, gated only because of the live guest', () => {
    expect(guestOnlyGate({ profiles: [self], guest: guest(), parentPinHash: null })).toBe(true);
    // Grown-up roles are not learners and do not count.
    expect(guestOnlyGate({ profiles: [self, parent], guest: guest(), parentPinHash: null })).toBe(true);
    // A role-less entry reads as a learner.
    expect(guestOnlyGate({ profiles: [{ learnerType: 'self' }], guest: guest(), parentPinHash: null })).toBe(true);
  });

  it('not with a PIN, not without a live guest, not where a child (or no learner) already gates it', () => {
    expect(guestOnlyGate({ profiles: [self], guest: guest(), parentPinHash: 'salt:hash' })).toBe(false);
    expect(guestOnlyGate({ profiles: [self], guest: null, parentPinHash: null })).toBe(false);
    expect(guestOnlyGate({ profiles: [self, child], guest: guest(), parentPinHash: null })).toBe(false);
    // No learner profile reads as family (F-LEARN-001 L7): the gate was required before the guest.
    expect(guestOnlyGate({ profiles: [], guest: guest(), parentPinHash: null })).toBe(false);
  });
});

describe('guestSaveGate (section 8.2, CS-G9, CS-G10)', () => {
  it('open with no learner and no PIN; verify with a PIN; owner with learners and no PIN', () => {
    expect(guestSaveGate({ profiles: [], parentPinHash: null })).toBe('open');
    expect(guestSaveGate({ profiles: [parent], parentPinHash: null })).toBe('open');
    expect(guestSaveGate({ profiles: [], parentPinHash: 'salt:hash' })).toBe('verify');
    expect(guestSaveGate({ profiles: [child], parentPinHash: 'salt:hash' })).toBe('verify');
    expect(guestSaveGate({ profiles: [self], parentPinHash: null })).toBe('owner');
  });

  it('takes no grown-up session: the same answer whatever the session (the input has none to give)', () => {
    const input = { profiles: [child], parentPinHash: 'salt:hash', sessionOpen: true } as Parameters<typeof guestSaveGate>[0];
    expect(guestSaveGate(input)).toBe('verify');
  });
});

describe('guestTtlMs and guestTtlDays (GU-D13)', () => {
  it('30 days with no learner profile, 7 with one', () => {
    expect(guestTtlMs([])).toBe(GUEST_TTL_MS);
    expect(guestTtlDays([])).toBe(30);
    expect(guestTtlMs([parent])).toBe(GUEST_TTL_MS);
    expect(guestTtlMs([child])).toBe(GUEST_TTL_SHARED_MS);
    expect(guestTtlDays([self])).toBe(7);
  });
});

describe('guestReopens (GU-D12)', () => {
  it('within 30 minutes of the last play, the bound included; not after', () => {
    expect(guestReopens(guest(), T0 + GUEST_REOPEN_MS)).toBe(true);
    expect(guestReopens(guest(), T0 + GUEST_REOPEN_MS + 1)).toBe(false);
  });

  it('a clock that ran backwards counts no time; no record, or no readable time, never reopens', () => {
    expect(guestReopens(guest(), T0 - DAY)).toBe(true);
    expect(guestReopens(null, T0)).toBe(false);
    expect(guestReopens(undefined, T0)).toBe(false);
    expect(guestReopens(guest({ lastAt: 'soon', startedAt: 'earlier' }), T0)).toBe(false);
  });

  it('reads startedAt when lastAt is not a time', () => {
    expect(guestReopens(guest({ lastAt: 'garbled' }), T0 + 60_000)).toBe(true);
  });
});

describe('guestExpired (GU-D13)', () => {
  it('30 days without play with no learner profile; 7 with one', () => {
    expect(guestExpired(guest(), T0 + 30 * DAY, [])).toBe(false);
    expect(guestExpired(guest(), T0 + 30 * DAY + 1, [])).toBe(true);
    expect(guestExpired(guest(), T0 + 7 * DAY, [child])).toBe(false);
    expect(guestExpired(guest(), T0 + 7 * DAY + 1, [child])).toBe(true);
  });

  it('counted from the last play; a clock that ran backwards counts no time; no readable time goes at once', () => {
    expect(guestExpired(guest({ startedAt: iso(T0 - 60 * DAY) }), T0 + DAY, [])).toBe(false);
    expect(guestExpired(guest(), T0 - 90 * DAY, [])).toBe(false);
    expect(guestExpired(guest({ lastAt: 'x', startedAt: 'y' }), T0, [])).toBe(true);
  });
});

describe('storedGuestAction (5.4 step 4, 7.2, GU-D13)', () => {
  it('nothing stored', () => {
    expect(storedGuestAction(null, T0, [])).toEqual({ kind: 'none' });
  });

  it('a live record is kept; a saved one (its id is a profile) is repaired; one past its days is swept', () => {
    expect(storedGuestAction(guest(), T0, [])).toEqual({ kind: 'keep', record: guest() });
    expect(storedGuestAction(guest(), T0, [{ ...self, id: 'profile:guest001' }])).toEqual({ kind: 'repair', record: guest() });
    expect(storedGuestAction(guest({ questDone: true }), T0 + 31 * DAY, [])).toEqual({ kind: 'sweep', id: 'profile:guest001', questDone: true });
    expect(storedGuestAction(guest(), T0 + 8 * DAY, [child])).toEqual({ kind: 'sweep', id: 'profile:guest001', questDone: false });
  });

  it('a record that does not parse is no guest; kept 30 days by its stored time, then swept', () => {
    const broken = { v: 2, id: 'profile:guest001', startedAt: iso(T0), lastAt: iso(T0), via: 'site', questDone: true };
    expect(storedGuestAction(broken, T0 + 30 * DAY, [])).toEqual({ kind: 'unreadable' });
    expect(storedGuestAction(broken, T0 + 30 * DAY + 1, [])).toEqual({ kind: 'sweep', id: 'profile:guest001', questDone: true });
    // Its own days are 30 even on a device with profiles (it is no guest the shorter rule knows).
    expect(storedGuestAction(broken, T0 + 8 * DAY, [child])).toEqual({ kind: 'unreadable' });
  });

  it('a record with no stored time (or not JSON at all) goes at once, with no id to sweep', () => {
    expect(storedGuestAction(undefined, T0, [])).toEqual({ kind: 'sweep', id: null, questDone: false });
    expect(storedGuestAction('text', T0, [])).toEqual({ kind: 'sweep', id: null, questDone: false });
    expect(storedGuestAction({ id: 'profile:guest001' }, T0, [])).toEqual({ kind: 'sweep', id: 'profile:guest001', questDone: false });
  });

  it('a swept id is never one on the profile list, and never one that is not a profile id', () => {
    expect(storedGuestAction({ id: 'profile:mina0001' }, T0, [child])).toEqual({ kind: 'sweep', id: null, questDone: false });
    expect(storedGuestAction({ id: 'progress:x' }, T0, [])).toEqual({ kind: 'sweep', id: null, questDone: false });
    expect(storedGuestAction({ id: 7 }, T0, [])).toEqual({ kind: 'sweep', id: null, questDone: false });
  });
});

describe('storedGuestMayLive (the marker, CS-G6)', () => {
  it('nothing stored: no; a live record: yes; one whose id is on the stored list: no', () => {
    expect(storedGuestMayLive(null, [])).toBe(false);
    expect(storedGuestMayLive(guest(), [{ id: 'profile:mina0001' }])).toBe(true);
    expect(storedGuestMayLive(guest(), [{ id: 'profile:guest001', learnerType: 'self' }])).toBe(false);
  });

  it('fails closed: a record that does not parse may live; a damaged list holds no id', () => {
    expect(storedGuestMayLive({ v: 9 }, [])).toBe(true);
    expect(storedGuestMayLive(undefined, [])).toBe(true);
    expect(storedGuestMayLive(guest(), 'damaged')).toBe(true);
    expect(storedGuestMayLive(guest(), [null, 3, { id: 4 }])).toBe(true);
  });
});

describe('newGuestRecord and guestPlayed', () => {
  it('a new run: started and last played now, not done', () => {
    expect(newGuestRecord('profile:abcd1234', 'chooser', T0)).toEqual({ v: 1, id: 'profile:abcd1234', startedAt: iso(T0), lastAt: iso(T0), via: 'chooser', questDone: false });
  });

  it('a step moves lastAt; questDone latches once true', () => {
    expect(guestPlayed(guest(), T0 + 1000)).toEqual(guest({ lastAt: iso(T0 + 1000) }));
    const done = guestPlayed(guest(), T0 + 1000, true);
    expect(done.questDone).toBe(true);
    expect(guestPlayed(done, T0 + 2000).questDone).toBe(true);
  });
});

describe('guestTelemetryAnonymous (GU-D15, CS-G7)', () => {
  const base = { guest: guest(), profiles: [child], running: false };

  it('in a guest run every event loses its profileId, whatever the id', () => {
    expect(guestTelemetryAnonymous({ ...base, running: true, event: { name: 'quest.complete', profileId: 'profile:guest001', payload: { stars: 3 } } })).toEqual({ name: 'quest.complete', payload: { stars: 3 } });
    expect(guestTelemetryAnonymous({ ...base, running: true, event: { name: 'game.start', profileId: 'profile:mina0001' } })).toEqual({ name: 'game.start' });
    expect(guestTelemetryAnonymous({ ...base, running: true, event: { name: 'guest.started' } })).toEqual({ name: 'guest.started' });
  });

  it('outside a run, an event for the live guest id loses it; another profile keeps its own', () => {
    expect(guestTelemetryAnonymous({ ...base, event: { name: 'onboarding.started', profileId: 'profile:guest001' } })).toEqual({ name: 'onboarding.started' });
    const other = { name: 'session.start' as const, profileId: 'profile:mina0001' };
    expect(guestTelemetryAnonymous({ ...base, event: other })).toBe(other);
  });

  it('a saved guest is an ordinary learner again; no guest at all changes nothing', () => {
    const saved = { name: 'session.start', profileId: 'profile:guest001' };
    expect(guestTelemetryAnonymous({ ...base, profiles: [{ ...self, id: 'profile:guest001' }], event: saved })).toBe(saved);
    expect(guestTelemetryAnonymous({ ...base, guest: null, event: saved })).toBe(saved);
  });

  it('a guest is in no experiment: no exp.exposure in a run or for the guest id', () => {
    expect(guestTelemetryAnonymous({ ...base, running: true, event: { name: 'exp.exposure', payload: {} } })).toBeNull();
    expect(guestTelemetryAnonymous({ ...base, event: { name: 'exp.exposure', profileId: 'profile:guest001' } })).toBeNull();
    const learner = { name: 'exp.exposure', profileId: 'profile:mina0001' };
    expect(guestTelemetryAnonymous({ ...base, event: learner })).toBe(learner);
  });
});

describe('promotionPlan (section 5.4)', () => {
  const form = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, learnerType: 'child' as const };

  it('keeps the guest id and dates the profile from the run start; consent, PIN and email first, then the profile', () => {
    expect(promotionPlan(guest(), { ...form, consent: 'guardian', makesPin: true, email: true }, T0 + DAY)).toEqual({
      id: 'profile:guest001',
      createdAt: iso(T0),
      profile: form,
      steps: ['consent', 'pin', 'email', 'profile', 'forget-guest'],
    });
  });

  it('with each consent state: a consent already given (or a self learner whose consent exists) adds no step', () => {
    expect(promotionPlan(guest(), { ...form, learnerType: 'self', consent: 'self' }, T0).steps).toEqual(['consent', 'profile', 'forget-guest']);
    expect(promotionPlan(guest(), { ...form, consent: null }, T0).steps).toEqual(['profile', 'forget-guest']);
    expect(promotionPlan(guest(), form, T0).steps).toEqual(['profile', 'forget-guest']);
  });

  it('a start that does not read as a time dates it now', () => {
    expect(promotionPlan(guest({ startedAt: 'never' }), form, T0 + DAY).createdAt).toBe(iso(T0 + DAY));
  });
});

describe('guestResultsActions (GU-D8, GU-D10)', () => {
  it('Keep my progress and Not now in the open and verify cases; the ask-the-owner line in the owner case', () => {
    expect(guestResultsActions({ questDone: true, saveGate: 'open' })).toEqual({ keep: true, askOwner: false, notNow: true });
    expect(guestResultsActions({ questDone: true, saveGate: 'verify' })).toEqual({ keep: true, askOwner: false, notNow: true });
    expect(guestResultsActions({ questDone: true, saveGate: 'owner' })).toEqual({ keep: false, askOwner: true, notNow: true });
  });

  it('nothing before quest 1 is done', () => {
    expect(guestResultsActions({ questDone: false, saveGate: 'open' })).toEqual({ keep: false, askOwner: false, notNow: false });
  });
});

describe('guestEntry (section 6.1, CS-G4)', () => {
  const on = { guestLessonEnabled: true };

  it('no try intent, or the switch off: today\'s launch (a live record is kept, unseen)', () => {
    expect(guestEntry({ intent: null, profiles: [], guest: null, flags: on, chooserOn: true })).toEqual({ kind: 'launch' });
    expect(guestEntry({ intent: 'try', profiles: [], guest: guest(), flags: { guestLessonEnabled: false }, chooserOn: true })).toEqual({ kind: 'launch' });
  });

  it('no learner profile: a new run, the live run at quest 1, or at the Not now card once quest 1 is done', () => {
    expect(guestEntry({ intent: 'try', profiles: [], guest: null, flags: on, chooserOn: false })).toEqual({ kind: 'guest', via: 'site', resumed: false, at: 'quest' });
    expect(guestEntry({ intent: 'try', profiles: [parent], guest: guest(), flags: on, chooserOn: false })).toEqual({ kind: 'guest', via: 'site', resumed: true, at: 'quest' });
    expect(guestEntry({ intent: 'try', profiles: [], guest: guest({ questDone: true }), flags: on, chooserOn: false })).toEqual({ kind: 'guest', via: 'site', resumed: true, at: 'later' });
  });

  it('learner profiles (one counts, a live guest or not): the chooser with try when it is on, else today\'s launch; never a guest', () => {
    expect(guestEntry({ intent: 'try', profiles: [self], guest: null, flags: on, chooserOn: true })).toEqual({ kind: 'chooser', trigger: 'try' });
    expect(guestEntry({ intent: 'try', profiles: [child], guest: guest(), flags: on, chooserOn: true })).toEqual({ kind: 'chooser', trigger: 'try' });
    expect(guestEntry({ intent: 'try', profiles: [child], guest: null, flags: on, chooserOn: false })).toEqual({ kind: 'launch' });
  });
});
