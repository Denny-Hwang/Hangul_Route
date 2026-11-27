import { describe, expect, it } from 'vitest';
import * as builder from '../../../../scripts/build-placement-bank.mjs';
import {
  apply,
  createRng,
  currentQuestion,
  finishRun,
  hashSeed,
  isFinished,
  passAtFor,
  startRun,
  type AssessmentQuestion,
  type PlacementBank,
  type PlacementConfig,
  type PlacementMode,
  type PlacementResult,
  type PlacementTemplate,
} from '../index';
import { REPO_ROOT } from './helpers/romanization-registry';
import { STAGE1_15 } from './fixtures/stage1-15';

/**
 * The three modes against the shipped bank (content/placement/, built by the same
 * code that writes placement.generated.ts), so the paths each mode can take on the
 * shipped content stay visible in CI. At most 200 seeded runs per case, so CI stays fast.
 */

const build = builder as unknown as { loadModel: (root: string) => { bank: PlacementBank; warmup: PlacementTemplate } };
const { bank, warmup } = build.loadModel(REPO_ROOT);
const ready = bank.templates.filter((t) => t.status === 'ready');
const NO_ART = ['card:sagwa', 'card:uyu', 'card:ppang', 'card:dosirak', 'card:haneul', 'card:kkot', 'card:namu', 'card:byeol'];
const WARMUP_TAGS = warmup.question.tags.filter((t) => t.startsWith('word:'));
const RUNS = 200;

const config = (mode: PlacementMode, seed: number, over: Partial<PlacementConfig> = {}): PlacementConfig => ({
  mode,
  avoidTags: WARMUP_TAGS,
  revealMode: 'tap',
  audio: true,
  visual: true,
  takeMyTime: false,
  seed,
  exclude: [],
  resolvesPicture: (ref) => !NO_ART.includes(ref),
  ...over,
});

/** A learner who answers right with probability `p` and otherwise taps "not sure". */
const runOnce = (
  mode: PlacementMode,
  seed: number,
  p: number,
  over: Partial<PlacementConfig> = {},
): { result: PlacementResult; formats: string[]; tags: string[] } => {
  const rng = createRng(hashSeed(['bank-modes', mode, String(seed)]));
  let state = startRun(bank, config(mode, seed, over), 0);
  let t = 0;
  const formats: string[] = [];
  for (let guard = 0; guard < 80 && !isFinished(state); guard += 1) {
    if (state.pause !== null) {
      state = apply(state, { type: 'keepGoing' }, t);
      continue;
    }
    const q = currentQuestion(state) as AssessmentQuestion;
    formats.push(q.format);
    t += 5_000;
    const right = q.options.find((o) => o.isCorrect) as { id: string };
    state = apply(state, rng() < p ? { type: 'answer', optionId: right.id } : { type: 'notSure' }, t);
  }
  expect(isFinished(state)).toBe(true);
  const tags = state.responses.flatMap((r) => state.tags[r.questionId] ?? []);
  const result = finishRun(state, {
    catalog: STAGE1_15,
    isEntitled: () => true,
    completedQuestIds: new Set(),
    completedAt: '2026-10-11T10:00:00.000Z',
    contentVer: 'test',
    testLocale: 'en',
    source: 'onboarding',
  });
  return { result, formats, tags };
};

describe('per-format pools the modes rely on', () => {
  const count = (gate: string, format: string): number => ready.filter((t) => t.gate === gate && t.question.format === format).length;

  it('has two listen-first draws for every decoding gate (Short, and Deep for a Pictures first learner)', () => {
    for (const gate of ['sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc']) expect(count(gate, 'hear-pick-written'), gate).toBeGreaterThanOrEqual(6);
  });

  it('has tile items for Deep’s confirming syllable draws', () => {
    expect(count('syl-cv', 'build-syllable')).toBeGreaterThanOrEqual(2);
    expect(count('syl-cvc', 'build-syllable')).toBeGreaterThanOrEqual(2);
  });

  it('has a full vocab oral draw that avoids the warm-up word, and two vocab read draws', () => {
    const oral = ready.filter((t) => t.gate === 'vocab' && t.form === 'oral' && !t.question.tags.some((tag) => WARMUP_TAGS.includes(tag)));
    expect(oral.length).toBeGreaterThanOrEqual(3);
    expect(ready.filter((t) => t.gate === 'vocab' && t.form === 'read').length).toBeGreaterThanOrEqual(6);
  });
});

