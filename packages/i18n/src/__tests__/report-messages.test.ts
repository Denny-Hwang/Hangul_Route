import { PlacementStrandSchema, REPORT_PERIODS, StrandStatusSchema } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findBannedWord, findWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { PSEUDO_LOCALE } from '../pseudo';
import { getMessages, type MessageLocale } from '../resolve';
import { isPlainObject, leafPaths, lookup } from '../tree';
import type { Messages } from '../types';
import { SAMPLES } from './samples';

/**
 * F-REPORT-001 section 3.11 (RP-6): the `report` namespace and `a11y.report`. English is the source; es (F-I18N-001
 * PR 15) and ko (PR 16) are translated, and every rule below runs on every locale's dictionary.
 */
const REPORT_ROOTS = ['report', 'a11y.report'] as const;

type Rendered = { path: string; text: string };

/** Every output under `path`: strings as they are, functions with their SAMPLES rows. */
function render(node: unknown, path: string, out: Rendered[] = []): Rendered[] {
  if (typeof node === 'string') out.push({ path, text: node });
  else if (typeof node === 'function') {
    const samples = SAMPLES[path];
    expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
    for (const args of samples ?? []) out.push({ path, text: (node as (...a: unknown[]) => string)(...args) });
  } else if (isPlainObject(node)) for (const [key, value] of Object.entries(node)) render(value, `${path}.${key}`, out);
  return out;
}

const outputsOf = (messages: Messages): Rendered[] => REPORT_ROOTS.flatMap((root) => render(lookup(messages, root), root));

/**
 * The report-only list of section 3.11, matched as whole words only (Unicode-aware boundaries), on top of the
 * caregiver list of `banned-words.json`. es / ko add their equivalents with their overlays.
 */
const REPORT_ONLY: Readonly<Record<UiLocale, readonly string[]>> = {
  en: [
    'weak',
    'weakness',
    'poor',
    'worst',
    'rank',
    'ranked',
    'ranking',
    'leaderboard',
    'top',
    'bottom',
    'below',
    'average',
    'compared',
    'should have',
    'struggling',
    'falling',
    'lowest',
    'last place',
  ],
  // F-I18N-001 PR 15: the Spanish equivalents (whole words).
  es: [
    'débil',
    'débiles',
    'debilidad',
    'pobre',
    'peor',
    'ranking',
    'clasificación',
    'tabla de posiciones',
    'mejor que',
    'por debajo',
    'promedio',
    'comparado',
    'comparada',
    'debería haber',
    'le cuesta',
    'último lugar',
    'el más bajo',
  ],
  // F-I18N-001 PR 16: the Korean equivalents (substrings, as `findWord` matches ko).
  ko: ['약점', '부족', '최악', '최하', '순위', '등수', '랭킹', '평균', '비교', '뒤떨어', '꼴찌', '못했', '최저', '해야 했'],
};

/**
 * Nothing in a report shows, counts or mentions speaking (owner decision 2026-10-10), in any locale. The es and ko
 * rows guard the overlays to come (whole words for es, substrings for ko, as `findWord` matches them).
 */
const SPEAKING: Readonly<Record<UiLocale, readonly string[]>> = {
  en: [
    'speak',
    'speaks',
    'speaking',
    'spoke',
    'spoken',
    'speech',
    'say',
    'says',
    'saying',
    'said',
    'talk',
    'talks',
    'talking',
    'pronounce',
    'pronounced',
    'pronouncing',
    'pronunciation',
    'voice',
    'voices',
    'oral',
    'aloud',
    'repeat after',
  ],
  es: ['hablar', 'habla', 'hablas', 'hablando', 'decir', 'pronunciar', 'pronuncia', 'pronunciación', 'voz', 'voces', 'oral', 'en voz alta'],
  ko: ['말하기', '말해', '말하', '발음', '목소리', '소리 내어'],
};

/** No percentage (OD-6), in words either. */
const PERCENT: Readonly<Record<UiLocale, readonly string[]>> = {
  en: ['percent', 'per cent', 'percentage'],
  es: ['por ciento', 'porcentaje'],
  ko: ['퍼센트', '백분율'],
};

