import { describe, expect, it } from 'vitest';
import { joinIntentTarget } from '../../shell/boot-intent';
import { joinHereTarget } from '../join-here';

/**
 * F-AUTH-004 section 8.2 (row NS-5; OA-D14, OA-D20, CS-N8): Join on this device leaves exactly like a `join` boot
 * intent, the code held in memory; on a device with no learner the first run keeps it for Join.
 */

describe('joinHereTarget', () => {
  it('a shared device: the chooser with the join trigger, the code held (as the boot intent)', () => {
    const target = joinHereTarget('K7MPQ4', true, true);
    expect(target).toEqual({ screen: 'WhoIsUsing', params: { trigger: 'join' }, hold: { code: 'K7MPQ4' } });
    expect(target).toEqual(joinIntentTarget({ kind: 'join', code: 'K7MPQ4' }, true, true));
  });

  it('a device with a learner, not shared: Join, prefilled (as the boot intent)', () => {
    const target = joinHereTarget('K7MPQ4', true, false);
    expect(target).toEqual({ screen: 'JoinSpace', params: { code: 'K7MPQ4' } });
    expect(target).toEqual(joinIntentTarget({ kind: 'join', code: 'K7MPQ4' }, true, false));
  });

  it('no learner: the first run over Welcome, the code kept for the Join after it (never the class-link card)', () => {
    for (const shared of [true, false]) {
      expect(joinHereTarget('K7MPQ4', false, shared)).toEqual({
        screen: 'Onboarding',
        params: { screen: 'CreateProfile', params: { firstRun: true, then: 'join', code: 'K7MPQ4' }, initial: false },
      });
    }
  });
});
