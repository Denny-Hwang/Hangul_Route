import { describe, expect, it } from 'vitest';
import {
  PARENT_SESSION_MS,
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
