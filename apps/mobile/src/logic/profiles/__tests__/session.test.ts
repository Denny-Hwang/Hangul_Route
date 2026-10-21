import { GROWN_UP_BACKGROUND_MS, GROWN_UP_FRESH_PIN_MS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  PARENT_SESSION_MS,
  areaExitTracker,
  areaLeaveRoutes,
  backgroundLapsed,
  closeOnChooser,
  closesSession,
  needsFreshPin,
  routeZone,
  canEnterPicker,
  canSwitchProfileFrom,
  closeParentSession,
  isParentSessionValid,
  openParentSession,
  parentSessionRemainingMs,
  planProfileSwitch,
} from '../session';

const T0 = 1_700_000_000_000;
const PARENT_ID = 'profile:parent1';

describe('parent session window', () => {
  it('a freshly opened session is valid and records who opened it', () => {
    const session = openParentSession(PARENT_ID, T0);
    expect(session.profileId).toBe(PARENT_ID);
    expect(isParentSessionValid(session, T0)).toBe(true);
    expect(parentSessionRemainingMs(session, T0)).toBe(PARENT_SESSION_MS);
  });

  it('stays valid up to 15 minutes and expires exactly at the boundary', () => {
    const session = openParentSession(PARENT_ID, T0);
    expect(isParentSessionValid(session, T0 + PARENT_SESSION_MS - 1)).toBe(true);
    expect(isParentSessionValid(session, T0 + PARENT_SESSION_MS)).toBe(false);
    expect(parentSessionRemainingMs(session, T0 + PARENT_SESSION_MS)).toBe(0);
  });

  it('treats a null session as invalid', () => {
    expect(isParentSessionValid(null, T0)).toBe(false);
    expect(parentSessionRemainingMs(null, T0)).toBe(0);
    expect(closeParentSession()).toBeNull();
  });

  it('rejects a session timestamped in the future (clock moved backwards)', () => {
    const session = openParentSession(PARENT_ID, T0);
    expect(isParentSessionValid(session, T0 - 1)).toBe(false);
  });
});

describe('switch reachability', () => {
  it('is offered from home only', () => {
    expect(canSwitchProfileFrom('home')).toBe(true);
    expect(canSwitchProfileFrom('quest')).toBe(false);
    expect(canSwitchProfileFrom('minigame')).toBe(false);
    expect(canSwitchProfileFrom('onboarding')).toBe(false);
  });

  it('cold launch (no active profile) always reaches the picker', () => {
    expect(canEnterPicker(false, 'quest')).toBe(true);
  });

  it('an active profile cannot be bypassed from inside a Quest', () => {
    expect(canEnterPicker(true, 'quest')).toBe(false);
    expect(canEnterPicker(true, 'home')).toBe(true);
  });
});

describe('planProfileSwitch', () => {
  it('blocks a mid-Quest switch so running state is never stranded', () => {
    expect(planProfileSwitch('quest', true)).toEqual({
      allowed: false,
      persistRequired: false,
      reason: 'locked-to-quest',
    });
  });

  it('allows a switch from home, persisting a paused Quest first', () => {
    expect(planProfileSwitch('home', true)).toEqual({ allowed: true, persistRequired: true });
  });

  it('allows a switch from home with nothing to persist', () => {
    expect(planProfileSwitch('home', false)).toEqual({ allowed: true, persistRequired: false });
  });
});

// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2 (OA-D5b, OA-D16; CS-14, CS-15) ----

describe('[OA] closesSession', () => {
  it('closes on every change of the active learner, never on the same one', () => {
    expect(closesSession('a', 'b')).toBe(true);
    expect(closesSession(null, 'a')).toBe(true);
    expect(closesSession('a', null)).toBe(true);
    expect(closesSession('a', 'a')).toBe(false);
    expect(closesSession(null, null)).toBe(false);
  });
});

describe('[OA] needsFreshPin (GROWN_UP_FRESH_PIN_MS)', () => {
  const now = 1_800_000_000_000;
  it('asks unless a PIN was entered in the last 2 minutes', () => {
    expect(GROWN_UP_FRESH_PIN_MS).toBe(2 * 60_000);
    for (const action of ['remove', 'lock', 'unlock', 'join_other', 'change_pin'] as const) {
      expect(needsFreshPin(action, null, now), action).toBe(true);
      expect(needsFreshPin(action, now, now), action).toBe(false);
      expect(needsFreshPin(action, now - GROWN_UP_FRESH_PIN_MS + 1, now), action).toBe(false);
      expect(needsFreshPin(action, now - GROWN_UP_FRESH_PIN_MS, now), action).toBe(true);
      expect(needsFreshPin(action, now + 1, now), action).toBe(true);
    }
  });
});

describe('[OA] backgroundLapsed (GROWN_UP_BACKGROUND_MS)', () => {
  it('ends the session after 5 minutes in the background, by wall clock', () => {
    expect(GROWN_UP_BACKGROUND_MS).toBe(5 * 60_000);
    expect(backgroundLapsed(null, 10)).toBe(false);
    expect(backgroundLapsed(0, GROWN_UP_BACKGROUND_MS - 1)).toBe(false);
    expect(backgroundLapsed(0, GROWN_UP_BACKGROUND_MS)).toBe(true);
  });
});

