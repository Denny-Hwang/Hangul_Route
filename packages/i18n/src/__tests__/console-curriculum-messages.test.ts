import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-PLAN-002 section 3.8 / 3.11: the curriculum planner's console words. The generator emits
// codes and ids; these messages word them. English values are pinned here; every locale must
// pass both banned-word lists (learner and caregiver) and the F-PAR-001 phrases, because the
// warnings and week labels describe a learner's plan.
const c = getMessages('en').console.curriculum;

/** F-PAR-001 section 3.6 phrases plus the section 3.11 words (whole words, any case). */
const PHRASES = ['behind', 'falling behind', 'should have', 'missed too many', 'compared to', 'late', 'overdue', 'missed', 'failed', 'incomplete', 'lazy', 'kids', 'ages'];

function outputsOf(tree: unknown, prefix: string): string[] {
  const out: string[] = [];
  for (const path of leafPaths(tree as Record<string, unknown>)) {
    const value = lookup(tree as Record<string, unknown>, path);
    if (typeof value === 'function') {
      const samples = SAMPLES[`${prefix}.${path}`];
      expect(samples, `${prefix}.${path} needs a row in SAMPLES`).toBeDefined();
      for (const args of samples ?? []) out.push((value as (...a: unknown[]) => string)(...args));
    } else out.push(String(value));
  }
  return out;
}

describe('console.curriculum (English)', () => {
  it('words the six starting points without stage numbers or jargon', () => {
    expect(Object.keys(c.start.points)).toEqual(['brand-new', 'some-letters', 'all-letters', 'reads-words', 'first-words', 'first-sentences']);
    expect(c.start.points['brand-new'].title).toBe('Brand new');
    expect(c.start.points['first-sentences'].title).toBe('Reads first sentences');
    for (const point of Object.values(c.start.points)) expect(`${point.title} ${point.line}`).not.toMatch(/stage|band|\d/i);
    expect(c.start.hint.class('Knows some letters')).toBe('Most of your students start here: Knows some letters');
    expect(c.start.hint.family('Brand new')).toBe('Most of your learners start here: Brand new');
  });

  it('words the rhythm step with plural counts', () => {
    expect(c.rhythm.sessionsNote(22, 12)).toBe('That is 22 sessions in 12 weeks.');
    expect(c.rhythm.sessionsNote(1, 1)).toBe('That is 1 session in 1 week.');
    expect(c.rhythm.daysChosen(1)).toBe('1 day a week');
    expect(c.rhythm.daysChosen(2)).toBe('2 days a week');
    expect(c.rhythm.tooMany).toBe('That is more than a plan can hold. Choose fewer weeks or sessions.');
    expect(c.rhythm.lengths['6-month'].cta).toBe('6 months');
  });

  it('words the preview: stats, labels and every warning code', () => {
    expect(c.preview.stats(18, 80, 2)).toBe('18 lessons and stories · about 80 minutes · ends in Stage 2');
    expect(c.preview.stats(1, 5, 1)).toBe('1 lesson or story · about 5 minutes · ends in Stage 1');
    expect(c.preview.label.culture("Kim Hongdo's Pictures of Everyday Life")).toBe("Culture week: Kim Hongdo's Pictures of Everyday Life");
    expect(c.preview.label.review).toBe('Review and collect');
    expect(c.preview.warnings.contentRunsOut(15)).toBe('No new episodes yet from week 15. Free practice and word topics fill those weeks.');
    expect(c.preview.warnings.comingSoon(5)).toBe('5 episodes are not released yet. They are in the plan and start on their dates once they are.');
    expect(c.preview.warnings.premium(3)).toBe('3 lessons need Premium and are not in the plan.');
    expect(c.preview.warnings.didNotFit(2)).toBe('2 lessons and stories did not fit. Add a week or a session to include them.');
    expect(c.preview.warnings.didNotFit(1)).toBe('1 lesson or story did not fit. Add a week or a session to include it.');
    expect(c.readout.refreshAsk('Oct 26')).toBe('Refresh the route? What is done stays done. The rest is laid out again on the current catalogue, from Oct 26.');
    expect(c.readout.refreshLine).not.toMatch(/new lessons/i);
    expect(c.preview.extras.vocab('Food')).toBe('Words: Food (optional)');
    expect(c.preview.defaultTitle(12)).toBe('Route · 12 weeks');
  });

  it('words the readout as "so far" and "planned", never a ranking or a percentage', () => {
    expect(c.readout.line(4, 6, 36)).toBe('4 / 6 so far · 36 planned');
    expect(c.readout.lineNotReady(4, 6, 36, 1)).toBe('4 / 6 so far · 36 planned · 1 not ready yet');
    expect(c.readout.addWeeks.cta(1)).toBe('Add 1 week and re-pace');
    expect(c.readout.addWeeks.cta(12)).toBe('Add 12 weeks and re-pace');
    expect(c.entries.ownRoute(7, 9, 12)).toBe('Own route: 7 / 9 so far · 12 weeks');
    expect(c.catalog.comingSoon('Word Builder')).toBe('Word Builder (coming soon)');
    expect(outputsOf(c, 'console.curriculum').join(' ')).not.toMatch(/%/);
  });
});