describe('the modes on today’s bank', () => {
  it('Short with sound and the guide hidden always asks the letter sounds, and never Latin chips or tiles', () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const { result, formats, tags } = runOnce('short', seed, 0.5);
      expect(result.gates.find((g) => g.gate === 'sound-basic')?.result).not.toBe('not-run');
      expect(formats).not.toContain('see-pick-sound');
      expect(formats).not.toContain('build-syllable');
      expect(result.responses.map((r) => r.questionId)).not.toContain(warmup.id);
      // avoidTags excludes by tag: no asked question carries the warm-up's word
      expect(tags.filter((tag) => WARMUP_TAGS.includes(tag))).toEqual([]);
    }
  });

  it('a Pictures first learner never meets Latin sound chips or tiles in any mode', () => {
    for (const mode of ['standard', 'deep'] as const) {
      for (let seed = 1; seed <= RUNS; seed += 1) {
        const { formats } = runOnce(mode, seed, 0.95, { listenFirst: true });
        expect(formats).not.toContain('see-pick-sound');
        expect(formats).not.toContain('build-syllable');
      }
    }
  });

  it('with every template ready: Standard’s floor is 12, Short never uses sentences, a perfect reader reaches stage3 in Standard (24) and Deep (42)', () => {
    for (let seed = 1; seed <= 20; seed += 1) expect(runOnce('standard', seed, 0).result.responses).toHaveLength(12);
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const short = runOnce('short', seed, 1);
      expect(short.formats).not.toContain('read-pick-picture');
      expect(short.result.level).toEqual({ stage: 'stage1', band: 1 });
      const standard = runOnce('standard', seed, 1).result;
      expect(standard.level.stage).toBe('stage3');
      expect(standard.responses).toHaveLength(24);
      const deep = runOnce('deep', seed, 1).result;
      expect(deep.level.stage).toBe('stage3');
      expect(deep.responses).toHaveLength(42);
      expect(deep.oralStage).not.toBeNull();
    }
  });

  it('Deep’s confirming syllable draws hold a tile item for a learner who is not listen-first', () => {
    for (const key of ['syl-cv:decode:2', 'syl-cvc:decode:2']) {
      let tiles = 0;
      for (let seed = 1; seed <= 50; seed += 1) {
        const state = startRun(bank, config('deep', seed), 0);
        if ((state.draws[key] ?? []).filter((q) => q.format === 'build-syllable').length === 1) tiles += 1;
      }
      expect(tiles, key).toBe(50);
    }
  });

  it('no mode asks a question that carries the warm-up’s word', () => {
    for (const mode of ['standard', 'deep'] as const) {
      for (let seed = 1; seed <= 50; seed += 1) {
        expect(runOnce(mode, seed, 0.9).tags.filter((tag) => WARMUP_TAGS.includes(tag))).toEqual([]);
      }
    }
  });
});

/**
 * AMENDMENTS-PLC-VALIDITY row PV-6 (sections 3.6 and 3.9): responders that do not read, on the decoding gates' draws
 * of the shipped bank. A draw is what `startRun` deals for a rung (`state.draws`), for Short, Standard (also listen
 * first) and Deep, 200 seeds each.
 *  - middle-picking: picks the option closest to the other three (by initial, vowel and final). Exact per draw.
 *  - elimination: never gives an answer it already gave earlier in the check (AMENDMENTS-STAGE1-DECODING-CHECK
 *    section 3.9, strategy 3).
 *  - novelty: picks among the options the questions before showed least often (a comparison across items).
 * The last two play each run with seeded picks; their bound is chance plus 0.03, as DC section 3.9 sets it.
 */
