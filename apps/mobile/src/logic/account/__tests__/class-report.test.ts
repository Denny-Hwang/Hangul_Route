import { CATALOG, type ClassReport, type ReportPeriod } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountClassReportBody } from '../account-data';
import { accountClassReportView, countedLetter, type AccountClassReportView } from '../class-report';
import { accountDenyHits } from '../deny-list';

/**
 * F-AUTH-004 section 8.7 (row NS-6; design `account-reports.md` board 2, `design/screens/reports/class-report.md`;
 * F-REPORT-001 section 3.7): the native class report in words. Aggregates only (no learner named, ranked or compared),
 * up-only markers, the console's lines and stepper, and what native leaves out: Print, Send a note, Plan a lesson, the
 * homework plan link (its counts stay as text) and the owner's Settings line on an archived class.
 */

void CATALOG;
const en = getMessages('en');
const c = en.report.class;
/** Sunday Nov 8, 2026, noon UTC (the viewer's day; tests run in UTC). */
const NOW = new Date('2026-11-08T12:00:00.000Z');

const REPORT: ClassReport = {
  v: 1,
  period: 'week',
  headline: { code: 'class_practiced', practiced: 18, learners: 24, up: true },
  class: { learners: 24, withActivity: 23, olderApp: 1, notSaved7d: 2 },
  wentWell: {
    lettersNew: [
      { letter: 'ㅂ', learners: 5 },
      { letter: 'ㅁ', learners: 4 },
    ],
    questsNew: { count: 14, up: true },
    cardsNew: 9,
    milestones: [
      { stage: 'stage1', count: 2 },
      { stage: 'stage-from-the-future' as never, count: 1 },
    ],
  },
  revisit: [{ letter: 'ㄹ', learners: 4 }],
  practice: {
    dayBands: [
      { band: '0', learners: 3 },
      { band: '1-2', learners: 3 },
      { band: '3-4', learners: 9 },
      { band: '5-7', learners: 6 },
    ],
    notSaved: 2,
  },
  time: { minutesTotal: { count: 212, up: true }, minutesMedian: 24 },
  levelCheck: [{ strand: 'hangul-recognition', secure: 4, gettingThere: 3, notYet: 1, notTested: 16 }],
  plans: [{ planId: 'plan:week-1', title: 'Week 1 letters', assigned: 12, started: 9, finished: 6, itemsDone: 30 }],
  memory: { learners: 5, wordsKnown: 40, readyToRefresh: 3, levels: [2, 1, 0], stageChecks: 1 },
};

const body = (over: Partial<ClassReport> = {}, space: Partial<AccountClassReportBody['space']> = {}): AccountClassReportBody => ({
  space: { id: 'space:c', kind: 'class', name: 'Saturday class 3B', archivedAt: null, ...space },
  period: 'week',
  at: null,
  report: { ...REPORT, ...over },
});

function viewOf(b: AccountClassReportBody, period: ReportPeriod = 'week', at: string | null = null, locale: UiLocale = 'en'): AccountClassReportView {
  const view = accountClassReportView({ body: b, period, at, now: NOW, locale, messages: getMessages(locale), stageTitle: (stage) => (stage === 'stage1' ? 'Hangul' : stage) });
  if (view === null) throw new Error('no view');
  return view;
}

/** Every word the view would draw or read aloud. */
function wordsOf(view: AccountClassReportView): string[] {
  return JSON.stringify(view)
    .match(/"(?:[^"\\]|\\.)*"/g)!
    .map((s) => JSON.parse(s) as string);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the frame', () => {
  it('a space that is not a class has no class report', () => {
    expect(accountClassReportView({ body: body({}, { kind: 'family' }), period: 'week', at: null, now: NOW, locale: 'en', messages: en, stageTitle: () => '' })).toBeNull();
    expect(accountClassReportView({ body: body({}, { kind: 'school' }), period: 'week', at: null, now: NOW, locale: 'en', messages: en, stageTitle: () => '' })).toBeNull();
  });

  it('the title, the neutral class lines, the tabs and the announcement', () => {
    const view = viewOf(body());
    expect(view.title).toBe(en.report.title.class('Saturday class 3B'));
    expect(view.classLines).toEqual([c.learners(24), c.olderApp(1), c.notSaved(2)]);
    expect(view.archived).toBeNull();
    expect(view.tabs).toEqual({ label: en.a11y.report.periods, items: ['day', 'week', 'month', 'all'].map((p) => ({ id: p, label: en.report.period[p as ReportPeriod] })), value: 'week' });
    expect(view.announce).toBe(en.a11y.report.periodChanged(en.report.when.week));
    expect(viewOf(body(), 'all').announce).toBe(en.a11y.report.periodChangedAll);
  });

  it('an archived class: the neutral line for every viewer (never the owner Settings line)', () => {
    const view = viewOf(body({}, { archivedAt: '2026-06-01T00:00:00.000Z' }));
    expect(view.archived).toBe(en.report.state.archived.class);
    expect(wordsOf(view)).not.toContain(en.console.settings.archived.class);
  });

  it('only the counts the class lines need', () => {
    expect(viewOf(body({ class: { learners: 3, withActivity: 3, olderApp: 0, notSaved7d: 0 } })).classLines).toEqual([c.learners(3)]);
  });

  it('no learner: the empty line and nothing else', () => {
    const view = viewOf(body({ class: { learners: 0, withActivity: 0, olderApp: 0, notSaved7d: 0 } }));
    expect(view).toMatchObject({ empty: c.empty, tabs: null, stepper: null, announce: null, headline: null, wentWell: null, practiceTogether: null, thisPeriod: null, moreDetail: null });
  });
});

