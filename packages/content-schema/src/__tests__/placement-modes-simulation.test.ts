import { describe, expect, it } from 'vitest';
import * as builder from '../../../../scripts/build-placement-bank.mjs';
import {
  PlacementResultSchema,
  apply,
  createRng,
  currentQuestion,
  finishRun,
  hashSeed,
  isFinished,
  modeOf,
  startRun,
  type AssessmentQuestion,
  type PlacementBank,
  type PlacementEvent,
  type PlacementMode,
  type PlacementTemplate,
} from '../index';
import { REPO_ROOT } from './helpers/romanization-registry';
import { STAGE1_15 } from './fixtures/stage1-15';
import { PlacementResultSchemaV1 } from './fixtures/placement-result-schema-v1';

/**
 * The mode table of F-PLC-001 (P14 to P17, appendix D) on the shipped bank, with the
 * per-item time model of the amendment: simulated learners drive the real engine
 * (`startRun`, `apply`, `finishRun`) and every result is parsed as written. Fully
 * deterministic (every run is seeded), at most 300 runs per cell so CI stays fast.
 * The design run used 2,000 runs per cell; the bounds here leave room for sampling
 * noise and fail when a change of the engine or the bank moves a mode out of its row.
 */

const build = builder as unknown as { loadModel: (root: string) => { bank: PlacementBank; warmup: PlacementTemplate } };
const { bank, warmup } = build.loadModel(REPO_ROOT);
const WARMUP_TAGS = warmup.question.tags.filter((t) => t.startsWith('word:'));
const RUNS = 300;

type Pick = 'uniform' | 'never-first' | 'slot-0' | 'slot-1' | 'slot-2';
interface Learner {
  name: string;
  /** Chance the learner knows an item of a rung (`gate:form`). */
  know: (rung: string) => number;
  /** When the learner does not know: chance of "I am not sure" (else a guess). */
  unsure: number;
  pick?: Pick;
}
const table =
  (m: Record<string, number>) =>
  (rung: string): number =>
    m[rung] ?? 0;
const GUESSERS: Learner[] = (['uniform', 'never-first', 'slot-0', 'slot-1', 'slot-2'] as const).map((pick) => ({
  name: `guesser (${pick})`,
  know: () => 0,
  unsure: 0,
  pick,
}));
const NOT_SURE: Learner = { name: 'not sure', know: () => 0, unsure: 1 };
/** True level about band 2: knows the first letters and CV syllables, half the finals, few words. */
const INTERMEDIATE: Learner = {
  name: 'intermediate',
  know: table({
    'recog:decode': 0.95,
    'sound-basic:decode': 0.92,
    'syl-cv:decode': 0.88,
    'sound-rest:decode': 0.8,
    'syl-cvc:decode': 0.45,
    'vocab:read': 0.35,
    'vocab:oral': 0.6,
    'sentence:read': 0.25,
    'sentence:oral': 0.4,
  }),
  unsure: 0.4,
};
const ADVANCED: Learner = { name: 'advanced', know: () => 0.97, unsure: 0.5 };

/** Seconds per answered item at the *Some reading* pace (levelOrder 1); x1.5 *Pictures first*. */
const ITEM_S: Record<string, number> = {
  'shape-odd-one-out': 7,
  'hear-pick-written': 9,
  'see-pick-sound': 9,
  'build-syllable': 14,
  'hear-pick-picture:vocab': 8,
  'hear-pick-picture:sentence': 11,
  'read-pick-picture:vocab': 10,
  'read-pick-picture:sentence': 14,
  'reply-pick': 15,
};
const NOT_SURE_S = 5;
const TRANSITION_S = 1.5;
const PAUSE_S = 8;
const REST_S = 10;
const WARMUP_S = 30;
/** Spoken overheads do not speed up for a fast learner: the instruction once per rung, a cheer. */
const INSTRUCTION_S = 2.5;
const CHEER_S = 2;
const PACE = [1.5, 1.0, 0.8];

const gauss = (rng: () => number): number => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());

