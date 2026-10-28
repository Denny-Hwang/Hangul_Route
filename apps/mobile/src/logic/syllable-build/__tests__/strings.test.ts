import { lintReviewMessages, localeCopyProblems } from '@hangul-route/content-schema/lint';
import { bannedWordsFor, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-002 sections 7.7 and 9.3, row CM-32: the Syllable Build and Block Sprint strings in en, es and ko pass the
 * `review-copy` rule (no percentage, no "n of m", no age wording, no speaking UI, no emoji) and the anti-shame list
 * (no red-X words, no failure or score framing, no comparison with anyone).
 */
const SAMPLE = 'x';

function texts(locale: 'en' | 'es' | 'ko'): string[] {
  const m = getMessages(locale);
  const b = m.learner.minigame.syllableBuild;
  const s = m.learner.decodingSprint;
  const a = m.a11y.minigame.syllableBuild;
  return [
    b.heading,
    b.row.first,
    b.row.vowel,
    b.row.final,
    b.noFinal,
    b.showSound,
    b.miss.first,
    b.miss.vowel,
    b.miss.final,
    b.miss.finalOrNone,
    b.lookHere,
    b.built,
    s.title,
    s.offer,
    s.intro,
    s.introPick,
    s.introProbe,
    s.probe,
    s.read(1),
    s.read(14),
    s.best(16),
    s.done,
    a.tile(SAMPLE, 'bieup'),
    a.finalTile(SAMPLE, 'bieup'),
    a.noFinal,
    a.zone('First letter'),
    a.zone('Final', 'No final letter'),
    a.marked('Vowel, x, letter eo'),
    a.block(SAMPLE, 'bap'),
    a.meaning('rice'),
  ];
}

describe('the Syllable Build and Block Sprint strings (section 7.7, section 9.3 review-copy)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the sprint strings pass review-copy', (locale) => {
    expect(lintReviewMessages(getMessages(locale).learner, ['decodingSprint'], locale)).toEqual([]);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: every string is there, new learner copy is clean, and nothing shames, scores or compares', (locale) => {
    for (const text of texts(locale)) {
      expect(text.trim().length, text).toBeGreaterThan(0);
      expect(localeCopyProblems(text, locale), text).toEqual([]);
      expect(text, text).not.toMatch(/%|\bwrong\b|\bfail|\bscore|\bmistake|\bincorrect|\bothers?\b|\branking|\bfriends? scored|incorrect|equivocad|fallaste|error|틀렸|실패|점수|오답|다른 사람/i);
      for (const word of bannedWordsFor(locale, 'learner')) expect(text.toLowerCase(), `${text} has ${word}`).not.toContain(word.toLowerCase());
    }
  });

  it('en: a miss says where to listen, never that it was wrong; the best is the learner own', () => {
    const b = getMessages('en').learner.minigame.syllableBuild;
    expect(Object.values(b.miss).every((line) => line.startsWith('Listen'))).toBe(true);
    expect(getMessages('en').learner.decodingSprint.best(12)).toBe('Your best: 12');
    expect(getMessages('en').learner.decodingSprint.read(1)).toBe('1 block read');
  });
});