describe('report namespace registration', () => {
  it('registers report in the English dictionary and a11y.report under a11y', () => {
    expect(Object.keys(en)).toContain('report');
    expect(en.report.documentTitle).toBe('Report - Hangul Route');
    expect(en.a11y.report.periods).toBe('Report period');
  });

  it('translates report in es (F-I18N-001 PR 15) and ko (PR 16), so every rule below runs on their own words', () => {
    expect(leafPaths(ko).filter((path) => REPORT_ROOTS.some((root) => path === root || path.startsWith(`${root}.`))).length).toBeGreaterThan(150);
    const k = getMessages('ko').report;
    // A name stands before a colon (never before a particle that changes with the final consonant); no plural in ko.
    expect(k.headline.practiced('Mina', 3, k.when.week)).toBe('Mina: 이번 주 3일 연습했어요.');
    expect(k.headline.practiced('Mina', 1, k.when.prevWeek)).toBe('Mina: 지난주 1일 연습했어요.');
    expect(k.you.headline.practiced(3, k.when.week)).toBe('이번 주 3일 연습했어요.');
    expect(k.class.headline(2, 12, k.when.week)).toBe('학습자 12명 중 2명이 이번 주 연습했어요.');
    expect(k.list(['a', 'b', 'c'])).toBe('a, b, c');
    expect(getMessages('ko').a11y.report.loading).toBe('리포트를 불러오는 중');
    const r = getMessages('es').report;
    expect(r.headline.practiced('Mina', 1, r.when.week)).toBe('Mina practicó 1 día esta semana.');
    expect(r.headline.practiced('Mina', 3, r.when.prevWeek)).toBe('Mina practicó 3 días la semana pasada.');
    expect(r.class.headline(1, 12, r.when.week)).toBe('1 de 12 estudiantes practicó esta semana.');
    expect(r.class.headline(2, 12, r.when.week)).toBe('2 de 12 estudiantes practicaron esta semana.');
    expect(r.list(['a', 'b', 'c'])).toBe('a, b y c');
    expect(getMessages('es').a11y.report.loading).toBe('Cargando el informe');
  });
});

