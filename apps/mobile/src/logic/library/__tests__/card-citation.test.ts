import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { cardCitationView, hangulRuns } from '../card-citation';

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
      runs: [{ text: 'Source: Cultural Heritage Administration, Hangul Day', korean: false }],
      more: null,
    });
  });

  it('counts the other sources, singular for one', () => {
    expect(cardCitationView({ citation: { title: 'T', publisher: 'P', more: 1 } }, m)?.more).toBe('and 1 more source');
    expect(cardCitationView({ citation: { title: 'T', publisher: 'P', more: 3 } }, m)?.more).toBe('and 3 more sources');
  });

  it('marks only the Korean of a publisher or title (lang="ko"), never its English gloss or the template', () => {
    const view = cardCitationView({ citation: { title: DAY, publisher: MUSEUM, more: 1 } }, m);
    expect(view?.line).toBe(`Source: ${MUSEUM}, ${DAY}`);
    expect(view?.runs).toEqual([
      { text: 'Source: ', korean: false },
      { text: '국립한글박물관', korean: true },
      { text: ' (National Hangeul Museum), ', korean: false },
      { text: DAY, korean: true },
    ]);
  });

  it('never marks text because it repeats the template ("Source" as a publisher)', () => {
    const view = cardCitationView({ citation: { title: DAY, publisher: 'Source', more: 0 } }, m);
    expect(view?.runs).toEqual([
      { text: 'Source: Source, ', korean: false },
      { text: DAY, korean: true },
    ]);
  });
});

describe('hangulRuns', () => {
  it('returns one plain run for text with no Hangul, and none for an empty string', () => {
    expect(hangulRuns('only text')).toEqual([{ text: 'only text', korean: false }]);
    expect(hangulRuns('')).toEqual([]);
  });

  it('keeps a Korean phrase with spaces as one run, and splits at every edge, keeping every character', () => {
    const text = '훈민정음 해례본 (The Proper Sounds), 한글날 and 세종';
    const runs = hangulRuns(text);
    expect(runs).toEqual([
      { text: '훈민정음 해례본', korean: true },
      { text: ' (The Proper Sounds), ', korean: false },
      { text: '한글날', korean: true },
      { text: ' and ', korean: false },
      { text: '세종', korean: true },
    ]);
    expect(runs.map((r) => r.text).join('')).toBe(text);
  });

  it('a translated template in Korean is marked too', () => {
    expect(hangulRuns('출처: UNESCO, 한글날')).toEqual([
      { text: '출처', korean: true },
      { text: ': UNESCO, ', korean: false },
      { text: '한글날', korean: true },
    ]);
  });
});
