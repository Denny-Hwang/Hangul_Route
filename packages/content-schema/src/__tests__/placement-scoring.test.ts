import { describe, expect, it } from 'vitest';
import {
  gateResult,
  levelOf,
  oralStageOf,
  rowsPassed,
  gatePassed,
  strandStatuses,
  type AssessmentResponse,
  type GateResult,
} from '..';

const r = (outcome: AssessmentResponse['outcome'], assisted = false): AssessmentResponse => ({
  questionId: `q-${outcome}-${assisted ? 'a' : 'u'}`,
  outcome,
  chosenOptionId: outcome === 'skipped' ? null : 'o',
  assisted,
  ms: 1000,
});
const C = r('correct');
const W = r('wrong');
const S = r('skipped');
const A = r('correct', true);

const gate = (
  g: GateResult['gate'],
  form: GateResult['form'],
  result: GateResult['result'],
  correct = result === 'pass' ? 3 : 0,
  asked = 3,
): GateResult => ({ gate: g, form, asked, correct, assisted: 0, result });

describe('gateResult', () => {
  it('passes on two unassisted correct answers', () => {
    expect(gateResult([C, C, W])).toEqual({ asked: 3, correct: 2, assisted: 0, result: 'pass' });
    expect(gateResult([C, C, C]).result).toBe('pass');
  });

  it('fails when three were asked and fewer than two were correct', () => {
    expect(gateResult([C, W, W]).result).toBe('fail');
    expect(gateResult([W, W, W])).toMatchObject({ correct: 0, result: 'fail' });
  });

  it('counts wrong, skipped ("not sure") and assisted answers all as not correct', () => {
    expect(gateResult([C, S, S]).result).toBe('fail');
    expect(gateResult([C, A, A])).toEqual({ asked: 3, correct: 1, assisted: 2, result: 'fail' });
    expect(gateResult([C, C, A]).result).toBe('pass');
    expect(gateResult([S, S, S])).toMatchObject({ correct: 0, assisted: 0, result: 'fail' });
  });

  it('decides early when the outcome can no longer change', () => {
    expect(gateResult([C, C]).result).toBe('pass');
    expect(gateResult([W, W]).result).toBe('fail');
    expect(gateResult([S, W]).result).toBe('fail');
  });

  it('keeps a prompt that could not play (noSound) out of asked and correct: skipped, not wrong (section 3.11)', () => {
    const N: AssessmentResponse = { ...S, questionId: 'q-silent', noSound: true };
    // One silent prompt and two right: a pass on the two that were heard.
    expect(gateResult([N, C, C])).toEqual({ asked: 2, correct: 2, assisted: 0, result: 'pass' });
    // One silent, one right, one wrong: the silent one might have been right, so undecided.
    expect(gateResult([C, N, W])).toEqual({ asked: 2, correct: 1, assisted: 0, result: 'not-run' });
    // Two silent: no evidence either way.
    expect(gateResult([N, N, W]).result).toBe('not-run');
    expect(gateResult([N, N, N])).toEqual({ asked: 0, correct: 0, assisted: 0, result: 'not-run' });
    // Two wrong on the heard ones still fail: even a right silent one could not reach two.
    expect(gateResult([W, N, W])).toMatchObject({ asked: 2, result: 'fail' });
    // Short's syl-cv needs 3 of 3: a silent prompt leaves it undecided, never failed by it.
    expect(gateResult([C, C, N], 3, 3).result).toBe('not-run');
    // A rung cut short counts only the heard prompts as asked.
    expect(gateResult([N, C], 2)).toEqual({ asked: 1, correct: 1, assisted: 0, result: 'not-run' });
  });

  it('is not-run while undecided', () => {
    expect(gateResult([]).result).toBe('not-run');
    expect(gateResult([C]).result).toBe('not-run');
    expect(gateResult([W])).toEqual({ asked: 1, correct: 0, assisted: 0, result: 'not-run' });
    expect(gateResult([C, W]).result).toBe('not-run');
  });

  it('takes an explicit asked count', () => {
    expect(gateResult([C], 3).result).toBe('fail');
    expect(gateResult([C, C], 2).asked).toBe(2);
  });
});

describe('gateResult with passAt 3 (Short syl-cv)', () => {
  it('passes only on three correct, fails as soon as three cannot be reached, else undecided', () => {
    expect(gateResult([C, C, C], 3, 3).result).toBe('pass');
    expect(gateResult([C, C, W], 3, 3)).toEqual({ asked: 3, correct: 2, assisted: 0, result: 'fail' });
    expect(gateResult([S], 1, 3).result).toBe('fail');
    expect(gateResult([C, C], 2, 3).result).toBe('not-run');
  });
});