describe('[OA] routeZone and areaExitTracker (OA-D5b (2))', () => {
  it('sorts routes into the Grown-up area, the gate and learner screens', () => {
    for (const name of ['ParentDashboard', 'LearnerReport', 'PlacementReport', 'NotesGrownUp', 'NoteReport', 'EditProfile', 'Restore', 'SaveProgress', 'Paywall', 'MoveClass', 'ApproveTransfer', 'ClassScope', 'RouteProposal', 'RouteSetup', 'RoutePreview']) {
      expect(routeZone(name), name).toBe('area');
    }
    expect(routeZone('MyRoute', { profileId: 'p', viewer: 'grownup' })).toBe('area');
    expect(routeZone('MyRoute', { profileId: 'p' })).toBe('learner');
    expect(routeZone('MyRoute')).toBe('learner');
    expect(routeZone('RouteOverview', { profileId: 'p', viewer: 'grownup' })).toBe('area');
    expect(routeZone('RouteOverview', { profileId: 'p' })).toBe('learner');
    for (const name of ['PinEntry', 'PinReset', 'Onboarding', 'Welcome', 'CreateProfile', 'FirstQuestPreview', 'PlacementInvite']) {
      expect(routeZone(name), name).toBe('gate');
    }
    for (const name of ['Home', 'Profile', 'Journey', 'QuestPlayer', 'SomethingNew']) expect(routeZone(name), name).toBe('learner');
  });

  it('reports a leave from the area to a learner screen, also through a PIN screen, and nothing else', () => {
    const left = areaExitTracker();
    expect(left('learner')).toBe(false);
    expect(left('gate')).toBe(false);
    expect(left('area')).toBe(false);
    expect(left('area')).toBe(false);
    expect(left('learner')).toBe(true);
    expect(left('learner')).toBe(false);
    expect(left('area')).toBe(false);
    expect(left('gate')).toBe(false);
    expect(left('learner')).toBe(true);
  });
});

describe('[OA] areaExitTracker with the session (CS-1: honoured only inside the Grown-up area stack)', () => {
  const open = { sessionOpen: true, returning: false };
  const back = { sessionOpen: true, returning: true };

  it('closes an open session on any landing on a learner screen, also one never in the area', () => {
    const left = areaExitTracker();
    expect(left('learner')).toBe(false);
    expect(left('gate', open)).toBe(false);
    // Add a learner: PIN, then Cancel in onboarding, back on Profile.
    expect(left('learner', open)).toBe(true);
    expect(left('learner')).toBe(false);
  });

  it("keeps it for the PIN screen's return to the waiting action, then closes it on the next learner screen", () => {
    const left = areaExitTracker();
    expect(left('learner')).toBe(false);
    expect(left('gate', open)).toBe(false);
    expect(left('learner', back)).toBe(false);
    expect(left('learner', open)).toBe(true);
  });

  it('a return never keeps a session that leaves the area, and moves inside the area never close it', () => {
    const left = areaExitTracker();
    expect(left('area', open)).toBe(false);
    expect(left('area', open)).toBe(false);
    expect(left('gate', open)).toBe(false);
    expect(left('area', back)).toBe(false);
    expect(left('learner', back)).toBe(true);
  });
});

describe('[OA] areaLeaveRoutes (OA-D16)', () => {
  it('keeps the routes below the first Grown-up area route, or the learner home when the stack starts there', () => {
    expect(areaLeaveRoutes([{ name: 'Main', key: 'm' }, { name: 'ParentDashboard' }, { name: 'CardDetail' }])).toEqual([{ name: 'Main', key: 'm' }]);
    expect(areaLeaveRoutes([{ name: 'Main' }, { name: 'MyRoute', params: { profileId: 'p', viewer: 'grownup' } }])).toEqual([{ name: 'Main' }]);
    expect(areaLeaveRoutes([{ name: 'EditProfile', params: { profileId: 'p' } }])).toEqual([{ name: 'Main' }]);
    expect(areaLeaveRoutes([{ name: 'Main' }, { name: 'Profile' }])).toBeNull();
    expect(areaLeaveRoutes([])).toBeNull();
  });
});

// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a (section 6.2, 6.3; CS-2) ----

describe('[OA] the resume origin', () => {
  it('a pick on the chooser opened over a running screen is always allowed', () => {
    expect(canSwitchProfileFrom('resume')).toBe(true);
    expect(canEnterPicker(true, 'resume')).toBe(true);
  });

  it('always persists the leaving learner first, whatever the screen reports', () => {
    expect(planProfileSwitch('resume', true)).toEqual({ allowed: true, persistRequired: true });
    expect(planProfileSwitch('resume', false)).toEqual({ allowed: true, persistRequired: true });
  });

  it('the screens it opens over still offer no Switch of their own', () => {
    for (const origin of ['quest', 'minigame', 'onboarding'] as const) expect(canSwitchProfileFrom(origin)).toBe(false);
  });
});

describe('[OA] closeOnChooser (CS-2)', () => {
  it('clears both session times, the tab unlock and posts the lock, whatever was open', () => {
    for (const state of [
      { parentGateOpenedAt: T0, lastPinVerifiedAt: T0 },
      { parentGateOpenedAt: T0, lastPinVerifiedAt: null },
      { parentGateOpenedAt: null, lastPinVerifiedAt: T0 },
    ]) {
      expect(closeOnChooser(state)).toEqual({
        times: { parentGateOpenedAt: null, lastPinVerifiedAt: null },
        closed: true,
        clearTab: true,
        postLock: true,
      });
    }
  });

  it('with nothing open it still clears the tab and posts the lock, and says nothing was closed', () => {
    expect(closeOnChooser({ parentGateOpenedAt: null, lastPinVerifiedAt: null })).toMatchObject({ closed: false, clearTab: true, postLock: true });
  });
});
