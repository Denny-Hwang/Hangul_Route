import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// PV-1b ships the sentence switch at 3. This file raises it to 4 for every importer of `placement/rungs`
// (the engine reads the derived helpers there), so the engine rules PV-1c turns on are tested before PV-1c.
vi.mock('../placement/rungs', async (importOriginal) => {
  const real = await importOriginal<typeof import('../placement/rungs')>();
  return {
    ...real,
    SENTENCE_QUESTIONS: 4,
    questionsFor: (gate: Parameters<typeof real.questionsFor>[0]) => real.questionsFor(gate, 4),
    passAtFor: (mode: Parameters<typeof real.passAtFor>[0], gate: Parameters<typeof real.passAtFor>[1], size?: number) =>
      real.passAtFor(mode, gate, size ?? real.questionsFor(gate, 4)),
    questionCap: (mode: Parameters<typeof real.questionCap>[0]) => real.questionCap(mode, 4),
  };
});

import {
  PlacementResultSchema,
  PlacementRunStateSchema,
  SENTENCE_QUESTIONS,
  apply,
  currentQuestion,
  finishRun,
  isFinished,
  questionCap,
  startRun,
  type AssessmentQuestion,
  type FinishContext,
  type PlacementConfig,
  type PlacementEvent,
  type PlacementMode,
  type PlacementRunState,
} from '..';
import { FULL_ROUTE } from './fixtures/stage1-15';
import { makeBank } from './fixtures/placement-bank';
import { PlacementResultSchemaV1 } from './fixtures/placement-result-schema-v1';

const config = (over: Partial<PlacementConfig> = {}): PlacementConfig => ({
  mode: 'standard',
  revealMode: 'tap',
  audio: true,
  visual: true,
  takeMyTime: true,
  seed: 7,
  exclude: [],
  resolvesPicture: () => true,
  ...over,
});
const context: FinishContext = {
  catalog: FULL_ROUTE,
  isEntitled: () => true,
  completedQuestIds: new Set<string>(),
  completedAt: '2026-10-10T10:06:00.000Z',
  contentVer: 'test',
  testLocale: 'en',
  source: 'onboarding',
};

type Verdict = 'correct' | 'wrong';
const rungOf = (id: string): string => {
  const m = /^pitem:(recog|sound-basic|sound-rest|syl-cvc|syl-cv)-/.exec(id);
  if (m !== null) return m[1] as string;
  if (id.startsWith('pitem:vocab-read')) return 'vocab:read';
  if (id.startsWith('pitem:vocab-hear')) return 'vocab:oral';
  if (id.startsWith('pitem:sent-hear')) return 'sentence:oral';
  return 'sentence:read';
};
const eventFor = (q: AssessmentQuestion, verdict: Verdict): PlacementEvent => {
  const pick = q.options.find((o) => o.isCorrect === (verdict === 'correct')) as { id: string };
  return { type: 'answer', optionId: pick.id };
};
const play = (start: PlacementRunState, verdicts: Record<string, Verdict> = {}, t0 = 1_000) => {
  let state = start;
  let t = t0;
  const asked: string[] = [];
  for (let guard = 0; guard < 200 && !isFinished(state); guard += 1) {
    if (state.pause !== null) {
      state = apply(state, { type: 'keepGoing' }, t);
      continue;
    }
    const q = currentQuestion(state) as AssessmentQuestion;
    asked.push(q.id);
    t += 3_000;
    state = apply(state, eventFor(q, verdicts[rungOf(q.id)] ?? 'correct'), t);
  }
  return { state, asked };
};
const run = (over: Partial<PlacementConfig> = {}) => startRun(makeBank(), config(over), 1_000);
const fail = (...rungs: string[]): Record<string, Verdict> => Object.fromEntries(rungs.map((r) => [r, 'wrong' as const]));
const formatOf = (id: string): string => makeBank().templates.find((t) => t.id === id)!.question.format;
const result = (state: PlacementRunState) => finishRun(state, context);