const guess = (q: AssessmentQuestion, pick: Pick, rng: () => number): string => {
  const n = q.options.length;
  const index = pick === 'uniform' ? Math.floor(rng() * n) : pick === 'never-first' ? 1 + Math.floor(rng() * (n - 1)) : Math.min(Number(pick.slice(5)), n - 1);
  return (q.options[index] as { id: string }).id;
};

interface Run {
  asked: number;
  minutes: number;
  rank: number;
  stage: string;
  placedOut: number;
  oralStage: string | null;
  stop: string;
  formats: string[];
  rested: boolean;
  parsesWithOldSchema: boolean;
  modeRecovered: PlacementMode;
}

/** levelOrder 0 (*Pictures first*) runs listen-first, as the app sets it. */
const simulate = (learner: Learner, mode: PlacementMode, levelOrder: 0 | 1, index: number): Run => {
  const key = [learner.name, mode, String(levelOrder), String(index)];
  const rng = createRng(hashSeed(['modes-sim-learner', ...key]));
  const speed = Math.exp(0.25 * gauss(rng)) * (PACE[levelOrder] as number);
  let now = 1_000_000;
  let seconds = WARMUP_S;
  let rested = false;
  let state = startRun(
    bank,
    {
      mode,
      listenFirst: levelOrder === 0,
      avoidTags: WARMUP_TAGS,
      revealMode: 'tap',
      audio: true,
      visual: true,
      takeMyTime: false,
      seed: hashSeed(['modes-sim', ...key]),
      exclude: [],
      resolvesPicture: () => true,
    },
    now,
  );
  const formats: string[] = [];
  let rungStart = -1;
  for (let guard = 0; guard < 120 && !isFinished(state); guard += 1) {
    if (state.pause !== null) {
      const wait = state.pause === 'rest' ? REST_S : PAUSE_S;
      rested ||= state.pause === 'rest';
      now += wait * 1000;
      seconds += wait;
      state = apply(state, { type: 'keepGoing' }, now);
      continue;
    }
    const open = state.current as NonNullable<typeof state.current>;
    const q = currentQuestion(state) as AssessmentQuestion;
    formats.push(q.format);
    const timeKey = q.format === 'hear-pick-picture' || q.format === 'read-pick-picture' ? `${q.format}:${open.gate}` : q.format;
    let event: PlacementEvent;
    let base: number;
    if (rng() < learner.know(`${open.gate}:${open.form}`)) {
      event = { type: 'answer', optionId: (q.options.find((o) => o.isCorrect) as { id: string }).id };
      base = ITEM_S[timeKey] as number;
    } else if (rng() < learner.unsure) {
      event = { type: 'notSure' };
      base = NOT_SURE_S;
    } else {
      event = { type: 'answer', optionId: guess(q, learner.pick ?? 'uniform', rng) };
      base = ITEM_S[timeKey] as number;
    }
    let s = base * speed * Math.exp(0.35 * gauss(rng)) + TRANSITION_S;
    if (open.start !== rungStart) {
      s += INSTRUCTION_S;
      rungStart = open.start;
    }
    if ((state.responses.length + 1) % (mode === 'short' ? 2 : 3) === 0) s += CHEER_S;
    seconds += s;
    now += Math.round(s * 1000);
    state = apply(state, { type: 'tick' }, now);
    if (isFinished(state) || state.pause !== null) continue;
    state = apply(state, event, now);
  }
  expect(isFinished(state)).toBe(true);
  const result = finishRun(state, {
    catalog: STAGE1_15,
    isEntitled: () => true,
    completedQuestIds: new Set(),
    completedAt: '2026-10-11T10:00:00.000Z',
    contentVer: 'sim',
    testLocale: 'en',
    source: 'onboarding',
  });
  PlacementResultSchema.parse(result);
  const old = PlacementResultSchemaV1.safeParse(result);
  const stageNumber = Number(result.level.stage.slice(5));
  return {
    asked: result.responses.length,
    minutes: seconds / 60,
    rank: (stageNumber - 1) * 10 + result.level.band,
    stage: result.level.stage,
    placedOut: result.placedOutQuestIds.length,
    oralStage: result.oralStage,
    stop: result.stopReason,
    formats,
    rested,
    parsesWithOldSchema: old.success,
    // An old reader drops `mode`; `modeOf` reads the legacy `length`.
    modeRecovered: old.success ? modeOf(old.data) : modeOf(result),
  };
};

