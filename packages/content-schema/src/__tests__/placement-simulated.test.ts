import { describe, expect, it } from 'vitest';
import {
  apply,
  createRng,
  currentQuestion,
  finishRun,
  hashSeed,
  isFinished,
  startRun,
  type AssessmentQuestion,
  type PlacementEvent,
  type PlacementMode,
  type PlacementResult,
} from '..';
import { STAGE1_15 } from './fixtures/stage1-15';
import { makeBank } from './fixtures/placement-bank';

/**
 * Simulated learners (F-PLC-001 section 5, appendix D): the real engine, a
 * synthetic bank and seeded learners, 1,000 runs each. Deterministic: every run
 * has its own seed, and no clock or Math.random is read.
 */

const rungOf = (id: string): string => {
  const m = /^pitem:(recog|sound-basic|sound-rest|syl-cvc|syl-cv)-/.exec(id);
  if (m !== null) return m[1] as string;
  if (id.startsWith('pitem:vocab-read')) return 'vocab:read';
  if (id.startsWith('pitem:vocab-hear')) return 'vocab:oral';
  if (id.startsWith('pitem:sent-hear')) return 'sentence:oral';
  return 'sentence:read';
};

interface Learner {
  name: string;
  /**
   * Chance of the right answer per rung; `'guess'` picks any option uniformly; `'never-first'` picks
   * any option but the first; `'slot-1'` always taps the second card; `'unsure'` taps "I am not sure".
   */
  accuracy: (rung: string) => number | 'guess' | 'never-first' | 'slot-1' | 'unsure';
}

const DECODING = ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'];
const isOral = (rung: string): boolean => rung.endsWith(':oral');

const LEARNERS: Record<string, Learner> = {
  zero: { name: 'zero', accuracy: () => 'unsure' },
  guesser: { name: 'guesser', accuracy: () => 'guess' },
  neverFirst: { name: 'neverFirst', accuracy: () => 'never-first' },
  slotOne: { name: 'slotOne', accuracy: () => 'slot-1' },
  lettersOnly: {
    name: 'lettersOnly',
    accuracy: (r) => (r === 'recog' || r === 'sound-basic' ? 0.9 : 0.3),
  },
  decoder: { name: 'decoder', accuracy: (r) => (DECODING.includes(r) ? 0.92 : 0.3) },
  heritageListener: { name: 'heritageListener', accuracy: (r) => (isOral(r) ? 0.9 : 0.25) },
  advanced: { name: 'advanced', accuracy: () => 0.97 },
};

interface Outcome {
  asked: number;
  result: PlacementResult;
}

const BANK = makeBank();

const simulate = (learner: Learner, index: number, mode: PlacementMode = 'standard'): Outcome => {
  const seed = hashSeed(['sim', learner.name, mode, String(index)]);
  const rng = createRng(hashSeed(['learner', learner.name, String(index)]));
  let now = 1_000;
  let state = startRun(
    BANK,
    { mode, revealMode: 'tap', audio: true, visual: true, takeMyTime: false, seed, exclude: [], resolvesPicture: () => true },
    now,
  );
  for (let guard = 0; guard < 100 && !isFinished(state); guard += 1) {
    now += 4_000;
    if (state.pause !== null) {
      state = apply(state, { type: 'keepGoing' }, now);
      continue;
    }
    const question = currentQuestion(state) as AssessmentQuestion;
    const behaviour = learner.accuracy(rungOf(question.id));
    let event: PlacementEvent;
    if (behaviour === 'unsure') event = { type: 'notSure' };
    else {
      const right = question.options.find((o) => o.isCorrect)!;
      const others = question.options.filter((o) => !o.isCorrect);
      let pick = right;
      if (behaviour === 'guess') pick = question.options[Math.floor(rng() * question.options.length)] as typeof right;
      else if (behaviour === 'never-first') pick = question.options[1 + Math.floor(rng() * (question.options.length - 1))] as typeof right;
      else if (behaviour === 'slot-1') pick = question.options[1] as typeof right;
      else if (rng() >= behaviour) pick = others[Math.floor(rng() * others.length)] as typeof right;
      event = { type: 'answer', optionId: pick.id };
    }
    state = apply(state, event, now);
  }
  const result = finishRun(state, {
    catalog: STAGE1_15,
    isEntitled: () => true,
    completedQuestIds: new Set(),
    completedAt: '2026-10-10T10:06:00.000Z',
    contentVer: 'sim',
    testLocale: 'en',
    source: 'onboarding',
  });
  return { asked: result.responses.length, result };
};

