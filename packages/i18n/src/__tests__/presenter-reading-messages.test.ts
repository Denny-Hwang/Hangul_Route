import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The reading slides' words (AMENDMENTS-LECTURE-V2 row LV-S1, section 12.3; design/screens/presenter/lecture-v2.md
 * "Strings"): the kind labels of the live region and the slide grid, the label at the top left of a reading slide,
 * and the gap box's accessible name, in the three UI languages (F-I18N-001 §3.10: Spanish informal tú with
 * Latin-American words, Korean 해요체; the realia page's question slide is `grid.kind.quiz`, LV-S2). The slide
 * label is the same word as its grid kind in every locale.
 */
const VALUES = {
  en: { sentence: 'Sentence', pattern: 'Sentence pattern', readAlong: 'Read along', realia: 'Look and read', slot: 'gap' },
  es: { sentence: 'Oración', pattern: 'Patrón de oración', readAlong: 'Leer juntos', realia: 'Mira y lee', slot: 'espacio' },
  ko: { sentence: '문장', pattern: '문장 틀', readAlong: '함께 읽기', realia: '보고 읽기', slot: '빈칸' },
} as const;

describe('learner.presenter reading slides (LV-S1)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: grid kinds, slide labels and the gap name', (locale) => {
    const m = getMessages(locale);
    const want = VALUES[locale];
    const kind = m.learner.presenter.grid.kind;
    expect([kind.sentence, kind.pattern, kind.readAlong, kind.realia]).toEqual([want.sentence, want.pattern, want.readAlong, want.realia]);
    const slide = m.learner.presenter.slide;
    expect([slide.sentence.label, slide.pattern.label, slide.readAlong.label]).toEqual([kind.sentence, kind.pattern, kind.readAlong]);
    expect(m.a11y.presenter.slot).toBe(want.slot);
  });
});