describe('responders that do not read, on the decoding gates (PV-6)', () => {
  const DECODE_KEYS = ['sound-basic:decode', 'syl-cv:decode', 'sound-rest:decode', 'syl-cvc:decode', 'syl-cv:decode:2', 'syl-cvc:decode:2'];
  const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const FINALS = [...' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
  const CHIP = /^(kk|tt|pp|ss|jj|ch|g|n|d|r|m|b|s|j|k|t|p|h)?(yeo|ya|yo|yu|eo|eu|a|o|u|i)(ng|k|n|t|l|m|p)?$/;
  type Option = AssessmentQuestion['options'][number];
  /** What the responder sees of an option: a block, a letter or a Latin chip. */
  const textOf = (o: Option): string => (o.ko ?? o.sound) as string;
  /** A block's or a chip's initial, vowel and final. */
  const partsOf = (o: Option): string[] => {
    if (o.ko !== undefined) {
      const n = o.ko.charCodeAt(0) - 0xac00;
      return [INITIALS[Math.floor(n / 588)] as string, MEDIALS[Math.floor((n % 588) / 28)] as string, (FINALS[n % 28] as string).trim()];
    }
    const m = CHIP.exec(o.sound as string) as RegExpExecArray;
    return [m[1] ?? '', m[2] as string, m[3] ?? ''];
  };
  const MODES: Array<[PlacementMode, Partial<PlacementConfig>]> = [
    ['short', {}],
    ['standard', {}],
    ['standard', { listenFirst: true }],
    ['deep', {}],
  ];
  const drawsOf = (mode: PlacementMode, seed: number, over: Partial<PlacementConfig>): Array<[string, AssessmentQuestion[]]> => {
    const state = startRun(bank, config(mode, seed, over), 0);
    return DECODE_KEYS.flatMap((key) => {
      const draw = state.draws[key];
      return draw === undefined ? [] : [[key, draw] as [string, AssessmentQuestion[]]];
    });
  };
  /** P(at least `need` of the items right), the items independent. */
  const passChance = (p: readonly number[], need: number): number => {
    let dist = [1];
    for (const x of p) dist = [...dist, 0].map((v, k) => v * (1 - x) + (k > 0 ? (dist[k - 1] as number) * x : 0));
    return dist.slice(need).reduce((a, b) => a + b, 0);
  };
  const middleChance = (q: AssessmentQuestion): number => {
    const parts = q.options.map(partsOf);
    const total = parts.map((p) => parts.reduce((sum, r) => sum + p.filter((x, i) => x !== r[i]).length, 0));
    const nearest = q.options.filter((_, i) => total[i] === Math.min(...total));
    return nearest.filter((o) => o.isCorrect).length / nearest.length;
  };

  it('the middle-picking responder is at chance on every syllable item, and passes a syllable gate exactly as often as a guesser', () => {
    let items = 0;
    for (const [mode, over] of MODES) {
      for (let seed = 1; seed <= RUNS; seed += 1) {
        for (const [key, draw] of drawsOf(mode, seed, over)) {
          if (!key.startsWith('syl-')) continue;
          // every item of the draw counts, the tile item included (it is four heard blocks)
          const scored = draw;
          for (const q of scored) expect(middleChance(q), `${mode} ${seed} ${q.id}`).toBe(0.25);
          items += scored.length;
          const need = passAtFor(mode, key.startsWith('syl-cvc') ? 'syl-cvc' : 'syl-cv');
          expect(passChance(scored.map(middleChance), need)).toBeCloseTo(passChance(scored.map(() => 0.25), need), 12);
        }
      }
    }
    expect(items).toBeGreaterThan(2000);
    expect(passChance([0.25, 0.25, 0.25], 2)).toBeCloseTo(0.15625, 12);
  });

  const PLAYS = 20;
  /** First-try accuracy per gate of a responder, every mode and seed, `PLAYS` seeded plays of each run's draws. */
  const accuracy = (choose: (q: AssessmentQuestion, before: AssessmentQuestion[], given: string[], rng: () => number) => Option): Map<string, number> => {
    const right = new Map<string, number>();
    const asked = new Map<string, number>();
    for (const [mode, over] of MODES) {
      for (let seed = 1; seed <= RUNS; seed += 1) {
        const draws = drawsOf(mode, seed, over);
        for (let play = 0; play < PLAYS; play += 1) {
          const rng = createRng(hashSeed(['pv6-bot', mode, String(over.listenFirst === true), String(seed), String(play)]));
          const before: AssessmentQuestion[] = [];
          const given: string[] = [];
          for (const [key, draw] of draws) {
            const gate = key.split(':')[0] as string;
            for (const q of draw) {
              const pick = choose(q, before, given, rng);
              asked.set(gate, (asked.get(gate) ?? 0) + 1);
              if (pick.isCorrect) right.set(gate, (right.get(gate) ?? 0) + 1);
              before.push(q);
              given.push(textOf(pick));
            }
          }
        }
      }
    }
    return new Map([...asked].map(([gate, n]) => [gate, (right.get(gate) ?? 0) / n]));
  };
  const pickAmong = (options: readonly Option[], rng: () => number): Option => options[Math.floor(rng() * options.length)] as Option;

  it('the elimination responder (never gives an answer twice) stays within chance + 0.03 on every decoding gate', () => {
    const acc = accuracy((q, _before, given, rng) => {
      const fresh = q.options.filter((o) => !given.includes(textOf(o)));
      return pickAmong(fresh.length > 0 ? fresh : q.options, rng);
    });
    expect([...acc.keys()].sort()).toEqual(['sound-basic', 'sound-rest', 'syl-cv', 'syl-cvc']);
    for (const [gate, a] of acc) expect(a, gate).toBeLessThanOrEqual(0.28);
  });

  it('the novelty responder (picks what the questions before showed least) stays within chance + 0.03 on every decoding gate', () => {
    const acc = accuracy((q, before, _given, rng) => {
      const shown = (o: Option): number => before.filter((b) => b.options.some((x) => textOf(x) === textOf(o))).length;
      const least = Math.min(...q.options.map(shown));
      return pickAmong(q.options.filter((o) => shown(o) === least), rng);
    });
    for (const [gate, a] of acc) expect(a, gate).toBeLessThanOrEqual(0.28);
  });
});