describe('with the switch at 4 (PV-1c will turn it; PV-1b tests the engine rules)', () => {
  it('SENTENCE_QUESTIONS is 4 here and the caps follow: Standard 25, Deep 45', () => {
    expect(SENTENCE_QUESTIONS).toBe(4);
    expect(questionCap('standard')).toBe(25);
    expect(questionCap('deep')).toBe(45);
    expect(questionCap('short')).toBeNull();
  });

  it('the sentence read draw is three pictures and one reply; the oral draw is four pictures; every other rung stays at three', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const s = run({ seed, mode: 'deep' });
      const formats = (key: string) => (s.draws[key] ?? []).map((q) => q.format);
      expect(formats('sentence:read')).toEqual(['read-pick-picture', 'read-pick-picture', 'read-pick-picture', 'reply-pick']);
      expect(formats('sentence:read:2')).toEqual(['read-pick-picture', 'read-pick-picture', 'read-pick-picture', 'reply-pick']);
      expect(formats('sentence:oral')).toHaveLength(4);
      expect(new Set(formats('sentence:oral'))).toEqual(new Set(['hear-pick-picture']));
      for (const [key, questions] of Object.entries(s.draws)) if (!key.startsWith('sentence')) expect(questions, key).toHaveLength(3);
      expect(s.current?.questions).toHaveLength(3);
    }
  });

  it('a read draw with no reply tops up from the pictures; a bank too small for four is unavailable, not a fail', () => {
    const bank = makeBank();
    const noReplies = { ...bank, templates: bank.templates.filter((t) => t.question.format !== 'reply-pick') };
    expect(startRun(noReplies, config({ mode: 'deep' }), 1_000).draws['sentence:read']).toHaveLength(4);
    const keep = new Set(['pitem:sent-hear-0', 'pitem:sent-hear-1', 'pitem:sent-hear-2']);
    const three = { ...bank, templates: bank.templates.filter((t) => !(t.gate === 'sentence' && t.form === 'oral') || keep.has(t.id)) };
    expect(startRun(three, config({ mode: 'standard' }), 1_000).draws['sentence:oral']).toBeUndefined();
  });

  it('the rung closes after four answers: a pass needs 3 of 4, and the fourth question is asked even after a fail is certain', () => {
    const pass = play(run(), fail());
    expect(pass.state.done.filter((d) => d.gate === 'sentence')).toEqual([{ gate: 'sentence', form: 'read', asked: 4, correct: 4, assisted: 0, result: 'pass' }]);
    let s = run();
    const rungs: string[] = [];
    // answer rung by rung until the sentence read rung is open
    for (let guard = 0; guard < 100 && s.current?.gate !== 'sentence'; guard += 1) {
      s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 1_000 + guard * 1_000);
      rungs.push(s.current?.gate ?? 'end');
    }
    expect(s.current?.questions).toHaveLength(4);
    const t = 500_000;
    s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), t);
    s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), t + 1_000);
    expect(s.current?.gate).toBe('sentence'); // 3 can no longer be reached, but the rung still asks all four
    s = apply(s, eventFor(currentQuestion(s)!, 'correct'), t + 2_000);
    expect(s.current?.gate).toBe('sentence');
    s = apply(s, eventFor(currentQuestion(s)!, 'correct'), t + 3_000);
    expect(s.done.find((d) => d.gate === 'sentence')).toEqual({ gate: 'sentence', form: 'read', asked: 4, correct: 2, assisted: 0, result: 'fail' });
    expect(isFinished(s)).toBe(true);
  });

  it('exactly 3 of 4 passes; 2 of 4 fails (the oral form too)', () => {
    const outcomes = (verdicts: Verdict[]) => {
      let s = run({ mode: 'standard' });
      for (let guard = 0; guard < 100 && !(s.current?.gate === 'vocab' && s.current.form === 'oral'); guard += 1) {
        s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), 1_000 + guard * 1_000);
      }
      s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 90_000);
      s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 91_000);
      s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 92_000);
      expect(s.current).toMatchObject({ gate: 'sentence', form: 'oral' });
      verdicts.forEach((v, i) => {
        s = apply(s, eventFor(currentQuestion(s)!, v), 100_000 + i * 1_000);
      });
      return s.done.find((d) => d.gate === 'sentence' && d.form === 'oral');
    };
    expect(outcomes(['correct', 'correct', 'correct', 'wrong'])).toMatchObject({ asked: 4, correct: 3, result: 'pass' });
    expect(outcomes(['wrong', 'correct', 'correct', 'correct'])).toMatchObject({ asked: 4, correct: 3, result: 'pass' });
    expect(outcomes(['correct', 'wrong', 'wrong', 'correct'])).toMatchObject({ asked: 4, correct: 2, result: 'fail' });
  });

  it('a prompt that could not play never fails the rung: three heard and right pass, a sound-less rung stays undecided', () => {
    let s = run({ mode: 'standard' });
    for (let guard = 0; guard < 100 && !(s.current?.gate === 'vocab' && s.current.form === 'oral'); guard += 1) {
      s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), 1_000 + guard * 1_000);
    }
    for (let i = 0; i < 3; i += 1) s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 90_000 + i * 1_000);
    s = apply(s, { type: 'notSure', cause: 'no-sound' }, 100_000);
    expect(s.pause).toBeNull();
    for (let i = 0; i < 3; i += 1) s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 101_000 + i * 1_000);
    expect(s.done.find((d) => d.gate === 'sentence')).toEqual({ gate: 'sentence', form: 'oral', asked: 3, correct: 3, assisted: 0, result: 'pass' });
  });
});

