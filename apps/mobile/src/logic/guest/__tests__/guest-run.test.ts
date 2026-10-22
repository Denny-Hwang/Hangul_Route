import { GUEST_REOPEN_MS, type GuestRecord } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { guestEntry, guestResultsActions } from '../guest-model';
import {
  guestLaunchPlan,
  guestLeaveState,
  guestLeaveTarget,
  guestQuestExits,
  guestResultsState,
  guestScreenFor,
  guestSecondsIn,
  isFirstLetterStep,
  type GuestLaunchInput,
} from '../guest-run';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.1, 6.2, 6.4, 7.1 and 12 (row GU-3, section 19): the guest run's launch,
 * its first screen, the first-letter bucket, the leave targets and the quest player's guest ports.
 */
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const iso = (ms: number): string => new Date(ms).toISOString();
const guest = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: 'profile:guest001', startedAt: iso(T0), lastAt: iso(T0), via: 'site', questDone: false, ...patch });
const child = { id: 'profile:mina0001', role: 'learner' as const };
const parent = { id: 'profile:parent01', role: 'parent' as const };

const input = (patch: Partial<GuestLaunchInput> = {}): GuestLaunchInput => ({
  intent: { kind: 'try' },
  profiles: [],
  guest: null,
  guestLessonEnabled: true,
  chooserOn: true,
  joinHeld: false,
  now: T0,
  ...patch,
});

describe('guestLaunchPlan: the table of section 6.1', () => {
  it('no learner profile, no live guest: a new run from the site', () => {
    expect(guestLaunchPlan(input())).toEqual({ kind: 'start', take: true });
    // A grown-up role is not a learner (GU-D7 counts learner profiles).
    expect(guestLaunchPlan(input({ profiles: [parent] }))).toEqual({ kind: 'start', take: true });
  });

  it('no learner profile, a live guest (quest 1 done or not): the run is resumed from the site', () => {
    expect(guestLaunchPlan(input({ guest: guest() }))).toEqual({ kind: 'start', take: true });
    expect(guestLaunchPlan(input({ guest: guest({ questDone: true }), now: T0 + 40 * 24 * 60 * 60 * 1000 }))).toEqual({ kind: 'start', take: true });
  });

  it('learner profiles: the chooser with the try trigger when it is on, else today\'s launch; never a guest (CS-G4)', () => {
    expect(guestLaunchPlan(input({ profiles: [child] }))).toEqual({ kind: 'chooser', take: true });
    expect(guestLaunchPlan(input({ profiles: [child], guest: guest() }))).toEqual({ kind: 'chooser', take: true });
    expect(guestLaunchPlan(input({ profiles: [child], chooserOn: false }))).toEqual({ kind: 'none', take: true });
  });

  it('the switch off: try is taken and dropped, a live record kept, nothing reopens', () => {
    expect(guestLaunchPlan(input({ guestLessonEnabled: false, guest: guest() }))).toEqual({ kind: 'none', take: true });
    expect(guestLaunchPlan(input({ guestLessonEnabled: false, intent: null, guest: guest() }))).toEqual({ kind: 'none', take: false });
  });

  it('a held join code wins (OA-D20): try is taken and nothing starts', () => {
    expect(guestLaunchPlan(input({ joinHeld: true }))).toEqual({ kind: 'none', take: true });
  });

  it('who=1 with try: on a device with no learner profile it starts the run; on a shared one it is the chooser\'s, untouched', () => {
    expect(guestLaunchPlan(input({ intent: { kind: 'who', try: true } }))).toEqual({ kind: 'start', take: true });
    expect(guestLaunchPlan(input({ intent: { kind: 'who', try: true }, profiles: [child] }))).toEqual({ kind: 'none', take: false });
    expect(guestLaunchPlan(input({ intent: { kind: 'who' } }))).toEqual({ kind: 'none', take: false });
  });

  it('a gate or join intent is the hook\'s: no run starts or reopens beside it', () => {
    for (const intent of [{ kind: 'grown-up', next: '/parent' }, { kind: 'browse' }, { kind: 'pin-reset' }, { kind: 'join', code: 'ABC234' }] as const) {
      expect(guestLaunchPlan(input({ intent, guest: guest() })), intent.kind).toEqual({ kind: 'none', take: false });
    }
  });
});

describe('guestLaunchPlan: reload and return (section 6.4, GU-D12)', () => {
  it('no intent, no learner profile, the last play within 30 minutes: the live run reopens (no guest.started)', () => {
    expect(guestLaunchPlan(input({ intent: null, guest: guest(), now: T0 + GUEST_REOPEN_MS }))).toEqual({ kind: 'reopen', take: false });
    expect(guestLaunchPlan(input({ intent: null, guest: guest({ questDone: true }), now: T0 + 60_000 }))).toEqual({ kind: 'reopen', take: false });
  });

  it('later than 30 minutes: today\'s launch (Welcome shows the waiting card)', () => {
    expect(guestLaunchPlan(input({ intent: null, guest: guest(), now: T0 + GUEST_REOPEN_MS + 1 }))).toEqual({ kind: 'none', take: false });
  });

  it('no live guest, a saved one (its id is a profile), or a device with learner profiles: nothing reopens', () => {
    expect(guestLaunchPlan(input({ intent: null }))).toEqual({ kind: 'none', take: false });
    expect(guestLaunchPlan(input({ intent: null, guest: guest({ id: child.id }), profiles: [child] }))).toEqual({ kind: 'none', take: false });
    expect(guestLaunchPlan(input({ intent: null, guest: guest(), profiles: [child] }))).toEqual({ kind: 'none', take: false });
  });
});

