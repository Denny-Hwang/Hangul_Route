import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { ContrastEnv } from '../audio/contrast-sets';
import { LISTEN_PICK_TIMING, startFlow, type ListenPickFlowState } from '../listen-pick-flow';
import { compareRow, laterContrast, laterUnplayable, missLine, mixedRounds, optionNaming, playCompare } from '../listen-pick-contrast';

/**
 * What Listen & Pick's contrast branches call once they live in the contrast kit (AMENDMENTS-START-BUNDLE-2026-11 row SB-4b):
 * the mixed-scope draw, the compare player, the miss line, the option naming and the later rounds to drop. The board's own
 * behaviour is pinned by `ListenPickGame-contrast*.test.tsx`; these are the helpers' contracts.
 */

const fixture = vi.hoisted(() => {
  const member = (text: string, romanization: string, kind: 'plain' | 'aspirated' | 'tense', ref: string) => ({
    text,
    romanization,
    en: `the syllable ${romanization}`,
    ref,
    kind,
  });
  const set = (id: string, series: string, members: ReturnType<typeof member>[]) => ({ id, series, unit: 'minigame:s1-life-q3-pairs', members, approved: true });
  return {
    sets: [
      set('ga-ka', 'k', [member('가', 'ga', 'plain', 'audio/fixture/ga.mp3'), member('카', 'ka', 'aspirated', 'audio/fixture/ka.mp3')]),
      set('da-ta', 't', [member('다', 'da', 'plain', 'audio/fixture/da.mp3'), member('타', 'ta', 'aspirated', 'audio/fixture/ta.mp3')]),
    ],
  };
});
vi.mock('../../content/__generated__/contrast-sets', () => ({ CONTRAST_SETS: fixture.sets }));

const m = getMessages('en');
const copy = m.learner.minigame.contrast;
const text = (ko: string, romanization: string, en = `the syllable ${romanization}`) => ({ ko, romanization, en });
const PLAIN: ListenPickRound = {
  id: 'lp:syl:가',
  prompt: text('가', 'ga'),
  options: [
    { id: 'a', text: text('가', 'ga') },
    { id: 'b', text: text('나', 'na') },
  ],
  answerId: 'a',
};
const stub = (set: string): ListenPickRound => ({
  id: `lp:pair:${set}`,
  contrastSet: set,
  prompt: text('', set, ''),
  options: [
    { id: 'a', text: text('?', 'a') },
    { id: 'b', text: text('?', 'b') },
  ],
  answerId: 'a',
});
const PAIR: ListenPickRound = {
  id: 'lp:pair:ga-ka',
  contrastSet: 'ga-ka',
  prompt: text('가', 'ga'),
  options: [
    { id: 'a', text: text('가', 'ga') },
    { id: 'b', text: text('카', 'ka') },
  ],
  answerId: 'a',
};
const env = (clips: string[]): ContrastEnv => ({ hasClip: (ref) => clips.includes(ref), soundOn: true, alwaysShowLetters: false, host: 'quest' });
const BOTH = env(['audio/fixture/ga.mp3', 'audio/fixture/ka.mp3', 'audio/fixture/da.mp3', 'audio/fixture/ta.mp3']);
const ONLY_GA_KA = env(['audio/fixture/ga.mp3', 'audio/fixture/ka.mp3']);

describe('mixedRounds', () => {
  it('keeps a plain round, expands a playable contrast round with a drawn target and leaves out one that cannot play', () => {
    const out = mixedRounds([PLAIN, stub('ga-ka'), stub('da-ta')], ONLY_GA_KA, 7);
    expect(out.map((r) => r.id)).toEqual(['lp:syl:가', 'lp:pair:ga-ka']);
    expect(out[0]).toBe(PLAIN);
    expect(out[1]?.options.map((o) => o.text?.ko).sort()).toEqual(['가', '카']);
  });

  it('draws the same targets from the same seed', () => {
    expect(mixedRounds([stub('ga-ka'), stub('da-ta')], BOTH, 3)).toEqual(mixedRounds([stub('ga-ka'), stub('da-ta')], BOTH, 3));
  });
});

describe('the later rounds to drop', () => {
  const rounds = [PAIR, stub('ga-ka'), PLAIN, stub('da-ta')];

  it('laterUnplayable names the rounds after this one that cannot play now (a plain round counts as playable)', () => {
    expect(laterUnplayable(rounds, 0, ONLY_GA_KA)).toEqual(['lp:pair:da-ta']);
    expect(laterUnplayable(rounds, 0, BOTH)).toEqual([]);
    expect(laterUnplayable(rounds, 3, ONLY_GA_KA)).toEqual([]);
  });

  it('laterContrast names the contrast rounds after this one, playable or not', () => {
    expect(laterContrast(rounds, 0)).toEqual(['lp:pair:ga-ka', 'lp:pair:da-ta']);
    expect(laterContrast(rounds, 1)).toEqual(['lp:pair:da-ta']);
    expect(laterContrast(rounds, 3)).toEqual([]);
  });
});