describe('the blocks (section 3.7): aggregates only, up-only markers', () => {
  it('the headline with its up line on a week; no up on a day or all time', () => {
    expect(viewOf(body()).headline).toEqual({ text: c.headline(18, 24, en.report.when.week), up: en.report.figure.up(en.report.previous.week), note: null });
    expect(viewOf(body(), 'day').headline?.up).toBeNull();
    expect(viewOf(body(), 'all').headline).toEqual({ text: c.headline(18, 24, en.report.when.all), up: null, note: c.allBeforeJoin });
    expect(viewOf(body(), 'month').headline?.up).toBe(en.report.figure.up(en.report.previous.month));
  });

  it('a past window grows against the window before it', () => {
    expect(viewOf(body(), 'week', '2026-11-01').headline?.up).toBe(en.report.figure.up(en.report.previous.weekBefore));
    expect(viewOf(body(), 'month', '2026-10-01').headline?.up).toBe(en.report.figure.up(en.report.previous.monthBefore));
  });

  it('what went well: counted letters (the letter spoken in Korean), quests with up, cards, milestones (an unknown stage left out)', () => {
    const went = viewOf(body()).wentWell!;
    expect(went.heading).toBe(en.report.section.wentWell);
    expect(went.letters?.heading).toBe(c.lettersNew);
    expect(went.letters?.chips.map((chip) => chip.text)).toEqual([c.count(en.report.letter('ㅂ', 'b'), 5), c.count(en.report.letter('ㅁ', 'm'), 4)]);
    expect(went.letters?.chips[0]?.parts.find((p) => p.kind === 'letter')).toMatchObject({ letter: 'ㅂ', romanization: 'b' });
    expect(went.quests).toEqual({ text: c.questsNew(14), up: en.report.figure.up(en.report.previous.week) });
    expect(went.cards).toBe(c.cardsNew(9));
    expect(went.milestones).toEqual({ heading: c.milestones(en.report.when.week), lines: [c.milestone(1, 'Hangul', 2)] });
  });

  it('no practice in the window: what went well hidden, the none line in This period', () => {
    const quiet = body({ headline: { code: 'class_practiced', practiced: 0, learners: 24 }, wentWell: { lettersNew: [], questsNew: { count: 0 }, cardsNew: 0, milestones: [] } });
    expect(viewOf(quiet).wentWell).toBeNull();
    expect(viewOf(quiet).thisPeriod?.noneYet).toBe(en.report.headline.noneYet(en.report.when.week));
    expect(viewOf(quiet, 'all').thisPeriod?.noneYet).toBe(en.report.headline.noneEver);
    expect(viewOf(quiet, 'week', '2026-10-25').thisPeriod?.noneYet).toMatch(/^No practice /);
    expect(viewOf(quiet, 'week', '2026-10-25').thisPeriod?.noneYet).toBe(en.report.headline.noneThen(en.report.when.weekTo('Oct 25')));
  });

  it('no letters and no milestones: those parts are left out', () => {
    const went = viewOf(body({ wentWell: { lettersNew: [], questsNew: { count: 1 }, cardsNew: 0, milestones: [] } })).wentWell!;
    expect(went.letters).toBeNull();
    expect(went.milestones).toBeNull();
    expect(went.quests.up).toBeNull();
  });

  it('practice together: the letters to revisit; none without them (no Plan a lesson)', () => {
    expect(viewOf(body()).practiceTogether).toEqual({ heading: c.section.practiceTogether, revisit: { heading: c.revisit, chips: [countedLetter('ㄹ', 4, en)] } });
    expect(viewOf(body({ revisit: [] })).practiceTogether).toBeNull();
    expect(wordsOf(viewOf(body()))).not.toContain(c.planLesson);
  });

  it('this period: day bands as text rows (the empty band says so, never highlighted), not saved, time with the median', () => {
    const period = viewOf(body()).thisPeriod!;
    expect(period.bands).toEqual({ heading: c.section.daysPracticed, rows: [c.didntPractice(3), c.count(c.band.range(1, 2), 3), c.count(c.band.range(3, 4), 9), c.count(c.band.range(5, 7), 6)] });
    expect(period.notSaved).toBe(c.windowNotSaved(2));
    expect(period.noneYet).toBeNull();
    expect(period.time).toEqual({ heading: c.section.time, total: c.minutesTotal(212), up: en.report.figure.up(en.report.previous.week), median: c.medianMinutes(24) });
  });

  it('every band: practiced and not yet on a day, 10 or more on a month; no bands on all time', () => {
    const day = viewOf(body({ practice: { dayBands: [{ band: 'practiced', learners: 5 }, { band: 'not_yet', learners: 2 }] } }), 'day').thisPeriod!;
    expect(day.bands?.rows).toEqual([c.count(c.band.practiced, 5), c.didntPractice(2)]);
    expect(day.notSaved).toBeNull();
    const month = viewOf(body({ practice: { dayBands: [{ band: '10+', learners: 1 }, { band: '5-9', learners: 1 }] } }), 'month').thisPeriod!;
    expect(month.bands?.rows).toEqual([c.count(c.band.atLeast(10), 1), c.count(c.band.range(5, 9), 1)]);
    expect(viewOf(body({ practice: {} }), 'all').thisPeriod?.bands).toBeNull();
    expect(viewOf(body({ practice: { dayBands: [] } })).thisPeriod?.bands).toBeNull();
  });

  it('fewer than 3 practiced: no median (the total stays)', () => {
    expect(viewOf(body({ time: { minutesTotal: { count: 30 }, minutesMedian: null } })).thisPeriod?.time).toEqual({ heading: c.section.time, total: c.minutesTotal(30), up: null, median: null });
  });

  it('every learner on an older app: This period says the figures come after an update', () => {
    expect(viewOf(body({ class: { learners: 4, withActivity: 0, olderApp: 4, notSaved7d: 0 } })).thisPeriod).toEqual({ heading: en.report.section.thisPeriod, noneYet: null, afterUpdate: c.afterUpdate, bands: null, notSaved: null, time: null });
  });

  it('more detail: memory totals, level check counts per strand, homework counts as plain text (no plan link)', () => {
    const more = viewOf(body()).moreDetail!;
    expect(more.button).toBe(en.report.section.moreDetail);
    expect(more.memory).toEqual({ heading: en.report.detail.memory, lines: [c.wordsKnown(40), c.readyToRefresh(3), en.report.detail.mastery(2, 1, 0), c.stageChecks(1)], from: c.memoryFrom(5) });
    expect(more.levelCheck).toEqual({
      heading: c.section.levelCheck,
      strands: [{ name: en.caregiver.placementReport.strand['hangul-recognition'], rows: [c.count(en.report.strand.status.secure, 4), c.count(en.report.strand.status['getting-there'], 3), c.count(en.report.strand.status['not-yet'], 1), c.count(en.report.strand.status['not-tested'], 16)] }],
    });
    expect(more.homework).toEqual({ heading: c.section.homework, plans: [{ title: 'Week 1 letters', counts: c.planRow(12, 9, 6) }] });
    expect(JSON.stringify(more)).not.toMatch(/href|plan:week-1/);
  });

  it('memory: only lines above 0; none with no learner or all zero', () => {
    expect(viewOf(body({ memory: { learners: 2, wordsKnown: 0, readyToRefresh: 0, levels: [0, 0, 0], stageChecks: 0 } })).moreDetail?.memory).toBeNull();
    expect(viewOf(body({ memory: { learners: 0, wordsKnown: 4, readyToRefresh: 0, levels: [0, 0, 0], stageChecks: 0 } })).moreDetail?.memory).toBeNull();
    expect(viewOf(body({ memory: { learners: 2, wordsKnown: 4, readyToRefresh: 0, levels: [0, 0, 0], stageChecks: 0 } })).moreDetail?.memory?.lines).toEqual([c.wordsKnown(4)]);
  });

  it('no memory, no level check and no homework: no More detail', () => {
    expect(viewOf(body({ memory: undefined, levelCheck: [], plans: [] })).moreDetail).toBeNull();
  });

  it('a letter this build cannot romanize is drawn bare, still counted', () => {
    expect(countedLetter('?', 2, en)).toEqual({ text: c.count('?', 2), parts: [{ kind: 'letter', letter: '?', romanization: null, before: '', after: '' }, { kind: 'text', text: ': 2' }] });
  });
});

