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
const runOnce = (mode: PlacementMode, seed: number, p: number, over: Partial<PlacementConfig> = {}): { result: PlacementResult; formats: string[] } => {
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
  const result = finishRun(state, {
    catalog: STAGE1_15,
    isEntitled: () => true,
    completedQuestIds: new Set(),
    completedAt: '2026-10-11T10:00:00.000Z',
    contentVer: 'test',
    testLocale: 'en',
    source: 'onboarding',
  });
  return { result, formats };
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
      const { result, formats } = runOnce('short', seed, 0.5);
      expect(result.gates.find((g) => g.gate === 'sound-basic')?.result).not.toBe('not-run');
      expect(formats).not.toContain('see-pick-sound');
      expect(formats).not.toContain('build-syllable');
      expect(result.responses.map((r) => r.questionId)).not.toContain(warmup.id);
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

  it('Deep’s confirming syllable draw holds a tile item for a learner who is not listen-first', () => {
    let tiles = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const state = startRun(bank, config('deep', seed), 0);
      if ((state.draws['syl-cv:decode:2'] ?? []).some((q) => q.format === 'build-syllable')) tiles += 1;
    }
    expect(tiles).toBe(50);
  });
});