describe('rowsPassed (one row per draw)', () => {
  it('passes when a row passed and none failed; a not-run row never turns a pass into a fail', () => {
    expect(rowsPassed([])).toBe(false);
    expect(rowsPassed([{ result: 'pass' }])).toBe(true);
    expect(rowsPassed([{ result: 'pass' }, { result: 'pass' }])).toBe(true);
    expect(rowsPassed([{ result: 'pass' }, { result: 'not-run' }])).toBe(true);
    expect(rowsPassed([{ result: 'pass' }, { result: 'fail' }])).toBe(false);
    expect(rowsPassed([{ result: 'not-run' }])).toBe(false);
    expect(rowsPassed([{ result: 'fail' }])).toBe(false);
  });

  it('drives gatePassed, the level and the strand status for two-row rungs', () => {
    const confirmed = [gate('sound-basic', 'decode', 'pass'), gate('sound-basic', 'decode', 'pass'), gate('syl-cv', 'decode', 'pass'), gate('syl-cv', 'decode', 'fail', 1)];
    expect(gatePassed(confirmed, 'sound-basic', 'decode')).toBe(true);
    expect(gatePassed(confirmed, 'syl-cv', 'decode')).toBe(false);
    expect(levelOf(confirmed)).toEqual({ stage: 'stage1', band: 0 });
    expect(strandStatuses(confirmed)['syllable-reading']).toBe('getting-there');
  });
});

describe('strandStatuses', () => {
  const none: GateResult[] = [];

  it('is not-tested for every strand when nothing ran', () => {
    expect(strandStatuses(none)).toEqual({
      'hangul-recognition': 'not-tested',
      'sound-letter': 'not-tested',
      'syllable-reading': 'not-tested',
      vocabulary: 'not-tested',
      sentences: 'not-tested',
    });
  });

  it('treats a gate that stopped undecided (not-run) as not run', () => {
    const gates = [gate('recog', 'decode', 'not-run', 1, 1)];
    expect(strandStatuses(gates)['hangul-recognition']).toBe('not-tested');
  });

  it('is secure only when every gate of the strand ran and passed', () => {
    expect(strandStatuses([gate('recog', 'decode', 'pass')])['hangul-recognition']).toBe('secure');
    const both = [gate('sound-basic', 'decode', 'pass'), gate('sound-rest', 'decode', 'pass')];
    expect(strandStatuses(both)['sound-letter']).toBe('secure');
  });

  it('is getting-there when not secure and there is a correct answer', () => {
    const half = [gate('sound-basic', 'decode', 'pass')];
    expect(strandStatuses(half)['sound-letter']).toBe('getting-there');
    const failing = [gate('syl-cv', 'decode', 'fail', 1)];
    expect(strandStatuses(failing)['syllable-reading']).toBe('getting-there');
    const passThenFail = [gate('syl-cv', 'decode', 'pass'), gate('syl-cvc', 'decode', 'fail', 0)];
    expect(strandStatuses(passThenFail)['syllable-reading']).toBe('getting-there');
  });

  it('is not-yet when a gate ran and nothing was correct', () => {
    expect(strandStatuses([gate('sound-basic', 'decode', 'fail', 0)])['sound-letter']).toBe('not-yet');
  });

  it('counts only unassisted correct answers (a gate result stores them as correct)', () => {
    const assistedOnly: GateResult = { gate: 'recog', form: 'decode', asked: 3, correct: 0, assisted: 3, result: 'fail' };
    expect(strandStatuses([assistedOnly])['hangul-recognition']).toBe('not-yet');
  });

  it('reads vocabulary and sentences across both forms of their one gate', () => {
    const readFailOralPass = [gate('vocab', 'read', 'fail', 1), gate('vocab', 'oral', 'pass')];
    expect(strandStatuses(readFailOralPass).vocabulary).toBe('secure');
    const oralOnly = [gate('sentence', 'oral', 'fail', 0)];
    expect(strandStatuses(oralOnly).sentences).toBe('not-yet');
    const unavailable: GateResult = { ...gate('vocab', 'oral', 'not-run', 0, 0), reason: 'unavailable' };
    expect(strandStatuses([unavailable]).vocabulary).toBe('not-tested');
  });
});