describe('Appendix A drafts (English)', () => {
  const r = en.report;
  it('pins the page words', () => {
    expect(r.title.learner('Mina')).toBe('Mina: report');
    expect(r.you.title).toBe('Your report');
    expect(r.title.class('Class A')).toBe('Class A: class report');
    expect(r.chooser).toEqual({ learner: 'Whose report?', class: 'Which class?' });
    expect(r.period).toEqual({ day: 'Today', week: 'This week', month: 'This month', all: 'All time' });
    expect([r.step.prevDay, r.step.prevWeek, r.step.prevMonth, r.step.next]).toEqual(['Yesterday', 'Last week', 'Last month', 'Next']);
    expect(r.glance.nowOn(1, 'Hangul')).toBe('Now on Stage 1: Hangul');
    expect(r.glance.openRoute).toBe('Open Learning Route');
    expect(r.glance.lastPractice('Oct 9')).toBe('Last practice: Oct 9');
    expect(r.horizon('Oct 9')).toBe('Figures up to Oct 9.');
    expect(r.section).toEqual({ wentWell: 'What went well', practiceNext: 'What to practice next', thisPeriod: 'This period', moreDetail: 'More detail' });
    expect([r.figure.days, r.figure.minutes, r.figure.quests, r.figure.cards, r.figure.letters]).toEqual([
      'Practice days',
      'Minutes',
      'New quests',
      'New cards',
      'New letters',
    ]);
    expect(r.figure.up(r.previous.week)).toBe('More than last week');
    expect(r.figure.up(r.previous.month)).toBe('More than all of last month');
    expect(r.detail.lettersStrong('Mina')).toBe('Letters Mina knows well');
    expect(r.detail.lettersPractising).toBe('Letters being practiced');
    expect(r.detail.lettersNew).toBe('New letters this period');
    expect(r.detail.totals(12, 5)).toBe('Since the start: 12 quests, 5 cards');
    expect([r.detail.milestones, r.detail.levelCheck, r.detail.plan]).toEqual(['Milestones', 'Level check', 'Plan']);
    expect(r.action).toEqual({ addToPlan: 'Add to a plan', openPlan: 'Open the plan', sendNote: 'Send a note', seeReport: 'See report' });
    expect(r.print.button).toBe('Print or save as PDF');
    expect(r.print.hint).toBe('Turn off headers and footers in the print dialog.');
    expect(r.print.footer('Oct 9, 2026')).toBe('Private: shared from Hangul Route on Oct 9, 2026.');
    expect(r.nav).toEqual({ reports: 'Reports', classReports: 'Class reports' });
  });

  it('pins the headlines (section 3.15 behaviours 1 and 11)', () => {
    expect(r.headline.practiced('Mina', 3, r.when.week)).toBe('Mina practiced on 3 days this week.');
    expect(r.you.headline.practiced(3, r.when.week)).toBe('You practiced on 3 days this week.');
    expect(r.headline.stageDone('Mina', 1, 'Hangul', r.when.week)).toBe('Mina finished Stage 1: Hangul this week!');
    expect(r.headline.noneYet(r.when.week)).toBe('No practice yet this week.');
    expect(r.headline.noneSaved('Mina', r.when.week)).toBe("Nothing saved from Mina's device this week yet.");
    expect(r.headline.noneSavedAfter('Mina', 'Oct 1')).toBe("Nothing saved from Mina's device after Oct 1 yet.");
    expect(r.you.headline.noneSavedAfter('Oct 1')).toBe('Nothing saved on your device after Oct 1 yet.');
    expect(r.headline.noneThen(r.when.prevWeek)).toBe('No practice last week.');
    expect(r.headline.noneEver).toBe('No practice yet.');
    expect(r.headline.practicedOn('Mina', r.when.day)).toBe('Mina practiced today.');
    expect(r.headline.gettingStarted('Mina')).toBe('Mina is just getting started.');
    expect(r.insight.showed_up('Mina', 1, r.when.week)).toBe('Mina practiced on 1 day this week.');
  });

  it('pins the insight lines (section 3.6, behaviours 4, 10 and 14)', () => {
    const i = r.insight;
    expect(i.stage_done('Mina', 1, 'Hangul')).toBe('Mina finished Stage 1: Hangul.');
    expect(i.letters_new('Mina', 'g and n')).toBe('Mina got strong on g and n.');
    expect(i.practice_days('Mina', 4)).toBe('Mina practiced on 4 days.');
    expect(i.minutes_up(r.previous.week, 36)).toBe('More practice time than last week: 36 minutes.');
    expect(i.minutes_up(r.previous.month, 90)).toBe('More practice time than all of last month: 90 minutes.');
    expect(i.quests_new(2)).toBe('2 new quests finished.');
    expect(i.cards_new(3)).toBe('3 new heritage cards collected.');
    expect(i.level_secure(['Words'])).toBe('Level check: Words looks secure.');
    expect(i.plan_done).toEqual({ class: 'Every homework item in this plan is done.', family: "Everything in this week's plan is done." });
    expect(i.streak(3)).toBe('3 days in a row. Hoya is proud!');
    expect(i.words_new(5)).toBe('5 new words met.');
    expect(i.rhythm).toBe('A short session on two days a week is a great start.');
    expect(i.letters_revisit(r.list([r.letter('x', 'b'), r.letter('x', 's')]))).toBe('x (b) and x (s): worth another visit.');
    expect(i.strand_next('Sounds of letters')).toBe('Sounds of letters is next to grow.');
    expect(i.plan_open.class(4)).toBe('4 homework items are ready to play.');
    expect(i.plan_open.family(4)).toBe('4 plan items are ready to play.');
    expect(i.next_in_plan('Meet g, n, d, l')).toBe('Next in the plan: Meet g, n, d, l.');
    expect(i.next_on_route('Meet g, n, d, l')).toBe('Next on the Learning Route: Meet g, n, d, l.');
    expect(i.free_days_done('Mina')).toBe('Mina finished the free lessons.');
    expect(i.words_revisit('bap')).toBe('bap: worth another look together.');
  });

  it('pins one tip per strand, game titles passed in (section 3.11)', () => {
    expect(r.tip['hangul-recognition']('Letter Match')).toBe('Letter games help: try Letter Match.');
    expect(r.tip['sound-letter']('Listen & Pick')).toBe('Listening games help: try Listen & Pick.');
    expect(r.tip['syllable-reading']).toBe('Read short words together.');
    expect(r.tip.vocabulary).toBe('Word cards help: try a word topic.');
    expect(r.tip.sentences).toBe('Read a short story together.');
    expect(Object.keys(r.tip).sort()).toEqual([...PlacementStrandSchema.options].sort());
  });

  it('names every strand status in words, never as a number (OD-6)', () => {
    expect(r.strand.status).toEqual({ secure: 'Secure', 'getting-there': 'Getting there', 'not-yet': 'Next to learn', 'not-tested': 'Not checked yet' });
    expect(Object.keys(r.strand.status).sort()).toEqual([...StrandStatusSchema.options].sort());
  });

  it('pins the state lines (section 3.14)', () => {
    const s = r.state;
    expect(s.noData('Mina')).toBe("No saved progress from Mina's device yet.");
    expect(s.noDataAction).toBe('Open Hangul Route on that device while online.');
    expect(s.empty('Mina')).toBe('Mina has not started yet. The report fills in after the first practice.');
    expect(s.legacy).toBe('Day-by-day figures are not available yet.');
    expect(s.updateAction('Mina')).toBe("Open Hangul Route on Mina's device while online to update.");
    expect(s.stale('Oct 2')).toBe('Last saved Oct 2.');
    expect([s.unavailable, s.error, s.flagOff]).toEqual(['This report is not available.', "Can't load the report right now.", 'Reports are not available yet.']);
    // RP-7a1: the archived line for a viewer without `space.manage`, never "until you unarchive it".
    expect(s.archived).toEqual({ family: 'This family space is archived. Its report is read-only.', class: 'This class is archived. Its report is read-only.' });
    for (const line of Object.values(s.archived)) expect(line).not.toMatch(/unarchive/i);
  });

  it('pins the class words (section 3.7, behaviour 5)', () => {
    const c = r.class;
    expect(c.headline(2, 12, r.when.week)).toBe('2 of 12 learners practiced this week.');
    expect(c.band.none).toBe('Not yet');
    expect(c.olderApp(3)).toBe('3 learners have an older app: their day-by-day figures appear after an update.');
    expect(c.lettersNew).toBe('Letters the class got strong on');
    expect(c.revisit).toBe('Letters to revisit together');
    expect(c.medianMinutes(12)).toBe('Typical time for those who practiced: 12 minutes');
    expect(c.planLesson).toBe('Plan a lesson');
    expect(c.link).toBe('Class report');
    expect(c.milestones(r.when.week)).toBe('Stage milestones this week');
    expect(c.milestone(1, 'Hangul', 3)).toBe('Stage 1: Hangul, finished by 3 learners');
    expect(c.milestone(1, 'Hangul', 1)).toBe('Stage 1: Hangul, finished by 1 learner');
  });

  it('pins the screen-reader labels (section 3.12)', () => {
    const a = en.a11y.report;
    expect(a.calendar(r.list(['Monday', 'Wednesday', 'Thursday']))).toBe('Practiced on Monday, Wednesday and Thursday.');
    expect(a.notSaved(r.list(['Saturday', 'Sunday']))).toBe('Not saved yet: Saturday and Sunday.');
    expect(a.periodChanged(r.when.week)).toBe('Showing this week');
    expect(a.step(r.when.prevWeek)).toBe('Show last week');
    expect(a.step(r.step.range('Sep 24', 'Sep 30'))).toBe('Show Sep 24 to Sep 30');
    // Next names the window it opens too, the current one included, after its visible label (WCAG 2.5.3).
    expect(a.step(r.when.week)).toBe('Show this week');
    expect(a.stepNext(r.when.week)).toBe(`${r.step.next}: show this week`);
    expect(a.stepNext(r.when.prevWeek).startsWith(r.step.next)).toBe(true);
    expect(a.periodChanged(r.when.prevMonth)).toBe('Showing last month');
  });

  it('has a sentence word for every period tab and a step name for every stepper', () => {
    for (const period of REPORT_PERIODS) {
      expect(r.period[period].length).toBeGreaterThan(0);
      expect(r.when[period].length).toBeGreaterThan(0);
    }
  });
});

