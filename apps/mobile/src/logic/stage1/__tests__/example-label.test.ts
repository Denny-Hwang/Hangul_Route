import { getMessages, UI_LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { exampleWordLabel } from '../example-label';

/** The Discover example button's accessible name leads with "Example word" (AMENDMENTS-AUDIO-CLIPS JV-A5, M5, AU-OD-10). */
describe('exampleWordLabel', () => {
  const example = { ko: '나', romanization: 'na', gloss: 'I, me' };

  it('English: "Example word", then Hear it with the word, its romanization once shown, and its gloss', () => {
    const m = getMessages('en');
    expect(exampleWordLabel(m.learner.quest.discover, m.a11y, example, true)).toBe('Example word. Hear it: 나, na, I, me');
    expect(exampleWordLabel(m.learner.quest.discover, m.a11y, example, false)).toBe('Example word. Hear it: 나, I, me');
  });

  it('Spanish and Korean lead with their own label', () => {
    const es = getMessages('es');
    const ko = getMessages('ko');
    expect(exampleWordLabel(es.learner.quest.discover, es.a11y, example, false)).toBe('Palabra de ejemplo. Escuchar: 나, I, me');
    expect(exampleWordLabel(ko.learner.quest.discover, ko.a11y, example, false)).toBe('예시 낱말. 들어 보기: 나, I, me');
  });

  it('every UI locale has the label', () => {
    for (const locale of UI_LOCALES) expect(getMessages(locale).learner.quest.discover.exampleWord.length).toBeGreaterThan(0);
  });
});