const runs = (learner: Learner, mode: PlacementMode, levelOrder: 0 | 1): Run[] =>
  Array.from({ length: RUNS }, (_, i) => simulate(learner, mode, levelOrder, i));
const share = (xs: readonly Run[], f: (r: Run) => boolean): number => xs.filter(f).length / xs.length;
const p90 = (xs: readonly Run[]): number => {
  const sorted = xs.map((r) => r.minutes).sort((a, b) => a - b);
  return sorted[Math.floor(0.9 * sorted.length)] as number;
};
const aboveBand0 = (r: Run): boolean => r.rank > 0;
const aboveBand1 = (r: Run): boolean => r.rank > 1;

describe('Short (Pictures first pace): very short, listen-first, conservative', () => {
  const all = [...GUESSERS, NOT_SURE, INTERMEDIATE, ADVANCED].map((l) => ({ learner: l, runs: runs(l, 'short', 0) }));

  it('asks 6 to 9 questions, ends complete, never above band 1 and never more than q1 to q3 placed out', () => {
    for (const { learner, runs: rs } of all) {
      for (const r of rs) {
        expect(r.asked, learner.name).toBeGreaterThanOrEqual(6);
        expect(r.asked, learner.name).toBeLessThanOrEqual(9);
        expect(r.stop, learner.name).toBe('complete');
        expect(aboveBand1(r), learner.name).toBe(false);
        expect(r.placedOut, learner.name).toBeLessThanOrEqual(3);
        expect(r.formats, learner.name).not.toContain('see-pick-sound');
        expect(r.formats, learner.name).not.toContain('build-syllable');
      }
    }
  });

  it('every guessing pattern stays at band 0 in at least 99 % of runs', () => {
    for (const { learner, runs: rs } of all.slice(0, GUESSERS.length)) expect(share(rs, aboveBand0), learner.name).toBeLessThanOrEqual(0.01);
  });

  it('takes a few minutes: p90 at most 5 minutes even for a learner who answers all nine', () => {
    for (const { learner, runs: rs } of all) expect(p90(rs), learner.name).toBeLessThanOrEqual(5);
  });

  it('places knowers at band 1 most of the time (the 3-of-3 rule errs low, the report hint covers the rest)', () => {
    const [intermediate, advanced] = all.slice(-2) as { runs: Run[] }[];
    expect(share(intermediate!.runs, aboveBand0)).toBeGreaterThanOrEqual(0.6);
    expect(share(advanced!.runs, aboveBand0)).toBeGreaterThanOrEqual(0.88);
  });

  it('every result parses with the pre-change schema and reads back as Short', () => {
    for (const { runs: rs } of all) {
      for (const r of rs) {
        expect(r.parsesWithOldSchema).toBe(true);
        expect(r.modeRecovered).toBe('short');
      }
    }
  });
});

