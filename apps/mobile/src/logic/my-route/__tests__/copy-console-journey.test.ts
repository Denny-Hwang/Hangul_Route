import { describe, expect, it } from 'vitest';
import { LOCALES, getMessages } from '@hangul-route/i18n';
import { copyViolations } from './copy-rules';

/**
 * F-ROUTE-001 section 5 (`copy.test.ts` split by PR): R-9a runs the section 3.13 copy rules on
 * the real `console.journey` dictionary in every UI locale. The console strip is grown-up copy
 * (it may name the level check), so the caregiver surface applies: the my-route banned fixture
 * minus `level`, the shared caregiver list, no speaking words, no emoji-capable symbol, no
 * percent, no ratio, and digits only where a count or a stage number put them.
 */

type Rendered = { path: string; text: string; numbers: number[] };

function renderJourney(locale: (typeof LOCALES)[number]): Rendered[] {
  const j = getMessages(locale).console.journey;
  const line = (known: number, done: number): Rendered => ({ path: 'stageLine', text: j.stageLine(known, done), numbers: [known, done] });
  const lines = [line(0, 0), line(0, 1), line(0, 4), line(8, 0), line(4, 2)];
  return [
    { path: 'title', text: j.title, numbers: [] },
    { path: 'details', text: j.details, numbers: [] },
    { path: 'onStage', text: j.onStage(1), numbers: [1] },
    { path: 'onStage', text: j.onStage(7), numbers: [7] },
    ...lines,
    ...Object.entries(j.state).map(([key, word]) => ({ path: `state.${key}`, text: word, numbers: [] })),
    ...lines.map((l) => ({ path: 'stage', text: j.stage(2, l.text), numbers: [2, ...l.numbers] })),
    ...Object.values(j.state).map((word) => ({ path: 'stage', text: j.stage(3, word), numbers: [3] })),
    { path: 'stages', text: j.stages(5, 7, j.state.later), numbers: [5, 7] },
  ];
}

describe('console.journey keeps the copy rules in every locale (R-9a)', () => {
  for (const locale of LOCALES) {
    for (const { path, text, numbers } of renderJourney(locale)) {
      it(`${locale}: console.journey.${path} -> "${text}"`, () => {
        expect(copyViolations(text, locale, 'caregiver', numbers)).toEqual([]);
      });
    }
  }

  it('never shows a stage total: the line takes only known and done', () => {
    expect(getMessages('en').console.journey.stageLine.length).toBe(2);
  });
});