describe('levelOf (spec 3.6 table)', () => {
  const P = (g: GateResult['gate'], f: GateResult['form'] = 'decode') => gate(g, f, 'pass');
  const F = (g: GateResult['gate'], f: GateResult['form'] = 'decode') => gate(g, f, 'fail');

  it('is stage1 band 0 with no decoding evidence, or sound-basic / syl-cv not passed', () => {
    expect(levelOf([])).toEqual({ stage: 'stage1', band: 0 });
    expect(levelOf([P('recog')])).toEqual({ stage: 'stage1', band: 0 });
    expect(levelOf([F('sound-basic')])).toEqual({ stage: 'stage1', band: 0 });
    expect(levelOf([P('sound-basic'), F('syl-cv')])).toEqual({ stage: 'stage1', band: 0 });
    expect(levelOf([F('sound-basic'), P('syl-cv')])).toEqual({ stage: 'stage1', band: 0 });
  });

  it('is stage1 band 1, 2, 3 as the decoding ladder is climbed', () => {
    expect(levelOf([P('recog'), P('sound-basic'), P('syl-cv')])).toEqual({ stage: 'stage1', band: 1 });
    expect(levelOf([P('sound-basic'), P('syl-cv'), P('sound-rest')])).toEqual({ stage: 'stage1', band: 2 });
    expect(levelOf([P('sound-basic'), P('syl-cv'), P('sound-rest'), P('syl-cvc')])).toEqual({ stage: 'stage1', band: 3 });
  });

  it('needs consecutive evidence: a later pass without the earlier one does not count', () => {
    expect(levelOf([P('sound-basic'), P('syl-cv'), F('sound-rest'), P('syl-cvc')])).toEqual({ stage: 'stage1', band: 1 });
  });

  it('is stage2 band 0 once vocab is read, stage3 band 0 once sentences are read', () => {
    const ladder = [P('sound-basic'), P('syl-cv'), P('sound-rest'), P('syl-cvc')];
    expect(levelOf([...ladder, F('vocab', 'read')])).toEqual({ stage: 'stage1', band: 3 });
    expect(levelOf([...ladder, P('vocab', 'read')])).toEqual({ stage: 'stage2', band: 0 });
    expect(levelOf([...ladder, P('vocab', 'read'), F('sentence', 'read')])).toEqual({ stage: 'stage2', band: 0 });
    expect(levelOf([...ladder, P('vocab', 'read'), P('sentence', 'read')])).toEqual({ stage: 'stage3', band: 0 });
  });

  it('never lets an oral pass raise the level', () => {
    const ladder = [P('sound-basic'), P('syl-cv'), P('sound-rest'), P('syl-cvc')];
    expect(levelOf([...ladder, P('vocab', 'oral'), P('sentence', 'oral')])).toEqual({ stage: 'stage1', band: 3 });
  });
});

describe('oralStageOf: a Deep reader who passed vocab read hears sentences only', () => {
  it('lets the vocab read pass stand in for the missing vocab oral row', () => {
    const reader = [gate('vocab', 'read', 'pass'), gate('vocab', 'read', 'pass')];
    expect(oralStageOf([...reader, gate('sentence', 'oral', 'pass')])).toBe('stage3');
    expect(oralStageOf([...reader, gate('sentence', 'oral', 'fail')])).toBe('stage2');
    expect(oralStageOf([gate('vocab', 'read', 'fail'), gate('sentence', 'oral', 'pass')])).toBe('stage1');
    expect(oralStageOf([...reader, gate('vocab', 'oral', 'fail'), gate('sentence', 'oral', 'pass')])).toBe('stage1');
  });
});

describe('oralStageOf', () => {
  const P = (g: GateResult['gate'], f: GateResult['form']) => gate(g, f, 'pass');
  it('is null when no oral rung ran', () => {
    expect(oralStageOf([])).toBeNull();
    expect(oralStageOf([P('vocab', 'read'), P('sentence', 'read')])).toBeNull();
    expect(oralStageOf([{ ...gate('vocab', 'oral', 'not-run', 0, 0), reason: 'unavailable' }])).toBeNull();
  });
  it('is stage1 when vocab oral was not passed', () => {
    expect(oralStageOf([gate('vocab', 'oral', 'fail')])).toBe('stage1');
    expect(oralStageOf([gate('vocab', 'oral', 'fail'), P('sentence', 'oral')])).toBe('stage1');
  });
  it('is stage2 when vocab oral passed and stage3 when sentence oral passed too', () => {
    expect(oralStageOf([P('vocab', 'oral'), gate('sentence', 'oral', 'fail')])).toBe('stage2');
    expect(oralStageOf([P('vocab', 'oral')])).toBe('stage2');
    expect(oralStageOf([P('vocab', 'oral'), P('sentence', 'oral')])).toBe('stage3');
  });
});