describe('the stepper (the class stepper limits, classAtOf)', () => {
  it('this week: Last week back, no Next; the range of this week', () => {
    const stepper = viewOf(body()).stepper!;
    expect(stepper.prev).toEqual({ at: '2026-11-01', label: en.report.step.prevWeek, name: en.a11y.report.step(en.report.when.prevWeek) });
    expect(stepper.next).toBeNull();
    expect(stepper.range).toBe(en.report.step.range('Nov 2', 'Nov 8'));
  });

  it('last week: an older window back (named by its dates), Next to this week', () => {
    const stepper = viewOf(body(), 'week', '2026-11-01').stepper!;
    expect(stepper.prev?.at).toBe('2026-10-25');
    expect(stepper.prev?.label).toBe(en.report.step.range('Oct 19', 'Oct 25'));
    expect(stepper.next).toEqual({ at: null, label: en.report.step.next, name: en.a11y.report.stepNext(en.report.when.week) });
  });

  it('two weeks back: Next goes one week forward', () => {
    expect(viewOf(body(), 'week', '2026-10-25').stepper?.next?.at).toBe('2026-11-01');
  });

  it('a day: Yesterday back; a month: Last month back, Next forward from older months', () => {
    expect(viewOf(body(), 'day').stepper?.prev).toMatchObject({ at: '2026-11-07', label: en.report.step.prevDay });
    expect(viewOf(body(), 'day', '2026-11-06').stepper?.prev?.label).toBe('Nov 5');
    expect(viewOf(body(), 'day', '2026-11-07').stepper?.next?.at).toBeNull();
    expect(viewOf(body(), 'month').stepper).toMatchObject({ prev: { at: '2026-10-01', label: en.report.step.prevMonth }, next: null });
    expect(viewOf(body(), 'month', '2026-09-01').stepper?.next?.at).toBe('2026-10-01');
    expect(viewOf(body(), 'month', '2026-10-01').stepper?.next?.at).toBeNull();
    expect(viewOf(body(), 'month', '2026-09-01').headline?.text).toBe(c.headline(18, 24, en.report.when.inMonth('September 2026')));
    expect(viewOf(body(), 'day', '2026-11-06').headline?.text).toBe(c.headline(18, 24, en.report.when.onDay('Nov 6')));
    expect(viewOf(body(), 'day', '2026-11-07').headline?.text).toBe(c.headline(18, 24, en.report.when.prevDay));
    expect(viewOf(body(), 'month', '2026-10-01').headline?.text).toBe(c.headline(18, 24, en.report.when.prevMonth));
    expect(viewOf(body(), 'month', '2026-10-01').announce).toBe(en.a11y.report.periodChanged(en.report.when.prevMonth));
  });

  it('no Previous past the oldest window the class keeps; no stepper on all time', () => {
    expect(viewOf(body(), 'month', '2024-11-01').stepper?.prev).toBeNull();
    expect(viewOf(body(), 'all').stepper).toBeNull();
  });

  it('a window out of range reads as the current one', () => {
    expect(viewOf(body(), 'week', '2030-01-01').stepper?.next).toBeNull();
  });

  it('a clock that cannot be read: no stepper', () => {
    const view = accountClassReportView({ body: body(), period: 'week', at: null, now: new Date(Number.NaN), locale: 'en', messages: en, stageTitle: () => '' });
    expect(view?.stepper).toBeNull();
  });

  it('a date outside the viewer\'s year carries its year', () => {
    const jan = new Date('2027-01-03T12:00:00.000Z');
    const view = accountClassReportView({ body: body(), period: 'week', at: null, now: jan, locale: 'en', messages: en, stageTitle: () => '' });
    expect(view?.stepper?.range).toBe(en.report.step.range('Dec 28, 2026', 'Jan 3'));
  });
});

describe('section 9.2: the class report words pass the deny list in en, es and ko', () => {
  it.each(['en', 'es', 'ko'] as UiLocale[])('%s', (locale) => {
    const views = [viewOf(body(), 'week', null, locale), viewOf(body(), 'all', null, locale), viewOf(body({}, { archivedAt: '2026-01-01T00:00:00.000Z' }), 'month', '2026-09-01', locale)];
    const words = views.flatMap(wordsOf).map((t) => t.replace(/Saturday class 3B|Week 1 letters/g, 'NAME'));
    expect(words.flatMap((t) => accountDenyHits(t, locale).map((h) => `${t}: ${h}`))).toEqual([]);
  });
});