const RUNS = 1_000;
const many = (learner: Learner, mode: PlacementMode = 'standard'): Outcome[] =>
  Array.from({ length: RUNS }, (_, i) => simulate(learner, i, mode));
const aboveBand = (o: Outcome, band: number): boolean => o.result.level.stage !== 'stage1' || o.result.level.band > band;
const share = (outcomes: Outcome[], test: (o: Outcome) => boolean): number => outcomes.filter(test).length / outcomes.length;
const bandOneOrLower = (o: Outcome): boolean => o.result.level.stage === 'stage1' && o.result.level.band <= 1;

describe('simulated learners, Standard (1,000 seeded runs each)', () => {
  it('a learner with no Korean who taps "I am not sure" is asked exactly 12 questions and starts at the first quest', () => {
    const runs = many(LEARNERS.zero as Learner).slice(0, 50);
    for (const { asked, result } of runs) {
      expect(asked).toBe(12);
      expect(result.level).toEqual({ stage: 'stage1', band: 0 });
      expect(result.placedOutQuestIds).toEqual([]);
      expect(result.startQuestId).toBe('quest:stage1-letters-q1');
      expect(result.stopReason).toBe('complete');
      expect(result.responses.every((r) => r.outcome === 'skipped')).toBe(true);
      expect(result.responses.some((r) => r.outcome === 'wrong')).toBe(false);
    }
  });

  it('a random guesser lands at band 1 or lower in at least 95 percent of runs (4-option items)', () => {
    const runs = many(LEARNERS.guesser as Learner);
    expect(share(runs, bandOneOrLower)).toBeGreaterThanOrEqual(0.95);
    expect(share(runs, (o) => o.result.level.band === 0 && o.result.level.stage === 'stage1')).toBeGreaterThan(0.9);
    for (const { asked } of runs) {
      expect(asked).toBeGreaterThanOrEqual(12);
      expect(asked).toBeLessThanOrEqual(24);
    }
  });

  it('a tapper who never picks the first card, or always the second, does no better than chance', () => {
    for (const learner of [LEARNERS.neverFirst, LEARNERS.slotOne] as Learner[]) {
      const runs = many(learner);
      expect(share(runs, bandOneOrLower)).toBeGreaterThanOrEqual(0.97);
      expect(share(runs, (o) => aboveBand(o, 0))).toBeLessThanOrEqual(0.06);
    }
  });

  it('a learner who knows the first letter sounds but cannot blend is placed at the start or at band 1, not higher, in nearly every run', () => {
    const runs = many(LEARNERS.lettersOnly as Learner);
    expect(share(runs, bandOneOrLower)).toBeGreaterThanOrEqual(0.9);
    expect(share(runs, (o) => o.result.level.band === 1)).toBeGreaterThan(0.05);
    expect(share(runs, (o) => o.result.strands['sound-letter'] !== 'not-tested')).toBe(1);
  });

  it('a learner who decodes well but cannot read words yet is placed at band 3 or at stage2 in most runs', () => {
    const runs = many(LEARNERS.decoder as Learner);
    const high = share(runs, (o) => (o.result.level.stage === 'stage1' && o.result.level.band === 3) || o.result.level.stage !== 'stage1');
    expect(high).toBeGreaterThan(0.85);
    for (const { asked } of runs) expect(asked).toBeLessThanOrEqual(24);
  });

  it('a heritage listener who understands but cannot read starts at the beginning, with the listening level reported apart', () => {
    const runs = many(LEARNERS.heritageListener as Learner);
    expect(share(runs, (o) => o.result.level.stage === 'stage1' && o.result.level.band === 0)).toBeGreaterThanOrEqual(0.9);
    expect(share(runs, (o) => o.result.oralStage === 'stage3' || o.result.oralStage === 'stage2')).toBeGreaterThan(0.9);
    expect(share(runs, (o) => o.result.oralStage === null)).toBeLessThan(0.1);
  });

  it('an advanced learner is placed at stage3 (beyond the content) in nearly every run, with every Stage 1 quest placed out and none completed', () => {
    const runs = many(LEARNERS.advanced as Learner);
    expect(share(runs, (o) => o.result.level.stage === 'stage3')).toBeGreaterThanOrEqual(0.95);
    for (const { result, asked } of runs.filter((o) => o.result.level.stage === 'stage3')) {
      expect(asked).toBe(24);
      expect(result.placedOutQuestIds).toHaveLength(15);
      expect(result.startQuestId).toBeNull();
    }
  });

});