describe('console.curriculum stays calm in every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no learner- or caregiver-banned word and no F-PAR-001 phrase`, () => {
      const outputs = outputsOf(getMessages(locale).console.curriculum, 'console.curriculum');
      expect(outputs.length).toBeGreaterThan(100);
      for (const out of outputs) {
        expect(findBannedWord(out, locale, 'learner'), out).toBeNull();
        expect(findBannedWord(out, locale, 'caregiver'), out).toBeNull();
        for (const phrase of PHRASES) expect(out.toLowerCase(), out).not.toMatch(new RegExp(`\\b${phrase}\\b`));
      }
    });
  }
});

// AMENDMENTS-ROUTE-CLASS-BLEND section 19 (row BL-4): the meeting block, the preview header and the readout lines.
// American spelling (the BL-D README, finding 6); "lecture" is never a UI word; Korean 수업 / 연습, Spanish clase / práctica.
describe('console.curriculum.blend (BL-4)', () => {
  const b = c.blend;

  it('pins the English meeting block, header and readout words', () => {
    expect(b.meeting.title).toBe('How does this class meet?');
    expect(b.practice.row).toBe('Learners also practice on their own');
    expect(b.practice.inline('3', '10')).toBe('3 times a week × 10 min each time');
    expect(b.practice.suggested('Wed, Fri, Sun')).toBe('Practice on Wed, Fri, Sun');
    expect(b.mode.overlap).toBe('Practice what class taught');
    expect(b.mode.split).toBe('Class and practice cover different lessons');
    expect(b.preview.header(4, 1, 30, 3, 10, null)).toBe('About 4 sessions a week: 1 class day (30 min) and 3 practice days (10 min each, plus about 2-3 minutes of Daily Review).');
    expect(b.preview.header(8, 1, 30, 7, 10, b.preview.everyDay)).toMatch(/^About 8 sessions a week on all 7 days: /);
    expect(b.preview.perDay(3, 1)).toBe('Class days teach about 3 lessons; practice days play about 1.');
    expect(b.preview.average(95, '4', '3.7')).toBe('95 sessions in all, 4 a teaching week (3.7 over the whole calendar).');
    expect(b.preview.average(104, '4', null)).toBe('104 sessions in all, 4 a teaching week.');
    expect(b.readout.classDays(2, 23)).toBe('Class days so far: 2 of 23');
    expect(b.warn.itemCap(24)).toBe('This plan is full at week 24. Choose fewer weeks, or practice what class taught.');
    expect(b.readout.addPractice.cta).toBe('Add practice days to this plan');
  });

  it('es and ko word the class and practice with the glossary, and es takes plural weekday names for a habit', () => {
    const es = getMessages('es').console.curriculum.blend;
    const ko = getMessages('ko').console.curriculum.blend;
    expect(es.practice.inline('3', '10')).toBe('3 veces por semana × 10 min cada vez');
    expect(ko.practice.inline('3', '10')).toBe('주 3회 × 한 번에 10분');
    expect(es.practice.afterClass('sábado')).toBe('también tras la clase de los sábados');
    expect(es.practice.afterClass('martes')).toBe('también tras la clase de los martes');
    expect(ko.readout.classDays(2, 23)).toBe('지금까지 수업: 23번 중 2번');
    expect(es.warn.itemCap(24)).toBe('Este plan se llena en la semana 24. Elige menos semanas, o elige «Practicar lo que enseñó la clase».');
    expect(es.readout.addPractice.cta).toBe('Añadir días de práctica a este plan');
    expect(ko.readout.addPractice.cta).toBe('이 계획에 연습하는 날 더하기');
    expect(es.preview.header(8, 1, 30, 7, 10, es.preview.everyDay)).toMatch(/^Unas 8 sesiones por semana, los 7 días: /);
    expect(ko.preview.header(8, 1, 30, 7, 10, ko.preview.everyDay)).toMatch(/^한 주에 약 8번\(7일 모두\): /);
    for (const locale of LOCALES) {
      const words = outputsOf(getMessages(locale).console.curriculum.blend, 'console.curriculum.blend').join(' ');
      expect(words, locale).not.toMatch(/lecture|강의|conferencia/i);
    }
  });
});
