import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The sentence-build slide's words (AMENDMENTS-LECTURE-V2 row LV-S3, sections 10 and 12.3; design/screens/presenter/
 * slide-sentence-build.md): its kind label, the two questions over the sentence line, its name in the slide grid and the
 * live region (the same value as the learner's Sentence Builder), and the announcement of a placed tile, in the three
 * UI languages (F-I18N-001 §3.10: Spanish neutral, informal tú; Korean 해요체, no particle attached to a variable).
 */
const VALUES = {
  en: { title: 'Build the sentence together', next: 'Which word comes next?', particle: 'Which ending fits?', kind: 'Build a sentence', placed: '사과 placed' },
  es: { title: 'Armar la oración en grupo', next: '¿Qué palabra va después?', particle: '¿Qué terminación va?', kind: 'Arma una oración', placed: 'Se colocó: 사과' },
  ko: { title: '함께 문장을 만들어요', next: '다음 낱말은 뭘까요?', particle: '어떤 말이 어울릴까요?', kind: '문장 만들기', placed: '놓은 낱말: 사과' },
} as const;

describe('learner.presenter sentence build (LV-S3)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the kind label, the questions, the grid kind and the placed-tile announcement', (locale) => {
    const m = getMessages(locale);
    const want = VALUES[locale];
    const build = m.learner.presenter.slide.build;
    expect([build.title, build.next, build.particle]).toEqual([want.title, want.next, want.particle]);
    expect(m.learner.presenter.grid.kind.build).toBe(want.kind);
    // The grid kind is the name the learner sees for the Sentence Builder game (My Route, the games that count for a skill).
    expect(m.learner.presenter.grid.kind.build).toBe(m.learner.myRoute.games.sentenceBuilder);
    expect(m.a11y.presenter.tilePlaced('사과')).toBe(want.placed);
  });

  it('no line asks the room to speak (LV-D9): the room points at the next tile', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const build = getMessages(locale).learner.presenter.slide.build;
      for (const line of [build.title, build.next, build.particle]) expect(line).not.toMatch(/\b(say|speak|repeat|dilo|di |habla|repite)\b|말해|따라 해/i);
    }
  });
});