describe('question counts at 4 (spec section 3.6)', () => {
  const LADDER = ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'];
  const standard: [string, string[], number, string][] = [
    ['fails sound-basic', ['sound-basic'], 13, 'complete'],
    ['fails syl-cv', ['syl-cv'], 16, 'complete'],
    ['fails sound-rest', ['sound-rest'], 19, 'complete'],
    ['fails vocab read once, hears words once', ['vocab:read'], 21, 'complete'],
    ['fails syl-cvc', ['syl-cvc'], 22, 'complete'],
    ['reads sentences and ends at the longest path', [], 25, 'cap'],
  ];
  for (const [name, failing, asked, stop] of standard) {
    it(`Standard ${name}: ${asked} questions, ${stop}`, () => {
      const { state, asked: ids } = play(run({ mode: 'standard' }), fail(...failing));
      expect(ids).toHaveLength(asked);
      expect(state.stop).toBe(stop);
    });
  }

  it('Standard: a vocab read that fails its confirming draw hears words once and asks 24', () => {
    // the confirming draw is the second vocab:read rung: fail it only (the first draw's three questions pass)
    let s = run({ mode: 'standard' });
    let t = 1_000;
    let vocabReadQuestions = 0;
    const ids: string[] = [];
    for (let guard = 0; guard < 100 && !isFinished(s); guard += 1) {
      const q = currentQuestion(s) as AssessmentQuestion;
      ids.push(q.id);
      if (rungOf(q.id) === 'vocab:read') vocabReadQuestions += 1;
      t += 3_000;
      s = apply(s, eventFor(q, rungOf(q.id) === 'vocab:read' && vocabReadQuestions > 3 ? 'wrong' : 'correct'), t);
    }
    expect(ids).toHaveLength(24);
    expect(s.stop).toBe('complete');
  });

  it('Deep: the longest path is 45 and ends cap; a Deep run that stops early is shorter and never `cap`', () => {
    const longest = play(run({ mode: 'deep' }));
    expect(longest.asked).toHaveLength(45);
    expect(longest.state.stop).toBe('cap');
    const early = play(run({ mode: 'deep' }), fail('sound-basic'));
    expect(early.asked.length).toBeLessThan(45);
    expect(early.state.stop).toBe('complete');
  });

  it('every Standard and Deep run on a seeded sweep stays within 13 to 25 and 13 to 45 questions', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const rungs = [...LADDER, 'vocab:read', 'sentence:read', 'vocab:oral', 'sentence:oral'];
      const failing = rungs.filter((_, i) => (seed >> (i % 8)) % 2 === 1 && i > 0);
      for (const mode of ['standard', 'deep'] as PlacementMode[]) {
        const { asked } = play(run({ mode, seed }), fail(...failing));
        expect(asked.length).toBeGreaterThanOrEqual(13);
        expect(asked.length).toBeLessThanOrEqual(mode === 'standard' ? 25 : 45);
      }
    }
  });

  it('Short is unchanged (it has no sentence rung): 6 or 9', () => {
    expect(play(run({ mode: 'short' })).asked).toHaveLength(9);
    expect(play(run({ mode: 'short' }), fail('sound-basic')).asked).toHaveLength(6);
  });
});

