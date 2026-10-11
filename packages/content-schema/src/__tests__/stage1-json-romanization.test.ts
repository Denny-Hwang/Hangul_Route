import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkProse, checkRomanization } from '../index';

// F-CNT-002 PR 2b: content/episodes/stage-1 holds unhyphenated Revised Romanization.
// (The registered scan of all content/**/*.json is PR 3, romanization-content.test.ts.)
interface Card { id: string; ko: string; romanization: string; blurb: string; fact?: string }
interface JamoRow { id: string; ko: string; exampleWord?: { ko: string; romanization: string; en: string } }

const load = <T>(name: string): T[] =>
  JSON.parse(readFileSync(new URL(`../../../../content/episodes/stage-1/${name}`, import.meta.url), 'utf8')) as T[];
const cards = load<Card>('cards.json');
const jamo = load<JamoRow>('jamo.json');

describe('stage-1 cards.json romanization', () => {
  it('every card passes the Revised Romanization checks', () => {
    const found = cards.flatMap((c) => checkRomanization(c.ko, c.romanization).map((f) => `${c.id}: ${f.message}`));
    expect(found).toEqual([]);
  });

  it('K-pop and yutnori show how they are said', () => {
    expect(cards.find((c) => c.id === 'card:kpop')).toMatchObject({ title: 'K-pop', romanization: 'keipap' });
    expect(cards.find((c) => c.id === 'card:yutnori')?.romanization).toBe('yunnori');
  });

  it('prose has no syllable-hyphenated registered word', () => {
    const registry = cards.map((c) => c.ko);
    const found = cards.flatMap((c) => checkProse(`${c.blurb} ${c.fact ?? ''}`, registry).map((f) => `${c.id}: ${f.message}`));
    expect(found).toEqual([]);
    expect(cards.find((c) => c.id === 'card:gangaji')?.fact).toContain('gangaji');
  });
});

describe('stage-1 jamo.json example words', () => {
  it('every example word passes the Revised Romanization checks', () => {
    const found = jamo.flatMap((j) =>
      j.exampleWord === undefined
        ? []
        : checkRomanization(j.exampleWord.ko, j.exampleWord.romanization).map((f) => `${j.id}: ${f.message}`),
    );
    expect(found).toEqual([]);
  });

  it('ㅠ teaches 유리 (yuri, glass) and ㅋ shows keipap', () => {
    expect(jamo.find((j) => j.id === 'jamo:yu')?.exampleWord).toEqual({ ko: '유리', romanization: 'yuri', en: 'glass' });
    expect(jamo.find((j) => j.id === 'jamo:kieuk')?.exampleWord?.romanization).toBe('keipap');
  });
});
