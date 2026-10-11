import { describe, expect, it } from 'vitest';
import { parseUnlockedBy } from '../rules';

describe('parseUnlockedBy (F-STORY-006 §3.1)', () => {
  it('reads an episode rule with the full episode id', () => {
    expect(parseUnlockedBy('episode:stage1-letters')).toEqual({ kind: 'episode', episodeId: 'episode:stage1-letters' });
    expect(parseUnlockedBy('episode:shelf-sun-and-moon')).toEqual({ kind: 'episode', episodeId: 'episode:shelf-sun-and-moon' });
  });

  it('reads a stage rule for stages 1 to 7', () => {
    expect(parseUnlockedBy('stage1-complete')).toEqual({ kind: 'stage', stage: 'stage1' });
    expect(parseUnlockedBy('stage7-complete')).toEqual({ kind: 'stage', stage: 'stage7' });
  });

  it('reads the welcome rule and a set rule', () => {
    expect(parseUnlockedBy('first-launch')).toEqual({ kind: 'welcome' });
    expect(parseUnlockedBy('set:records-joseon')).toEqual({ kind: 'set', setId: 'set:records-joseon' });
  });

  it.each(['episod:stage1-letters', 'episode:', 'stage8-complete', 'stage0-complete', 'first_launch', 'set:', 'jamo:giyeok', '', 'episode:Stage1'])(
    'anything else is unknown: %j',
    (raw) => {
      expect(parseUnlockedBy(raw)).toEqual({ kind: 'unknown', raw });
    },
  );
});
