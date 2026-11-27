import type { ListenPickRound } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import type { ContrastEnv } from '../../audio/contrast-sets';
import { contrastStepVerdict, passByDirection, passesAtOnce, type ContrastPassDeps } from '../contrast-pass';

/** [MP] AMENDMENTS-MINIMAL-PAIRS section 3.6, row MP-2b: a contrast step with nothing to play is passed by. */
const round = (set: string): ListenPickRound => ({
  id: `lp:pair:${set}`,
  contrastSet: set,
  prompt: { ko: '', romanization: set, en: '' },
  options: [
    { id: 'a', text: { ko: '', romanization: 'a', en: '' } },
    { id: 'b', text: { ko: '', romanization: 'b', en: '' } },
  ],
  answerId: 'a',
});
const env: ContrastEnv = { hasClip: () => true, soundOn: true, alwaysShowLetters: false, host: 'quest' };

function deps(over: Partial<ContrastPassDeps> = {}): ContrastPassDeps & { order: string[] } {
  const order: string[] = [];
  return {
    order,
    waitForPacks: async () => {
      order.push('wait');
    },
    loadKit: async () => {
      order.push('kit');
      return { contrastStepPlayable: () => true };
    },
    env: () => {
      order.push('env');
      return env;
    },
    ...over,
  };
}

describe('contrastStepVerdict', () => {
  it('waits for the clip packs, then loads the chunk, then reads the device now (the env is read after the wait)', async () => {
    const d = deps();
    expect(await contrastStepVerdict([round('ga-ka'), round('da-ta')], d)).toBe('play');
    expect(d.order).toEqual(['wait', 'kit', 'env']);
  });

  it('passes a step by when the kit says no set can play', async () => {
    const d = deps({ loadKit: async () => ({ contrastStepPlayable: () => false }) });
    expect(await contrastStepVerdict([round('ga-ka')], d)).toBe('pass');
  });

  it('hands the kit the scope rounds and the env', async () => {
    const playable = vi.fn(() => true);
    await contrastStepVerdict([round('ga-ka'), round('da-ta')], deps({ loadKit: async () => ({ contrastStepPlayable: playable }) }));
    expect(playable).toHaveBeenCalledWith([round('ga-ka'), round('da-ta')], env);
  });

  it('passes a step by when the chunk cannot load, and when the wait itself fails', async () => {
    expect(await contrastStepVerdict([round('ga-ka')], deps({ loadKit: () => Promise.reject(new Error('offline')) }))).toBe('pass');
    expect(await contrastStepVerdict([round('ga-ka')], deps({ waitForPacks: () => Promise.reject(new Error('stalled')) }))).toBe('pass');
  });

  it('passes a step by with no contrast round at all, without loading anything', async () => {
    const d = deps();
    expect(await contrastStepVerdict([], d)).toBe('pass');
    expect(d.order).toEqual([]);
  });
});

describe('passByDirection', () => {
  it('goes on as the learner was going: forward after Next or a resume, back after Previous', () => {
    expect(passByDirection(false)).toBe('next');
    expect(passByDirection(true)).toBe('prev');
  });
});

describe('passesAtOnce (the start bundle knows which sets are approved)', () => {
  it('passes a step by at once when none of its sets is approved: no pack wait, no chunk', () => {
    expect(passesAtOnce([round('ga-ka'), round('da-ta')], [])).toBe(true);
    expect(passesAtOnce([round('ga-ka'), round('da-ta')], ['go-ko'])).toBe(true);
    expect(passesAtOnce([], ['ga-ka'])).toBe(true);
  });

  it('leaves the decision to the clip wait and the chunk once one of its sets is approved', () => {
    expect(passesAtOnce([round('ga-ka'), round('da-ta')], ['da-ta'])).toBe(false);
    expect(passesAtOnce([round('ga-ka'), round('da-ta')], ['ga-ka', 'da-ta', 'go-ko'])).toBe(false);
  });
});