describe('the lines of an answered round', () => {
  const missed = (): ListenPickFlowState => ({ ...startFlow(2), compare: { rightId: 'a', tappedId: 'b' } });

  it('compareRow is the right member then the tapped one, each with its kind line', () => {
    const row = compareRow(PAIR, missed(), copy, m.a11y);
    expect(row.map((i) => i.id)).toEqual(['a', 'b']);
    expect(row.map((i) => i.kindLine)).toEqual([copy.kind.plain, copy.kind.aspirated]);
  });

  it('compareRow is empty with no miss to show', () => {
    expect(compareRow(PAIR, startFlow(2), copy, m.a11y)).toEqual([]);
  });

  it("missLine is Hoya's line and then the compare row's labels, said once", () => {
    const row = compareRow(PAIR, missed(), copy, m.a11y);
    expect(missLine(PAIR, missed(), copy, m.a11y)).toBe([copy.missHoya, ...row.map((i) => i.label)].join(' '));
  });

  it("missLine is Hoya's line alone with no miss to show", () => {
    expect(missLine(PAIR, startFlow(2), copy, m.a11y)).toBe(copy.missHoya);
  });
});

describe('optionNaming', () => {
  it('gives an answered member its kind line, its sound, its name by both and its meaning', () => {
    const naming = optionNaming(PAIR, PAIR.options[1]!, copy, m.a11y);
    expect(naming?.kindLine).toBe(copy.kind.aspirated);
    expect(naming?.sound).toBe('ka');
    expect(naming?.named).toBe(m.a11y.contrastItem('ka', copy.kind.aspirated));
    expect(naming?.gloss).toBe(copy.syllable('ka'));
  });

  it('keeps the meaning a scope wrote out in full', () => {
    const own: ListenPickRound = { ...PAIR, options: [PAIR.options[0]!, { id: 'b', text: text('카', 'ka', 'a hiss of air') }] };
    expect(optionNaming(own, own.options[1]!, copy, m.a11y)?.gloss).toBe('a hiss of air');
  });

  it('is nothing for an option the set cannot place, or one with no text', () => {
    expect(optionNaming(PAIR, { id: 'x', text: text('나', 'na') }, copy, m.a11y)).toBeUndefined();
    expect(optionNaming(PAIR, { id: 'y' }, copy, m.a11y)).toBeUndefined();
  });
});

describe('playCompare', () => {
  const rig = (round: ListenPickRound | undefined, played: string[] = []) => {
    const compareRun = { current: 4 };
    const mounted = { current: true };
    const sounding: Array<string | null> = [];
    const tracked: Array<Promise<unknown>> = [];
    const play = vi.fn(async (spec: { text: string }) => {
      played.push(spec.text);
      return 'played' as const;
    });
    const call = (): void =>
      playCompare({
        round,
        rightId: 'a',
        tappedId: 'b',
        compareRun,
        mounted,
        setSounding: (id) => void sounding.push(id),
        track: (p) => {
          tracked.push(Promise.resolve(p));
          return p;
        },
        play,
      });
    return { call, compareRun, mounted, sounding, tracked, play };
  };

  it('plays the right clip, then the tapped one after the compare gap, outlining each, and clears the outline', async () => {
    vi.useFakeTimers();
    try {
      const played: string[] = [];
      const r = rig(PAIR, played);
      r.call();
      expect(r.compareRun.current).toBe(5);
      await vi.advanceTimersByTimeAsync(0);
      expect(played).toEqual(['가']);
      await vi.advanceTimersByTimeAsync(LISTEN_PICK_TIMING.compareGapMs);
      await Promise.all(r.tracked);
      expect(played).toEqual(['가', '카']);
      expect(r.sounding).toEqual(['a', 'b', null]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a newer run (a Hear it tap, a new round) cancels the chain before the second clip', async () => {
    vi.useFakeTimers();
    try {
      const played: string[] = [];
      const r = rig(PAIR, played);
      r.call();
      await vi.advanceTimersByTimeAsync(0);
      r.compareRun.current += 1;
      await vi.advanceTimersByTimeAsync(LISTEN_PICK_TIMING.compareGapMs);
      await Promise.all(r.tracked);
      expect(played).toEqual(['가']);
      expect(r.sounding).toEqual(['a']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a screen that left plays nothing and leaves no outline', async () => {
    const r = rig(PAIR);
    r.mounted.current = false;
    r.call();
    await Promise.all(r.tracked);
    expect(r.play).not.toHaveBeenCalled();
    expect(r.sounding).toEqual([]);
  });

  it('a round that is not a contrast round plays nothing and starts no run', () => {
    const r = rig(PLAIN);
    r.call();
    expect(r.compareRun.current).toBe(4);
    expect(r.tracked).toEqual([]);
    const none = rig(undefined);
    none.call();
    expect(none.tracked).toEqual([]);
  });
});
