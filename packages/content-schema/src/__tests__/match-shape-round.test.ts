import { describe, expect, it } from 'vitest';
import { MatchShapeRoundSchema } from '../schemas/match-shape';
import { RoundSchema } from '../schemas/minigame';

/**
 * F-CURR-002 section 7.1 F4, row CM-33 (design/wireframes/minigame/match-shape.md, Data needs): the `match-shape` round,
 * two types in one kind. An origin round shows a drawn picture and one sourced line, and asks for the letter among 3;
 * a pair round asks for every copy of a letter among 6 tiles that mix it with one look-alike.
 */

const ORIGIN = {
  id: 'ms:origin:nieun',
  shape: 'origin',
  target: 'jamo:nieun',
  options: ['jamo:giyeok', 'jamo:nieun', 'jamo:mieum'],
  picture: 'prop:shape-origin-nieun',
  noteEn: 'The tongue touches the upper gum.',
  fact: 'nieun',
} as const;

const PAIR = {
  id: 'ms:pair:bieup',
  shape: 'pair',
  target: 'jamo:bieup',
  lookAlike: 'jamo:pieup',
  layout: 'tlltlt',
  diffNoteEn: 'bieup stands up, with two tall sides. pieup lies flat, with long lines at the top and bottom.',
} as const;

const issues = (round: unknown): string[] => {
  const r = MatchShapeRoundSchema.safeParse(round);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('MatchShapeRoundSchema (row CM-33)', () => {
  it('parses an origin round and a pair round; a lesson round never is one (Stage 1 TypeScript rows only, section 4.2)', () => {
    expect(issues(ORIGIN)).toEqual([]);
    expect(issues(PAIR)).toEqual([]);
    expect(RoundSchema.safeParse({ kind: 'match-shape', data: ORIGIN }).success).toBe(false);
  });

  it('an origin round asks its target among 3 different letters, a picture of the shape-origin family', () => {
    expect(issues({ ...ORIGIN, options: ['jamo:giyeok', 'jamo:siot', 'jamo:mieum'] })).toEqual(['the target is one of the options']);
    expect(issues({ ...ORIGIN, options: ['jamo:nieun', 'jamo:nieun', 'jamo:mieum'] })).toEqual(['the options are three different letters']);
    expect(issues({ ...ORIGIN, options: ['jamo:nieun', 'jamo:mieum'] }).length).toBeGreaterThan(0);
    expect(issues({ ...ORIGIN, picture: 'prop:realia-awning' }).length).toBeGreaterThan(0);
    expect(issues({ ...ORIGIN, noteEn: ' ' }).length).toBeGreaterThan(0);
  });

  it('asks letters, never a final: a shape is the letter, not its place in a block', () => {
    expect(issues({ ...ORIGIN, target: 'jamo:nieun-batchim' }).length).toBeGreaterThan(0);
    expect(issues({ ...PAIR, lookAlike: 'jamo:bieup-batchim' }).length).toBeGreaterThan(0);
  });

  it('a pair round mixes the target with a different look-alike, 2 or 3 copies among 6 tiles', () => {
    expect(issues({ ...PAIR, lookAlike: 'jamo:bieup' })).toEqual(['the look-alike is another letter']);
    expect(issues({ ...PAIR, layout: 'tlllll' })).toEqual(['2 or 3 of the 6 tiles are the target']);
    expect(issues({ ...PAIR, layout: 'ttttll' })).toEqual(['2 or 3 of the 6 tiles are the target']);
    expect(issues({ ...PAIR, layout: 'tlt' }).length).toBeGreaterThan(0);
    expect(issues({ ...PAIR, layout: 'ttlxll' }).length).toBeGreaterThan(0);
  });

  it('an unknown shape is rejected', () => {
    expect(issues({ ...PAIR, shape: 'stroke' }).length).toBeGreaterThan(0);
  });
});
