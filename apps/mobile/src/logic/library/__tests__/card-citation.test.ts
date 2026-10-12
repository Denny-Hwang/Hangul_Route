import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { cardCitationView, citationRuns } from '../card-citation';

/**
 * F-STORY-006 §3.8 back face, wireframe library/card-back-citation G: under a
 * story card's fact, one source line "Source: <publisher>, <title>" and, when
 * the fact has more sources, "and N more sources". No URL, no link.
 */
const m = getMessages('en').learner.cardDetail.citation;
const MUSEUM = '국립한글박물관 (National Hangeul Museum)';
const DAY = '한글날';

describe('cardCitationView', () => {
  it('is null for a card with no citation (the older cards and set cards keep their back face)', () => {
    expect(cardCitationView({}, m)).toBeNull();
  });

  it('prints the first source, and no "more" line when the fact has no other source', () => {
    const view = cardCitationView({ citation: { title: 'Hangul Day', publisher: 'Cultural Heritage Administration', more: 0 } }, m);
    expect(view).toEqual({
      line: 'Source: Cultural Heritage Administration, Hangul Day',
      runs: [
        { text: 'Source: ', korean: false },
        { text: 'Cultural Heritage Administration', korean: false },
        { text: ', ', korean: false },
        { text: 'Hangul Day', korean: false },
      ],
      more: null,
    });
  });

  it('counts the other sources, singular for one', () => {
    expect(cardCitationView({ citation: { title: 'T', publisher: 'P', more: 1 } }, m)?.more).toBe('and 1 more source');
    expect(cardCitationView({ citation: { title: 'T', publisher: 'P', more: 3 } }, m)?.more).toBe('and 3 more sources');
  });

  it('marks a publisher or title in Korean so it is read in Korean (lang="ko"), and nothing else', () => {
    const view = cardCitationView({ citation: { title: DAY, publisher: MUSEUM, more: 1 } }, m);
    expect(view?.line).toBe(`Source: ${MUSEUM}, ${DAY}`);
    expect(view?.runs).toEqual([
      { text: 'Source: ', korean: false },
      { text: MUSEUM, korean: true },
      { text: ', ', korean: false },
      { text: DAY, korean: true },
    ]);
  });
});

describe('citationRuns', () => {
  const isKo = (s: string): boolean => s.startsWith('K');

  it('splits a line around its parts, in order, keeping every character', () => {
    const runs = citationRuns('A Kx b Ky c', ['Kx', 'Ky'], isKo);
    expect(runs).toEqual([
      { text: 'A ', korean: false },
      { text: 'Kx', korean: true },
      { text: ' b ', korean: false },
      { text: 'Ky', korean: true },
      { text: ' c', korean: false },
    ]);
    expect(runs.map((r) => r.text).join('')).toBe('A Kx b Ky c');
  });

  it('skips a part it cannot find or an empty part, and finds a part a translation moved first', () => {
    expect(citationRuns('only text', ['Kq', ''], isKo)).toEqual([{ text: 'only text', korean: false }]);
    expect(citationRuns('Ky then Kx', ['Kx', 'Ky'], isKo)).toEqual([
      { text: 'Ky', korean: true },
      { text: ' then ', korean: false },
      { text: 'Kx', korean: true },
    ]);
  });

  it('never marks the same characters twice when two parts are equal', () => {
    expect(citationRuns('Kx, Kx', ['Kx', 'Kx'], isKo)).toEqual([
      { text: 'Kx', korean: true },
      { text: ', ', korean: false },
      { text: 'Kx', korean: true },
    ]);
  });
});