describe('stored results at 4 (spec section 3.7: what old readers see)', () => {
  it('every result parses with the live schema; only the paths that end with vocab oral still parse with the pre-change schema', () => {
    const cases: [string[], boolean][] = [
      [['sound-basic'], false], // 13: ends with sentence oral, four questions
      [['syl-cv'], false], // 16
      [['sound-rest'], false], // 19
      [['vocab:read'], true], // 21: ends with vocab oral
      [['syl-cvc'], false], // 22
      [[], false], // 25: a four-question sentence read row
    ];
    for (const [failing, parsesOld] of cases) {
      const r = result(play(run({ mode: 'standard' }), fail(...failing)).state);
      expect(PlacementResultSchema.safeParse(r).success, failing.join()).toBe(true);
      expect(PlacementResultSchemaV1.safeParse(r).success, failing.join()).toBe(parsesOld);
      expect(Math.max(...r.gates.map((g) => g.asked))).toBe(parsesOld ? 3 : 4);
    }
  });

  it('Short results still parse with the pre-change schema', () => {
    for (const failing of [[], ['sound-basic']]) expect(PlacementResultSchemaV1.safeParse(result(play(run({ mode: 'short' }), fail(...failing)).state)).success).toBe(true);
  });
});

describe('saved runs at 4', () => {
  const openSentence = (): PlacementRunState => {
    let s = run({ mode: 'standard' });
    for (let guard = 0; guard < 100 && s.current?.gate !== 'sentence'; guard += 1) s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 1_000 + guard * 1_000);
    s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 200_000);
    return apply(s, eventFor(currentQuestion(s)!, 'wrong'), 201_000);
  };

  it('a run saved inside a four-question rung parses, resumes at the same question and finishes the same as one that never stopped', () => {
    const s = openSentence();
    expect(s.current?.questions).toHaveLength(4);
    const revived = PlacementRunStateSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(revived).toEqual(s);
    expect(currentQuestion(revived)).toEqual(currentQuestion(s));
    expect(result(play(revived, {}, 300_000).state)).toEqual(result(play(s, {}, 300_000).state));
    expect(PlacementResultSchema.safeParse(result(play(revived, {}, 300_000).state)).success).toBe(true);
  });

  it('a run stopped inside a four-question rung keeps the answers asked, scored against four', () => {
    const stopped = apply(openSentence(), { type: 'quit', by: 'learner' }, 210_000);
    const r = result(stopped);
    expect(r.gates.at(-1)).toEqual({ gate: 'sentence', form: 'read', asked: 2, correct: 1, assisted: 0, result: 'not-run', reason: 'stopped' });
    expect(PlacementResultSchema.safeParse(r).success).toBe(true);
  });

  it('a run saved before PV-1b (three-question sentence rung) resumes under the four switch and closes at three, passing at 2 of 3', () => {
    const saved = JSON.parse(readFileSync(new URL('./fixtures/placement-run-state-standard-sentence-read.json', import.meta.url), 'utf8')) as PlacementRunState;
    let s = PlacementRunStateSchema.parse(saved);
    expect(s.current?.questions).toHaveLength(3);
    s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), 200_000);
    s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 201_000);
    expect(s.done.filter((d) => d.gate === 'sentence')).toEqual([{ gate: 'sentence', form: 'read', asked: 3, correct: 2, assisted: 0, result: 'pass' }]);
    // the old state's prebuilt oral draw is three questions too, and is asked as three
    const oral = PlacementRunStateSchema.parse(saved);
    expect(oral.draws['sentence:oral']).toHaveLength(3);
  });

  it('the old Deep state keeps its prebuilt three-question sentence oral draw: asked as three, 2 of 3 passes', () => {
    const saved = JSON.parse(readFileSync(new URL('./fixtures/placement-run-state-deep-sentence-read-2.json', import.meta.url), 'utf8')) as PlacementRunState;
    const { state, asked } = play(PlacementRunStateSchema.parse(saved), {}, 300_000);
    const oralIds = asked.filter((id) => rungOf(id) === 'sentence:oral');
    expect(oralIds).toHaveLength(3);
    // 42 asked: a full run, but under the new cap (45) it is labelled `complete`; `complete` and `cap` are both full runs.
    expect(state.responses).toHaveLength(42);
    expect(state.stop).toBe('complete');
    expect(result(state).gates.filter((g) => g.gate === 'sentence').every((g) => g.asked === 3)).toBe(true);
  });
});