describe('Standard (Some reading pace): the default, usually under 10 minutes', () => {
  const guessers = GUESSERS.map((l) => ({ learner: l, runs: runs(l, 'standard', 1) }));
  const notSure = runs(NOT_SURE, 'standard', 1);
  const intermediate = runs(INTERMEDIATE, 'standard', 1);
  const advanced = runs(ADVANCED, 'standard', 1);

  it('asks 12 to 24 questions', () => {
    for (const r of [...guessers.flatMap((g) => g.runs), ...notSure, ...intermediate, ...advanced]) {
      expect(r.asked).toBeGreaterThanOrEqual(12);
      expect(r.asked).toBeLessThanOrEqual(24);
    }
    expect(notSure.every((r) => r.asked === 12 && r.rank === 0)).toBe(true);
  });

  it('every guessing pattern: band 1 or lower in at least 98.5 %, above band 0 in at most 5 %', () => {
    for (const { learner, runs: rs } of guessers) {
      expect(share(rs, aboveBand1), learner.name).toBeLessThanOrEqual(0.015);
      expect(share(rs, aboveBand0), learner.name).toBeLessThanOrEqual(0.05);
    }
  });

  it('the second vocab read draw keeps the intermediate learner out of stage2 in at least 85 % of runs', () => {
    expect(share(intermediate, (r) => r.stage !== 'stage1')).toBeLessThanOrEqual(0.15);
  });

  it('a strong reader reaches stage3 in at least 95 % of runs', () => {
    expect(share(advanced, (r) => r.stage === 'stage3')).toBeGreaterThanOrEqual(0.95);
  });

  it('p90 stays under 10 minutes and the backstop ends at most 1 % of runs', () => {
    for (const rs of [intermediate, advanced]) {
      expect(p90(rs)).toBeLessThanOrEqual(10);
      expect(share(rs, (r) => r.stop === 'time')).toBeLessThanOrEqual(0.01);
    }
  });

  it('every result parses with the pre-change schema and reads back as Standard', () => {
    for (const r of [...guessers.flatMap((g) => g.runs), ...intermediate, ...advanced]) {
      expect(r.parsesWithOldSchema).toBe(true);
      expect(r.modeRecovered).toBe('standard');
    }
  });

  it('a Pictures first learner never meets Latin sound chips or tiles', () => {
    for (const r of runs(ADVANCED, 'standard', 0)) {
      expect(r.formats).not.toContain('see-pick-sound');
      expect(r.formats).not.toContain('build-syllable');
    }
  });
});

describe('Deep (Some reading pace): thorough, opt-in', () => {
  const guessers = GUESSERS.map((l) => ({ learner: l, runs: runs(l, 'deep', 1) }));
  const notSure = runs(NOT_SURE, 'deep', 1);
  const intermediate = runs(INTERMEDIATE, 'deep', 1);
  const advanced = runs(ADVANCED, 'deep', 1);

  it('asks 12 to 42 questions; a beginner is done after 12', () => {
    for (const r of [...guessers.flatMap((g) => g.runs), ...notSure, ...intermediate, ...advanced]) {
      expect(r.asked).toBeGreaterThanOrEqual(12);
      expect(r.asked).toBeLessThanOrEqual(42);
    }
    expect(notSure.every((r) => r.asked === 12 && r.rank === 0)).toBe(true);
  });

  it('every guessing pattern: above band 1 in at most 0.5 %, above band 0 in at most 1 %', () => {
    for (const { learner, runs: rs } of guessers) {
      expect(share(rs, aboveBand1), learner.name).toBeLessThanOrEqual(0.005);
      expect(share(rs, aboveBand0), learner.name).toBeLessThanOrEqual(0.01);
    }
  });

  it('sets a higher bar than Standard for the intermediate learner (above band 2 far less often)', () => {
    const standard = runs(INTERMEDIATE, 'standard', 1);
    const above2 = (r: Run): boolean => r.rank > 2;
    expect(share(intermediate, above2)).toBeLessThan(share(standard, above2) - 0.15);
  });

  it('a strong reader reaches stage3 in at least 95 % of runs, always has listening measured and gets the rest card', () => {
    expect(share(advanced, (r) => r.stage === 'stage3')).toBeGreaterThanOrEqual(0.95);
    expect(share(advanced, (r) => r.oralStage !== null)).toBe(1);
    expect(share(advanced, (r) => r.rested)).toBeGreaterThanOrEqual(0.95);
  });

  it('p90 stays under 20 minutes and the backstop ends at most 1 % of runs', () => {
    for (const rs of [intermediate, advanced]) {
      expect(p90(rs)).toBeLessThanOrEqual(20);
      expect(share(rs, (r) => r.stop === 'time')).toBeLessThanOrEqual(0.01);
    }
  });

  it('a long Deep result needs the relaxed bounds; without `mode` it reads back as Standard', () => {
    expect(share(advanced, (r) => r.parsesWithOldSchema)).toBeLessThan(0.1);
    for (const r of guessers.flatMap((g) => g.runs).filter((x) => x.parsesWithOldSchema)) expect(r.modeRecovered).toBe('standard');
  });
});
