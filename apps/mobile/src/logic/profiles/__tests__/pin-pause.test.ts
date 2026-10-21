import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { INITIAL_ATTEMPT_STATE, type AttemptState } from '../pin-hash';
import { PAUSE_HELP_DESTINATION, PAUSE_HELP_FROM_ROUND, pauseAnnounceKey, pauseText, showsPauseHelp } from '../pin-pause';

const m = getMessages('en').caregiver.pin;
const NOW = 1_800_000_000_000;
const paused = (strikes: number, ms = 60_000): AttemptState => ({ failures: [], lockedUntil: NOW + ms, strikes, lastMissAt: NOW });

describe('[OA] pauseText: seconds under a minute, minutes above (section 8.3)', () => {
  it('words the pause', () => {
    expect(pauseText(30_000, m)).toBe("Let's take a short break. Try again in 30s.");
    expect(pauseText(59_001, m)).toBe("Let's take a short break. Try again in 60s.");
    expect(pauseText(60_000, m)).toBe("Let's take a short break. Try again in 1 min.");
    expect(pauseText(5 * 60_000 - 1, m)).toBe("Let's take a short break. Try again in 5 min.");
    expect(pauseText(3_600_000, m)).toBe("Let's take a short break. Try again in 60 min.");
    expect(pauseText(-5, m)).toBe("Let's take a short break. Try again in 0s.");
  });
});

describe('[OA] showsPauseHelp: from the 3rd pause, on the Grown-up area only (CS-21)', () => {
  it('is the Grown-up area destination from round 3 on', () => {
    expect(PAUSE_HELP_DESTINATION).toBe('ParentDashboard');
    expect(PAUSE_HELP_FROM_ROUND).toBe(3);
    expect(showsPauseHelp(paused(3), NOW, 'ParentDashboard')).toBe(true);
    expect(showsPauseHelp(paused(5), NOW, 'ParentDashboard')).toBe(true);
    expect(showsPauseHelp(paused(2), NOW, 'ParentDashboard')).toBe(false);
  });

  it('never on another destination, the locked tile, a grown-up use or Cancel the wait', () => {
    for (const next of ['LockedProfile', 'GrownUpUse', 'CancelReset', 'GrownUpArea', 'AddProfile', undefined]) {
      expect(showsPauseHelp(paused(4), NOW, next), String(next)).toBe(false);
    }
  });

  it('only while a pause runs; a legacy state reads as no round', () => {
    expect(showsPauseHelp({ ...paused(4), lockedUntil: NOW }, NOW, 'ParentDashboard')).toBe(false);
    expect(showsPauseHelp(INITIAL_ATTEMPT_STATE, NOW, 'ParentDashboard')).toBe(false);
    expect(showsPauseHelp({ failures: [], lockedUntil: NOW + 1 }, NOW, 'ParentDashboard')).toBe(false);
  });
});

describe('[OA] pauseAnnounceKey: the live region changes once a minute', () => {
  it('is the whole minutes left, rounded up, and null without a pause', () => {
    expect(pauseAnnounceKey(30_000)).toBe(1);
    expect(pauseAnnounceKey(1)).toBe(1);
    expect(pauseAnnounceKey(60_000)).toBe(1);
    expect(pauseAnnounceKey(60_001)).toBe(2);
    expect(pauseAnnounceKey(0)).toBeNull();
    // Every second of a 5-minute pause maps to one of five keys.
    const keys = new Set(Array.from({ length: 300 }, (_, i) => pauseAnnounceKey(300_000 - i * 1000)));
    expect(keys.size).toBe(5);
  });
});
