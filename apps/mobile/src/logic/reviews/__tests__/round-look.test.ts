import { describe, expect, it } from 'vitest';
import type { HoldSurface } from '../../locale/check-hold';
import type { Rung } from '../../memory/spacing';
import type { ReviewRound } from '../review-rounds';
import { keyboardSoundHeld, roundHolds, roundLook } from '../round-look';

/**
 * What a review round draws of the romanization (AMENDMENTS-STAGE1-DECODING-CHECK sections 3.1 and 3.3, row DC-1b): the
 * look is pure, so the screen and the romanization-only bot read the same thing.
 */

const question = (rung: Rung) => ({ itemId: 'lex:namu', kind: 'lex', rung, format: 'read-pick', theme: 'life', stretch: false, voiceFallback: false }) as never;
const ko = { ko: '나무', romanization: 'namu' };
const options = [
  { id: 'a', ko },
  { id: 'b', ko: { ko: '나비', romanization: 'nabi' } },
];

const pick = (ask: 'spelling' | 'meaning' | 'sound' | 'reply', rung: Rung = 'read', heard = ask === 'spelling'): ReviewRound =>
  ({ type: 'pick', question: question(rung), answer: { ko }, heard, ask, prompt: ko, options, answerId: 'a' }) as unknown as ReviewRound;
const type = (rung: Rung = 'produce'): ReviewRound => ({ type: 'type', question: question(rung), answer: { ko }, mode: 'see', target: '나무' }) as unknown as ReviewRound;
const cloze = (): ReviewRound => ({ type: 'cloze', question: question('produce'), answer: { ko }, gapped: ko, meaning: 'tree', tiles: options, answerId: 'a' }) as unknown as ReviewRound;
const order = (): ReviewRound => ({ type: 'order', question: question('produce'), answer: { ko }, line: ko, tiles: [], words: [] }) as unknown as ReviewRound;
const build = (): ReviewRound => ({ type: 'build', question: question('produce'), answer: { ko }, target: ko }) as unknown as ReviewRound;
const shape = (): ReviewRound => ({ type: 'shape', question: question('produce'), answer: { ko }, target: 'jamo:bieup', lookAlike: 'jamo:pieup' }) as unknown as ReviewRound;

const CHECKS: readonly HoldSurface[] = ['stage-check', 'cell-check'];

describe('roundHolds: the surface and the round\'s own rung decide', () => {
  it.each(CHECKS)('%s holds every rung', (surface) => {
    for (const rung of ['recognize', 'read', 'produce'] as const) expect(roundHolds(surface, pick('spelling', rung))).toBe(true);
  });

  it('the Daily Review holds the read and produce rungs, never the recognize rung', () => {
    expect(roundHolds('daily-review', pick('spelling', 'recognize'))).toBe(false);
    expect(roundHolds('daily-review', pick('meaning', 'read'))).toBe(true);
    expect(roundHolds('daily-review', type('produce'))).toBe(true);
  });

  it('practice never holds', () => {
    for (const rung of ['recognize', 'read', 'produce'] as const) expect(roundHolds('practice', pick('meaning', rung))).toBe(false);
  });
});

describe('keyboardSoundHeld: the keyboard\'s Latin line (OD-DC12)', () => {
  it.each(CHECKS)('%s holds it', (surface) => expect(keyboardSoundHeld(surface, type())).toBe(true));
  it('the Daily Review\'s produce rung keeps the Latin key labels', () => expect(keyboardSoundHeld('daily-review', type('produce'))).toBe(false));
  it('practice keeps them', () => expect(keyboardSoundHeld('practice', type())).toBe(false));
});

describe('roundLook: pick rounds', () => {
  it('a Check holds a heard round\'s options while it is open and shows them once solved; the asked text is the romanization only', () => {
    const open = roundLook(pick('spelling', 'recognize'), { surface: 'stage-check', solved: false });
    expect(open).toEqual({ held: true, promptRomanization: false, optionRomanization: false, askedRomanizationOnly: true });
    const done = roundLook(pick('spelling', 'recognize'), { surface: 'stage-check', solved: true });
    expect(done).toEqual({ held: false, promptRomanization: true, optionRomanization: true, askedRomanizationOnly: false });
  });

  it('a meaning round holds the prompt; a reply round holds the line and the reply options', () => {
    expect(roundLook(pick('meaning', 'read'), { surface: 'cell-check', solved: false })).toMatchObject({ held: true, promptRomanization: false });
    expect(roundLook(pick('reply', 'read'), { surface: 'cell-check', solved: false })).toMatchObject({ held: true, promptRomanization: false, optionRomanization: false });
  });

  it('a sound round is unchanged: its romanization is the stimulus and its options never draw one', () => {
    for (const solved of [false, true]) {
      expect(roundLook(pick('sound', 'read'), { surface: 'stage-check', solved })).toEqual({ held: false, promptRomanization: true, optionRomanization: false, askedRomanizationOnly: false });
    }
  });

  it('the Daily Review: a read round is held, a recognize round shows as practice', () => {
    expect(roundLook(pick('meaning', 'read'), { surface: 'daily-review', solved: false }).held).toBe(true);
    expect(roundLook(pick('spelling', 'recognize'), { surface: 'daily-review', solved: false })).toEqual({ held: false, promptRomanization: true, optionRomanization: true, askedRomanizationOnly: false });
  });

  it('a surface that names nothing (practice) is never held', () => {
    expect(roundLook(pick('meaning'), { surface: 'practice', solved: false }).held).toBe(false);
  });
});

describe('roundLook: type, cloze, order, build and shape', () => {
  it.each([
    ['type', type()],
    ['cloze', cloze()],
    ['order', order()],
  ] as const)('%s: held while open in a Check, shown once solved', (_name, round) => {
    expect(roundLook(round, { surface: 'stage-check', solved: false })).toMatchObject({ held: true, promptRomanization: false, optionRomanization: false, askedRomanizationOnly: false });
    expect(roundLook(round, { surface: 'stage-check', solved: true })).toMatchObject({ held: false, promptRomanization: true, optionRomanization: true });
  });

  it('the Daily Review holds its produce rounds, not its recognize rung', () => {
    expect(roundLook(type('produce'), { surface: 'daily-review', solved: false }).held).toBe(true);
  });

  it('Syllable Build and Match Shape keep their own boards (their chunks hold what they hold)', () => {
    expect(roundLook(build(), { surface: 'stage-check', solved: false }).held).toBe(false);
    expect(roundLook(shape(), { surface: 'stage-check', solved: false }).held).toBe(false);
  });
});
