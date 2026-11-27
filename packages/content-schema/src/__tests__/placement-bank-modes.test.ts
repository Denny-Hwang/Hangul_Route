import { describe, expect, it } from 'vitest';
import * as builder from '../../../../scripts/build-placement-bank.mjs';
import {
  apply,
  createRng,
  currentQuestion,
  finishRun,
  hashSeed,
  isFinished,
  startRun,
  type AssessmentQuestion,
  type PlacementBank,
  type PlacementConfig,
  type PlacementMode,
  type PlacementResult,
  type PlacementTemplate,
} from '../index';
// @ts-expect-error plain-Node script (no declaration file)
import { repeatsLine } from '../../../../scripts/placement-rules.mjs';
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

  it('with every template ready: Standard’s floor is 13, Short never uses sentences, a perfect reader reaches stage3 in Standard (25) and Deep (45)', () => {
    for (let seed = 1; seed <= 20; seed += 1) expect(runOnce('standard', seed, 0).result.responses).toHaveLength(13);
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const short = runOnce('short', seed, 1);
      expect(short.formats).not.toContain('read-pick-picture');
      expect(short.result.level).toEqual({ stage: 'stage1', band: 1 });
      const standard = runOnce('standard', seed, 1).result;
      expect(standard.level.stage).toBe('stage3');
      expect(standard.responses).toHaveLength(25);
      const deep = runOnce('deep', seed, 1).result;
      expect(deep.level.stage).toBe('stage3');
      expect(deep.responses).toHaveLength(45);
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
 * AMENDMENTS-PLC-VALIDITY sections 3.6 and 3.9 (row PV-1c): responders that read only part of a sentence item, on
 * the shipped bank. Each rate is exact for a seeded draw (from the structure of the drawn items, no sampled
 * guesses), averaged over 2,000 seeds per mode, for both forms. The bar (PV-OD-12): a noun-only responder passes a
 * `sentence` draw no more often than a uniform guesser passes any other route-moving gate, 0.156.
 */
describe('sentence items a partial reader cannot pass by luck (AMENDMENTS-PLC-VALIDITY section 3.6, row PV-1c)', () => {
  const SEEDS = 2_000;
  const BAR = 0.156;
  const byId = new Map(bank.templates.map((t) => [t.id, t]));
  const act = (ref: string | undefined): { predicate: string; noun: string } | null => {
    const m = /^word:act-([a-z]+)-([a-z]+)$/.exec(ref ?? '');
    return m === null ? null : { predicate: m[1] as string, noun: m[2] as string };
  };
  const rightOf = (q: AssessmentQuestion) => q.options.find((o) => o.isCorrect) as AssessmentQuestion['options'][number];
  /** The words of a reply that repeat a word of its line (the lint's S6 rule, `repeatsLine`). */
  const echoes = (q: AssessmentQuestion): AssessmentQuestion['options'] => q.options.filter((o) => repeatsLine(q.promptKo, o.ko));
  /** Chance a reply-pick item is answered right by "pick a reply that sounds like the line, else any". */
  const echoReply = (q: AssessmentQuestion): number => {
    const matching = echoes(q);
    if (matching.length === 0) return 1 / q.options.length;
    return matching.some((o) => o.isCorrect) ? 1 / matching.length : 0;
  };
  type Responder = (q: AssessmentQuestion) => number;
  /** Reads the noun only: picks among the pictures of the sentence's noun. */
  const nounOnly: Responder = (q) => {
    if (q.format === 'reply-pick') return echoReply(q);
    const noun = act(rightOf(q).pictureRef)?.noun;
    return 1 / q.options.filter((o) => act(o.pictureRef)?.noun === noun).length;
  };
  /** Reads the predicate only (intended to pass, S1): picks among the pictures of the sentence's predicate. */
  const predicateOnly: Responder = (q) => {
    if (q.format === 'reply-pick') return echoReply(q);
    const predicate = act(rightOf(q).pictureRef)?.predicate;
    return 1 / q.options.filter((o) => act(o.pictureRef)?.predicate === predicate).length;
  };
  /** Compares the pictures only: picks among those that share the most (noun or predicate) with the other three. */
  const middle: Responder = (q) => {
    if (q.format === 'reply-pick') return echoReply(q);
    const parts = q.options.map((o) => act(o.pictureRef) as { predicate: string; noun: string });
    const score = parts.map((p, i) => parts.filter((x, j) => j !== i && (x.noun === p.noun || x.predicate === p.predicate)).length);
    const best = Math.max(...score);
    const tied = q.options.filter((_, i) => score[i] === best);
    return tied.some((o) => o.isCorrect) ? 1 / tied.length : 0;
  };
  /** Reads the noun and picks the action it finds most typical of it: one fixed action per noun. */
  const typical =
    (choice: Readonly<Record<string, string>>): Responder =>
    (q) => {
      if (q.format === 'reply-pick') return echoReply(q);
      const noun = act(rightOf(q).pictureRef)?.noun as string;
      return act(rightOf(q).pictureRef)?.predicate === choice[noun] ? 1 : 0;
    };
  const TYPICAL = { bear: 'sleep', tiger: 'run', puppy: 'run', rabbit: 'run', cat: 'sleep', monkey: 'eat', bird: 'fly', duck: 'swim', sibling: 'run', friend: 'eat' };
  const uniform: Responder = (q) => 1 / q.options.length;
  /** On a reply, picks among the shortest (or the longest) replies, counted in Hangul syllables; on a picture, as noun-only. */
  const syllables = (ko: string | undefined): number => (ko ?? '').replace(/[^가-힣]/g, '').length;
  const byLength =
    (pick: (lengths: number[]) => number): Responder =>
    (q) => {
      if (q.format !== 'reply-pick') return nounOnly(q);
      const lengths = q.options.map((o) => syllables(o.ko));
      const target = pick(lengths);
      const tied = q.options.filter((_, i) => lengths[i] === target);
      return tied.some((o) => o.isCorrect) ? 1 / tied.length : 0;
    };
  const shortest = byLength((ls) => Math.min(...ls));
  const longest = byLength((ls) => Math.max(...ls));
  /** Echo first; when no reply sounds like the line, the shortest one. */
  const echoThenShortest: Responder = (q) => (q.format === 'reply-pick' && echoes(q).length === 0 ? shortest(q) : nounOnly(q));

  /** P(at least `need` right) for independent items with these chances (exact). */
  const atLeast = (ps: readonly number[], need: number): number => {
    let dist = [1];
    for (const p of ps) dist = [...dist, 0].map((_, k) => (dist[k] ?? 0) * (1 - p) + (dist[k - 1] ?? 0) * p);
    return dist.slice(need).reduce((a, b) => a + b, 0);
  };
  const passOf = (questions: readonly AssessmentQuestion[], responder: Responder): number =>
    atLeast(questions.map(responder), questions.length - 1);

  const drawsOf = (mode: 'standard' | 'deep') =>
    Array.from({ length: SEEDS }, (_, i) => {
      const draws = startRun(bank, config(mode, i + 1), 0).draws;
      return { read: draws['sentence:read'] ?? [], read2: draws['sentence:read:2'] ?? [], oral: draws['sentence:oral'] ?? [] };
    });
  const standard = drawsOf('standard');
  const deep = drawsOf('deep');
  const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rates = (responder: Responder) => ({
    standardRead: mean(standard.map((d) => passOf(d.read, responder))),
    standardOral: mean(standard.map((d) => passOf(d.oral, responder))),
    deepRead: mean(deep.map((d) => passOf(d.read, responder))),
    deepReadBoth: mean(deep.map((d) => passOf(d.read, responder) * passOf(d.read2, responder))),
    deepOral: mean(deep.map((d) => passOf(d.oral, responder))),
  });

  it('every draw is four questions: three action pictures and a reply when read, four pictures when heard', () => {
    for (const d of [...standard, ...deep]) {
      expect(d.read.map((q) => q.format)).toEqual(['read-pick-picture', 'read-pick-picture', 'read-pick-picture', 'reply-pick']);
      expect(d.oral.map((q) => q.format)).toEqual(Array(4).fill('hear-pick-picture'));
      for (const q of [...d.read, ...d.oral].filter((x) => x.format !== 'reply-pick')) expect(q.options.every((o) => act(o.pictureRef) !== null), q.id).toBe(true);
    }
    for (const d of deep) expect(d.read2.map((q) => q.format)).toEqual(['read-pick-picture', 'read-pick-picture', 'read-pick-picture', 'reply-pick']);
  });

  it('a draw never asks two templates of one family (the word: tag spreads the draw)', () => {
    for (const d of [...standard, ...deep]) {
      for (const qs of [d.read, d.read2, d.oral]) {
        const words = qs.flatMap((q) => (byId.get(q.id)?.question.tags ?? []).filter((t) => t.startsWith('word:')));
        expect(new Set(words).size, qs.map((q) => q.id).join(' ')).toBe(words.length);
      }
    }
  });

  it('a uniform guesser passes a draw about as section 3.6 says (read 0.063, heard 0.051)', () => {
    const r = rates(uniform);
    expect(r.standardRead).toBeCloseTo(0.063, 2);
    expect(r.standardOral).toBeCloseTo(0.051, 2);
  });

  it('a noun-only responder passes a draw in at most 15.6 % (read about 0.148 or less, heard 0.111), Deep both read draws far less', () => {
    const r = rates(nounOnly);
    for (const [k, v] of Object.entries(r)) expect(v, k).toBeLessThanOrEqual(BAR);
    expect(r.standardOral).toBeCloseTo(0.111, 3);
    expect(r.deepReadBoth).toBeLessThanOrEqual(0.022);
  });

  it('a picture-comparing (middle-picking) responder and a typical-action responder do no better than the noun-only one', () => {
    const noun = rates(nounOnly);
    const alt = [rates(middle), rates(typical(TYPICAL))];
    // every fixed choice of the first, the second or the third action of each family
    const actions = new Map<string, string[]>();
    for (const t of bank.templates.filter((x) => x.gate === 'sentence' && x.question.format !== 'reply-pick')) {
      const right = act(t.question.options.find((o) => o.isCorrect)?.pictureRef);
      if (right !== null && !(actions.get(right.noun) ?? []).includes(right.predicate)) actions.set(right.noun, [...(actions.get(right.noun) ?? []), right.predicate]);
    }
    expect(actions.size).toBe(10);
    for (const family of [0, 1, 2]) alt.push(rates(typical(Object.fromEntries([...actions].map(([n, ps]) => [n, ps[family] as string])))));
    for (const r of alt) {
      for (const [k, v] of Object.entries(r)) {
        expect(v, k).toBeLessThanOrEqual(BAR);
        // a fixed choice is right or wrong per item, so its mean over 2,000 draws carries sampling noise (about 0.007)
        expect(v, k).toBeLessThanOrEqual((noun as Record<string, number>)[k]! + 0.02);
      }
    }
  });

  it('a noun-only reader who picks replies by their length (shortest, longest, or echo then shortest) stays under the bar too', () => {
    for (const [name, responder] of [['shortest', shortest], ['longest', longest], ['echo then shortest', echoThenShortest]] as const) {
      const r = rates(responder);
      for (const [k, v] of Object.entries(r)) expect(v, `${name} ${k}`).toBeLessThanOrEqual(BAR);
    }
    // No reply is the only shortest or the only longest of its item in more than half the items (PV-1c review).
    const replies = bank.templates.filter((t) => t.gate === 'sentence' && t.question.format === 'reply-pick');
    const only = (pick: (ls: number[]) => number) =>
      replies.filter((t) => {
        const ls = t.question.options.map((o) => syllables(o.ko));
        const target = pick(ls);
        return ls.filter((l) => l === target).length === 1 && ls[t.question.options.findIndex((o) => o.isCorrect)] === target;
      }).length;
    expect(only((ls) => Math.min(...ls))).toBeLessThanOrEqual(replies.length / 2);
    expect(only((ls) => Math.max(...ls))).toBeLessThanOrEqual(replies.length / 2);
  });

  it('a predicate-only responder passes (intended, S1: the predicate is what the gate measures)', () => {
    const r = rates(predicateOnly);
    expect(r.standardOral).toBe(1);
    expect(r.standardRead).toBeGreaterThan(0.99);
  });

  it('a learner who knows 90 % of the items passes one draw in at least 90 %, and both Deep read draws in at least 88 %', () => {
    const knows: Responder = () => 0.9;
    const r = rates(knows);
    expect(r.standardRead).toBeGreaterThanOrEqual(0.9);
    expect(r.standardOral).toBeGreaterThanOrEqual(0.9);
    expect(r.deepReadBoth).toBeGreaterThanOrEqual(0.88);
  });
});