describe('simulated learners, Short and Deep (1,000 seeded runs each)', () => {
  it('Short asks 6 to 9 questions and never places above band 1, whoever takes it; at most q1 to q3 are placed out', () => {
    for (const learner of Object.values(LEARNERS)) {
      for (const { asked, result } of many(learner, 'short').slice(0, 300)) {
        expect(asked).toBeGreaterThanOrEqual(6);
        expect(asked).toBeLessThanOrEqual(9);
        expect(bandOneOrLower({ asked, result })).toBe(true);
        expect(result.placedOutQuestIds.length).toBeLessThanOrEqual(3);
        expect(result.mode).toBe('short');
        expect(result.length).toBe('quick');
      }
    }
  });

  it('Short: any guesser lands above band 0 in at most 1 percent of runs (the strict 3-of-3 syllable rung)', () => {
    for (const learner of [LEARNERS.guesser, LEARNERS.neverFirst, LEARNERS.slotOne] as Learner[]) {
      expect(share(many(learner, 'short'), (o) => aboveBand(o, 0))).toBeLessThanOrEqual(0.01);
    }
  });

  it('Short: "not sure" on every item is 6 questions at band 0 with no pause; an advanced learner is at band 1 in most runs', () => {
    for (const { asked, result } of many(LEARNERS.zero as Learner, 'short').slice(0, 50)) {
      expect(asked).toBe(6);
      expect(result.level).toEqual({ stage: 'stage1', band: 0 });
      expect(result.stopReason).toBe('complete');
    }
    expect(share(many(LEARNERS.advanced as Learner, 'short'), (o) => o.result.level.band === 1)).toBeGreaterThan(0.85);
  });

  it('Deep: any guesser lands above band 1 in at most 0.5 percent of runs; at most 42 questions', () => {
    for (const learner of [LEARNERS.guesser, LEARNERS.neverFirst, LEARNERS.slotOne] as Learner[]) {
      const runs = many(learner, 'deep');
      expect(share(runs, (o) => aboveBand(o, 1))).toBeLessThanOrEqual(0.005);
      for (const { asked } of runs) expect(asked).toBeLessThanOrEqual(42);
    }
  });

  it('Deep: an advanced learner reaches stage3 in nearly every run, with listening measured', () => {
    const runs = many(LEARNERS.advanced as Learner, 'deep');
    expect(share(runs, (o) => o.result.level.stage === 'stage3')).toBeGreaterThanOrEqual(0.9);
    expect(share(runs, (o) => o.result.oralStage !== null)).toBe(1);
    for (const { asked } of runs) expect(asked).toBeLessThanOrEqual(42);
  });

  it('"not sure" on every item is band 0 in every mode', () => {
    for (const mode of ['short', 'standard', 'deep'] as const) {
      for (const { result } of many(LEARNERS.zero as Learner, mode).slice(0, 50)) {
        expect(result.level).toEqual({ stage: 'stage1', band: 0 });
      }
    }
  });

  it('placement grants nothing: no result of any simulated learner carries a completion, star, card or homework', () => {
    for (const learner of Object.values(LEARNERS)) {
      const { result } = simulate(learner, 7);
      for (const key of ['quests', 'episodes', 'cards', 'homework', 'sessions', 'streakDays', 'stars']) {
        expect(result).not.toHaveProperty(key);
      }
      expect(result.responses.every((r) => r.outcome !== undefined)).toBe(true);
    }
  });

  it('is reproducible: the same learner and seed give the same result', () => {
    const a = simulate(LEARNERS.lettersOnly as Learner, 5);
    const b = simulate(LEARNERS.lettersOnly as Learner, 5);
    expect(b).toEqual(a);
  });
});