describe('guestEntry and guestResultsActions (row GU-2 rules this row acts on)', () => {
  it('guestEntry answers the 6.1 rows guestLaunchPlan builds on', () => {
    const on = { guestLessonEnabled: true };
    expect(guestEntry({ intent: 'try', profiles: [], guest: null, flags: on, chooserOn: true })).toMatchObject({ kind: 'guest', resumed: false, at: 'quest' });
    expect(guestEntry({ intent: 'try', profiles: [], guest: guest(), flags: on, chooserOn: true })).toMatchObject({ kind: 'guest', resumed: true, at: 'quest' });
    expect(guestEntry({ intent: 'try', profiles: [], guest: guest({ questDone: true }), flags: on, chooserOn: true })).toMatchObject({ kind: 'guest', resumed: true, at: 'later' });
  });

  it('guestResultsActions for each save case once quest 1 is done', () => {
    expect(guestResultsActions({ questDone: true, saveGate: 'open' })).toEqual({ keep: true, askOwner: false, notNow: true });
    expect(guestResultsActions({ questDone: true, saveGate: 'verify' })).toEqual({ keep: true, askOwner: false, notNow: true });
    expect(guestResultsActions({ questDone: true, saveGate: 'owner' })).toEqual({ keep: false, askOwner: true, notNow: true });
  });
});

describe('guestScreenFor', () => {
  it('quest 1 from step 1, or the Not now card once quest 1 is done', () => {
    expect(guestScreenFor(guest())).toBe('QuestPlayer');
    expect(guestScreenFor(guest({ questDone: true }))).toBe('GuestLater');
  });
});

describe('guestSecondsIn (section 12)', () => {
  it('buckets the seconds since the run began; a clock that ran backwards reads 0', () => {
    expect(guestSecondsIn(-5_000)).toBe('0-15');
    expect(guestSecondsIn(0)).toBe('0-15');
    expect(guestSecondsIn(14_999)).toBe('0-15');
    expect(guestSecondsIn(15_000)).toBe('15-30');
    expect(guestSecondsIn(29_999)).toBe('15-30');
    expect(guestSecondsIn(30_000)).toBe('30-60');
    expect(guestSecondsIn(59_999)).toBe('30-60');
    expect(guestSecondsIn(60_000)).toBe('60+');
    expect(guestSecondsIn(3_600_000)).toBe('60+');
  });
});

describe('isFirstLetterStep (section 6.2)', () => {
  const steps = [{ kind: 'intro' }, { kind: 'discover' }, { kind: 'minigame' }, { kind: 'discover' }];
  it('only the quest\'s first Discover step', () => {
    expect(isFirstLetterStep(steps, 1)).toBe(true);
    expect(isFirstLetterStep(steps, 0)).toBe(false);
    expect(isFirstLetterStep(steps, 3)).toBe(false);
    expect(isFirstLetterStep([{ kind: 'intro' }], 0)).toBe(false);
    expect(isFirstLetterStep(undefined, 1)).toBe(false);
  });
});

describe('guestLeaveTarget and guestLeaveState (section 6.4)', () => {
  it('Welcome with no learner profile; the chooser with profiles while it is on; else Home', () => {
    expect(guestLeaveTarget({ profiles: [], chooserOn: true })).toBe('welcome');
    expect(guestLeaveTarget({ profiles: [parent], chooserOn: false })).toBe('welcome');
    expect(guestLeaveTarget({ profiles: [child], chooserOn: true })).toBe('chooser');
    expect(guestLeaveTarget({ profiles: [child], chooserOn: false })).toBe('home');
  });

  it('the root holds that one route, so nothing of the Guest stack stays under it', () => {
    expect(guestLeaveState('welcome')).toEqual({ index: 0, routes: [{ name: 'Onboarding' }] });
    expect(guestLeaveState('chooser')).toEqual({ index: 0, routes: [{ name: 'WhoIsUsing', params: { trigger: 'manual' } }] });
    expect(guestLeaveState('home')).toEqual({ index: 0, routes: [{ name: 'Main' }] });
  });
});

describe('guestQuestExits (section 7.1)', () => {
  const result = { stars: 3 as const, correct: 5, total: 5, retries: 1, accuracy: 1 } as unknown as Parameters<typeof guestResultsState>[2];

  it('a finished run resets the Guest stack to Results alone', () => {
    const toResults = vi.fn();
    const exits = guestQuestExits({ questId: 'q1', episodeId: 'e1', toResults, leave: vi.fn(), track: vi.fn() });
    exits.finish(result);
    expect(toResults).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Results', params: { questId: 'q1', episodeId: 'e1', stars: 3, correct: 5, total: 5, retries: 1 } }] });
  });

  it('Leave ends the run through the guest exit; events go out with no profileId', () => {
    const leave = vi.fn();
    const track = vi.fn();
    const exits = guestQuestExits({ questId: 'q1', episodeId: 'e1', toResults: vi.fn(), leave, track });
    exits.leave();
    expect(leave).toHaveBeenCalledTimes(1);
    exits.track({ name: 'quest.discover_completed', payload: { questId: 'q1' } } as never);
    expect(track).toHaveBeenCalledWith({ name: 'quest.discover_completed', payload: { questId: 'q1' } });
    expect(track.mock.calls[0]?.[0]).not.toHaveProperty('profileId');
  });
});