describe('report.list and report.letter', () => {
  it('joins a list the English way', () => {
    expect(en.report.list([])).toBe('');
    expect(en.report.list(['a'])).toBe('a');
    expect(en.report.list(['a', 'b'])).toBe('a and b');
    expect(en.report.list(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('keeps each item once and in order in every locale, so a page can render a chip per letter between the separators', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    try {
      for (const locale of [...LOCALES, PSEUDO_LOCALE] as const) {
        for (const items of [['\u0001'], ['\u0001', '\u0002'], ['\u0001', '\u0002', '\u0003', '\u0004']]) {
          const out = getMessages(locale).report.list(items);
          const at = items.map((item) => out.indexOf(item));
          expect(items.every((item) => out.split(item).length === 2), `${locale}: ${out}`).toBe(true);
          expect([...at].sort((x, y) => x - y)).toEqual(at);
        }
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('puts the romanization after a taught letter', () => {
    expect(en.report.letter('x', 'b')).toBe('x (b)');
  });
});

describe('copy rules for report and a11y.report, in every locale', () => {
  for (const locale of LOCALES) {
    const outputs = (): Rendered[] => outputsOf(getMessages(locale));

    it(`${locale}: renders every leaf (no empty string, no placeholder left)`, () => {
      expect(outputs().length).toBeGreaterThan(150);
      for (const { path, text } of outputs()) {
        expect(text.trim().length, path).toBeGreaterThan(0);
        expect(text, path).not.toMatch(/[{}]|undefined|null|NaN/);
      }
    });

    it(`${locale}: no caregiver-banned word (banned-words.json, which includes the learner list)`, () => {
      for (const { path, text } of outputs()) expect(findBannedWord(text, locale, 'caregiver'), `${path}: ${text}`).toBeNull();
    });

    // English words apply to every locale too, so an English fallback is checked wherever it shows.
    it(`${locale}: no report-only word (ranking, comparison, deficit words; whole words, ko substrings)`, () => {
      for (const { path, text } of outputs()) {
        expect(findWord(text, REPORT_ONLY.en, 'en'), `${path}: ${text}`).toBeNull();
        expect(findWord(text, REPORT_ONLY[locale], locale), `${path}: ${text}`).toBeNull();
      }
    });

    it(`${locale}: no word about speaking, pronunciation or voice`, () => {
      for (const { path, text } of outputs()) {
        expect(findWord(text, SPEAKING.en, 'en'), `${path}: ${text}`).toBeNull();
        expect(findWord(text, SPEAKING[locale], locale), `${path}: ${text}`).toBeNull();
      }
    });

    it(`${locale}: no emoji and no emoji-capable symbol`, () => {
      for (const { path, text } of outputs()) expect(/\p{Extended_Pictographic}|\uFE0F|\u20E3/u.test(text), `${path}: ${text}`).toBe(false);
    });

    it(`${locale}: no percentage (OD-6) and no "locked" (items not ready are left out, section 3.5)`, () => {
      for (const { path, text } of outputs()) {
        expect(text, path).not.toContain('%');
        expect(findWord(text, PERCENT.en, 'en'), `${path}: ${text}`).toBeNull();
        expect(findWord(text, PERCENT[locale], locale), `${path}: ${text}`).toBeNull();
        expect(findWord(text, ['lock', 'locked'], 'en'), `${path}: ${text}`).toBeNull();
      }
    });
  }

  it('the matcher takes whole words in en and es and never matches inside a word; ko matches with particles (self-check)', () => {
    expect(findWord('Stop', ['top'], 'en')).toBeNull();
    expect(findWord('desktop', ['top'], 'en')).toBeNull();
    expect(findWord('Frank', ['rank'], 'en')).toBeNull();
    expect(findWord('Top letters', ['top'], 'en')).toBe('top');
    expect(findWord('below.', ['below'], 'en')).toBe('below');
    expect(findWord('He should  have', ['should have'], 'en')).toBe('should have');
    expect(findWord('último lugar', ['lugar'], 'es')).toBe('lugar');
    expect(findWord('lugares', ['lugar'], 'es')).toBeNull();
    expect(findWord('ápoor', ['poor'], 'en')).toBeNull();
    expect(findWord('순위가 올랐어요', ['순위'], 'ko')).toBe('순위');
    expect(findWord('Mina is the top reader.', REPORT_ONLY.en, 'en')).toBe('top');
    expect(findWord('Say it with Hoya.', SPEAKING.en, 'en')).toBe('say');
    expect(findWord('Lee en voz alta.', SPEAKING.es, 'es')).not.toBeNull();
    expect(findWord('Lee en voz alta.', ['en voz alta'], 'es')).toBe('en voz alta');
    expect(findWord('발음을 들어요', SPEAKING.ko, 'ko')).toBe('발음');
    expect(findWord('80 percent right', PERCENT.en, 'en')).toBe('percent');
  });
});

/**
 * Section 3.11: every count goes through `plural()`. Rendered with 1 and with 2, the number shows once and the
 * singular differs from the plural (ko has no grammatical plural, so its rows may match).
 */
const COUNTED: readonly [string, (m: Messages, n: number) => string][] = [
  ['report.headline.practiced', (m, n) => m.report.headline.practiced('Mina', n, 'this week')],
  ['report.you.headline.practiced', (m, n) => m.report.you.headline.practiced(n, 'this week')],
  ['report.insight.showed_up', (m, n) => m.report.insight.showed_up('Mina', n, 'this week')],
  ['report.you.insight.showed_up', (m, n) => m.report.you.insight.showed_up(n, 'this week')],
  ['report.insight.practice_days', (m, n) => m.report.insight.practice_days('Mina', n)],
  ['report.you.insight.practice_days', (m, n) => m.report.you.insight.practice_days(n)],
  ['report.insight.minutes_up', (m, n) => m.report.insight.minutes_up('last week', n)],
  ['report.insight.quests_new', (m, n) => m.report.insight.quests_new(n)],
  ['report.insight.cards_new', (m, n) => m.report.insight.cards_new(n)],
  ['report.insight.streak', (m, n) => m.report.insight.streak(n)],
  ['report.insight.words_new', (m, n) => m.report.insight.words_new(n)],
  ['report.insight.plan_open.class', (m, n) => m.report.insight.plan_open.class(n)],
  ['report.insight.plan_open.family', (m, n) => m.report.insight.plan_open.family(n)],
  ['report.detail.totals (quests)', (m, n) => m.report.detail.totals(n, 7)],
  ['report.detail.totals (cards)', (m, n) => m.report.detail.totals(7, n)],
  ['report.growth.since', (m, n) => m.report.growth.since('Oct 9', n)],
  ['report.detail.lettersMore', (m, n) => m.report.detail.lettersMore(n)],
  ['report.class.headline', (m, n) => m.report.class.headline(0, n, 'this week')],
  ['report.class.learners', (m, n) => m.report.class.learners(n)],
  ['report.class.olderApp', (m, n) => m.report.class.olderApp(n)],
  ['report.class.notSaved', (m, n) => m.report.class.notSaved(n)],
  ['report.class.windowNotSaved', (m, n) => m.report.class.windowNotSaved(n)],
  ['report.class.milestone', (m, n) => m.report.class.milestone(7, 'Self-expression', n)],
  ['report.class.minutesTotal', (m, n) => m.report.class.minutesTotal(n)],
  ['report.class.medianMinutes', (m, n) => m.report.class.medianMinutes(n)],
];

/** Messages with a number that is not a noun count (no plural to choose), each with the reason. */
const NUMBER_NOT_COUNTED: Readonly<Record<string, string>> = {
  'report.glance.nowOn': 'a stage number',
  'report.headline.stageDone': 'a stage number',
  'report.headline.stageDoneAll': 'a stage number',
  'report.you.headline.stageDone': 'a stage number',
  'report.you.headline.stageDoneAll': 'a stage number',
  'report.insight.stage_done': 'a stage number',
  'report.you.insight.stage_done': 'a stage number',
  'report.detail.milestone': 'a stage number',
  'report.detail.planRow.class': 'numbers beside "done" and "ready to play", no noun',
  'report.detail.planRow.family': 'numbers beside "done" and "ready to play", no noun',
  'report.detail.planRow.self': 'numbers beside "done" and "ready to play", no noun',
  'report.detail.planRow.device': 'numbers beside "done" and "ready to play", no noun',
  'report.class.questsNew': 'a label and its number',
  'report.class.cardsNew': 'a label and its number',
  'report.class.count': 'a label and its number',
  'report.class.band.range': 'a range of 2 or more days, always plural',
  'report.class.band.atLeast': 'the 10+ band, always plural',
  'report.class.planRow': 'numbers after "assigned to", "started by" and "finished by", no noun',
};

describe('report counts use plural() in every locale (en, es, ko, en-XA)', () => {
  it('every message with a number is in the plural rows below or says why it has no plural', () => {
    const counted = new Set(COUNTED.map(([path]) => path.split(' ')[0]));
    const numeric = [...leafPaths(en.report).map((path) => `report.${path}`), ...leafPaths(en.a11y.report).map((path) => `a11y.report.${path}`)].filter(
      (path) => (SAMPLES[path] ?? []).some((args) => args.some((arg) => typeof arg === 'number')),
    );
    expect(numeric.filter((path) => !counted.has(path) && NUMBER_NOT_COUNTED[path] === undefined)).toEqual([]);
    for (const path of [...counted, ...Object.keys(NUMBER_NOT_COUNTED)]) expect(numeric, path).toContain(path);
  });

  it('level_secure agrees with the number of strands it names', () => {
    expect(en.report.insight.level_secure(['Words'])).toMatch(/ looks /);
    expect(en.report.insight.level_secure(['Words', 'Sentences'])).toMatch(/ look /);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('English reads "1 day" and "2 days"', () => {
    const r = en.report;
    expect(r.headline.practiced('Mina', 1, 'this week')).toBe('Mina practiced on 1 day this week.');
    expect(r.headline.practiced('Mina', 2, 'this week')).toBe('Mina practiced on 2 days this week.');
    expect(r.insight.quests_new(1)).toBe('1 new quest finished.');
    expect(r.insight.minutes_up('last week', 1)).toBe('More practice time than last week: 1 minute.');
    expect(r.detail.totals(1, 1)).toBe('Since the start: 1 quest, 1 card');
    expect(r.class.headline(1, 1, 'today')).toBe('1 of 1 learner practiced today.');
    expect(r.class.olderApp(1)).toBe('1 learner has an older app: their day-by-day figures appear after an update.');
    expect(r.insight.level_secure(['Words', 'Sentences'])).toBe('Level check: Words and Sentences look secure.');
  });

  it('n = 1 and n = 2 rows', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const locales: readonly MessageLocale[] = [...LOCALES, PSEUDO_LOCALE];
    for (const locale of locales) {
      const messages = getMessages(locale);
      if (locale === PSEUDO_LOCALE) expect(messages.report.documentTitle).toMatch(/^\[/);
      for (const [path, count] of COUNTED) {
        const one = count(messages, 1);
        const two = count(messages, 2);
        expect(one.match(/\b1\b/g), `${locale}:${path}(1) = ${one}`).toHaveLength(1);
        expect(two.match(/\b2\b/g), `${locale}:${path}(2) = ${two}`).toHaveLength(1);
        if (locale !== 'ko') expect(one.replace(/\b1\b/, '2'), `${locale}:${path} has a singular`).not.toBe(two);
      }
    }
  });
});

/**
 * Taught Korean (letters, words) arrives as one argument the page renders in place (`aroundSlot`, marked
 * `lang="ko"`), so each of these messages uses it exactly once in every locale, en-XA included.
 */
const SLOTTED: readonly [string, (m: Messages) => (value: string) => string][] = [
  ['report.insight.letters_new', (m) => (v) => m.report.insight.letters_new('Mina', v)],
  ['report.you.insight.letters_new', (m) => m.report.you.insight.letters_new],
  ['report.insight.letters_revisit', (m) => m.report.insight.letters_revisit],
  ['report.insight.words_revisit', (m) => m.report.insight.words_revisit],
  ['report.letter', (m) => (v) => m.report.letter(v, 'b')],
];

describe('messages that take taught Korean use it exactly once (aroundSlot)', () => {
  const SENTINEL = '\u0000';
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('in every locale and in en-XA', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    for (const locale of [...LOCALES, PSEUDO_LOCALE] as const) {
      const messages = getMessages(locale);
      for (const [path, pick] of SLOTTED) {
        const out = pick(messages)(SENTINEL);
        expect(out.split(SENTINEL).length - 1, `${locale}:${path}`).toBe(1);
      }
    }
  });
});

describe('voices (OD-17): third person for grown-ups, second person on a self-only device', () => {
  /** Each second-person message and its third-person twin; the twin takes the learner's name first. */
  const TWINS: readonly [you: string, third: string][] = [
    ['report.you.title', 'report.title.learner'],
    ['report.you.headline.practiced', 'report.headline.practiced'],
    ['report.you.headline.practicedOn', 'report.headline.practicedOn'],
    ['report.you.headline.stageDone', 'report.headline.stageDone'],
    ['report.you.headline.stageDoneAll', 'report.headline.stageDoneAll'],
    ['report.you.headline.noneSaved', 'report.headline.noneSaved'],
    ['report.you.headline.noneSavedAfter', 'report.headline.noneSavedAfter'],
    ['report.you.headline.gettingStarted', 'report.headline.gettingStarted'],
    ['report.you.detail.lettersStrong', 'report.detail.lettersStrong'],
    ['report.you.insight.showed_up', 'report.insight.showed_up'],
    ['report.you.insight.stage_done', 'report.insight.stage_done'],
    ['report.you.insight.letters_new', 'report.insight.letters_new'],
    ['report.you.insight.practice_days', 'report.insight.practice_days'],
    ['report.you.insight.practice_day', 'report.insight.practice_day'],
    ['report.you.insight.free_days_done', 'report.insight.free_days_done'],
    ['report.you.state.empty', 'report.state.empty'],
  ];

  /** The lines that picture a grown-up and a learner side by side ("together"), and their lone-learner twins. */
  const PAIR_TWINS: readonly [you: string, third: string][] = [
    ['report.you.tip.syllable-reading', 'report.tip.syllable-reading'],
    ['report.you.tip.sentences', 'report.tip.sentences'],
    ['report.you.insight.words_revisit', 'report.insight.words_revisit'],
  ];

  it('every "together" line a device can show has a lone-learner twin, with the same arguments and no "together"', () => {
    const together = render(en.report, 'report')
      .filter(({ path, text }) => !path.startsWith('report.you.') && !path.startsWith('report.class.') && /\btogether\b/i.test(text))
      .map(({ path }) => path);
    expect([...new Set(together)].sort()).toEqual(PAIR_TWINS.map(([, third]) => third).sort());
    for (const [youPath, thirdPath] of PAIR_TWINS) {
      const you = lookup(en, youPath);
      const third = lookup(en, thirdPath);
      expect(typeof you, youPath).toBe(typeof third);
      if (typeof you === 'function') expect(you.length).toBe((third as (...a: unknown[]) => string).length);
      for (const { text } of render(you, youPath)) expect(text, youPath).not.toMatch(/\btogether\b/i);
    }
  });

  it('every report.you.insight key is an insight code, so a renderer can look up you.insight[code] ?? insight[code]', () => {
    for (const code of Object.keys(en.report.you.insight)) expect(Object.keys(en.report.insight), code).toContain(code);
  });

  it('every report.you leaf has a twin, and a name twin takes the name as one more argument', () => {
    const youPaths = leafPaths(en.report.you).map((p) => `report.you.${p}`);
    expect(youPaths.sort()).toEqual([...TWINS, ...PAIR_TWINS].map(([you]) => you).sort());
    for (const [youPath, thirdPath] of TWINS) {
      const you = lookup(en, youPath);
      const third = lookup(en, thirdPath);
      expect(typeof third, thirdPath).toBe('function');
      const youArity = typeof you === 'function' ? you.length : 0;
      expect(youArity + 1, `${youPath} vs ${thirdPath}`).toBe((third as (...a: unknown[]) => string).length);
    }
  });

  /** Third-person messages that never show on a self-only device: the console's states for a device elsewhere. */
  const CONSOLE_ONLY: Readonly<Record<string, string>> = {
    'report.state.noData': 'the in-app report always reads its own device, which holds a summary',
    'report.state.updateAction': 'it asks a grown-up to open the app on another device',
  };

  it('every message that names the learner has a second-person twin, or never shows on a device', () => {
    const twinned = new Set(TWINS.map(([, third]) => third));
    const naming = render(en.report, 'report')
      .filter(({ path, text }) => !path.startsWith('report.you.') && /Mina|Alexandria Kimberley/.test(text))
      .map(({ path }) => path);
    expect([...new Set(naming)].filter((path) => !twinned.has(path) && CONSOLE_ONLY[path] === undefined)).toEqual([]);
    for (const path of Object.keys(CONSOLE_ONLY)) expect(naming).toContain(path);
  });

  it('third person names the learner; second person never does and speaks to "you"', () => {
    const name = 'Mina';
    for (const [youPath, thirdPath] of TWINS) {
      const third = render(lookup(en, thirdPath), thirdPath);
      const you = render(lookup(en, youPath), youPath);
      for (const { text } of third) expect(text, thirdPath).toMatch(/Mina|Alexandria Kimberley/);
      for (const { text } of you) {
        expect(text, youPath).not.toContain(name);
        expect(text, youPath).toMatch(/\b(you|your)\b/i);
      }
    }
  });
});

describe('family and class words (section 3.11)', () => {
  const r = en.report;
  it('class lines say homework; family lines say plan and never homework', () => {
    expect(r.insight.plan_done.class).toMatch(/\bhomework\b/);
    expect(r.insight.plan_open.class(2)).toMatch(/\bhomework\b/);
    expect(r.detail.planRow.class(1, 2)).toMatch(/^Homework\b/);
    for (const text of [r.insight.plan_done.family, r.insight.plan_open.family(2), r.detail.planRow.family(1, 2)]) {
      expect(text).toMatch(/\bplan\b/);
      expect(text).not.toMatch(/homework/i);
    }
  });

  it('plan rows count done and ready to play only', () => {
    expect(r.detail.planRow.class(3, 2)).toBe('Homework: 3 done, 2 ready to play');
    expect(r.detail.planRow.family(3, 2)).toBe("This week's plan: 3 done, 2 ready to play");
    expect(r.detail.planRow.self(3, 2)).toBe('Own route: 3 done, 2 ready to play');
    expect(r.detail.planRow.device(3, 2)).toBe('Plans and homework: 3 done, 2 ready to play');
  });
});

describe('privacy in the page frame (section 3.10)', () => {
  it('the document title never takes a name', () => {
    expect(typeof en.report.documentTitle).toBe('string');
    for (const locale of LOCALES) expect(getMessages(locale).report.documentTitle).not.toMatch(/\{|name/i);
  });
});
