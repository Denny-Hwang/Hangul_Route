import { lintReviewMessages } from '@hangul-route/content-schema/lint';
import { bannedWordsFor, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-002 §7.7 (the anti-shame checklist) and §9.3 review-copy over My Story's strings (row CM-38), in every UI
 * locale: no score, no exam framing, no failure word, no age wording, no speaking UI, no emoji, no keepsake promise.
 */
describe.each(['en', 'es', 'ko'] as const)('%s: the My Story strings', (locale) => {
  const m = getMessages(locale);
  const s = m.learner.minigame.myStory;
  const texts = [s.heading, s.soFar, s.soFarFolded(1), s.soFarFolded(3), s.done, s.donePartial, m.a11y.minigame.myStory.soFar(2), m.learner.myRoute.games.myStory];

  it('every string is there and passes review-copy', () => {
    expect(lintReviewMessages(m.learner.minigame, ['myStory'], locale)).toEqual([]);
    expect(texts).toHaveLength(8);
    for (const text of texts) expect(text.trim().length, text).toBeGreaterThan(0);
  });

  it('passes the §7.7 checklist and the banned words', () => {
    for (const text of texts) {
      expect(text, text).not.toMatch(/%|\bexam|\bquiz|\bscore|\btest|\bfail|\bwrong|\bkids?\b|\bages?\b|\bsay\b|\bspeak|\bsave|\bkeep|examen|puntaje|niños|edad|guardar|시험|점수|실패|틀린|어린이|나이|말해|저장/i);
      expect(text, text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      for (const word of bannedWordsFor(locale, 'learner')) expect(text.toLowerCase(), `${text} has ${word}`).not.toContain(word.toLowerCase());
    }
  });

  it('the folded line and its accessible name count the lines', () => {
    expect(s.soFarFolded(3)).toContain('3');
    expect(m.a11y.minigame.myStory.soFar(2)).toContain('2');
    if (locale !== 'ko') expect(s.soFarFolded(1)).not.toBe(s.soFarFolded(2).replace('2', '1'));
  });
});
